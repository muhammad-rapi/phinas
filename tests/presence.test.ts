import { beforeEach, expect, test } from 'vitest'
import { PresenceHub, type RealtimeLike } from '../src/main/sync/presence'

class FakeChannel {
  presence: Record<string, unknown[]> = {}
  tracked = false
  private onSync: (() => void) | null = null
  constructor(
    public name: string,
    public opts: unknown
  ) {}
  on(_type: string, _filter: unknown, cb: () => void): this {
    this.onSync = cb
    return this
  }
  subscribe(cb: (status: string) => void): this {
    cb('SUBSCRIBED')
    return this
  }
  async track(): Promise<void> {
    this.tracked = true
  }
  presenceState(): Record<string, unknown[]> {
    return this.presence
  }
  fireSync(): void {
    this.onSync?.()
  }
}

class FakeClient implements RealtimeLike {
  channels: FakeChannel[] = []
  removed: string[] = []
  authed = 0
  realtime = { setAuth: async (): Promise<void> => void this.authed++ }
  channel(name: string, opts: unknown): FakeChannel {
    const ch = new FakeChannel(name, opts)
    this.channels.push(ch)
    return ch
  }
  async removeChannel(ch: FakeChannel): Promise<void> {
    this.removed.push(ch.name)
  }
}

let client: FakeClient
let events: string[][]
let hub: PresenceHub

beforeEach(() => {
  client = new FakeClient()
  events = []
  hub = new PresenceHub(client, (_ch, v) => events.push(v as string[]))
})

test('joins my channel and tracks myself, joins friends channels without tracking', async () => {
  await hub.sync('me', ['f1', 'f2'])
  expect(client.channels.map((c) => c.name)).toEqual(['presence:me', 'presence:f1', 'presence:f2'])
  expect(client.channels.map((c) => (c.opts as { config: { private: boolean } }).config.private)).toEqual([
    true,
    true,
    true
  ])
  expect(client.channels[0].tracked).toBe(true)
  expect(client.channels[1].tracked).toBe(false)
  expect(client.authed).toBe(1)
})

test('reports a friend online when their key appears, and offline when it goes', async () => {
  await hub.sync('me', ['f1'])
  const f1 = client.channels[1]
  f1.presence = { f1: [{}] }
  f1.fireSync()
  expect(hub.onlineIds()).toEqual(['f1'])
  expect(events.at(-1)).toEqual(['f1'])
  f1.presence = {}
  f1.fireSync()
  expect(hub.onlineIds()).toEqual([])
  expect(events.at(-1)).toEqual([])
})

test('leaves channels of people who are no longer friends', async () => {
  await hub.sync('me', ['f1', 'f2'])
  client.channels[2].presence = { f2: [{}] }
  client.channels[2].fireSync()
  await hub.sync('me', ['f1'])
  expect(client.removed).toEqual(['presence:f2'])
  expect(hub.onlineIds()).toEqual([])
})

test('a second sync with the same friends joins nothing new', async () => {
  await hub.sync('me', ['f1'])
  await hub.sync('me', ['f1'])
  expect(client.channels).toHaveLength(2)
})

test('close leaves everything', async () => {
  await hub.sync('me', ['f1'])
  await hub.close()
  expect(client.removed.sort()).toEqual(['presence:f1', 'presence:me'])
  expect(hub.onlineIds()).toEqual([])
})
