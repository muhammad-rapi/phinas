import { beforeEach, expect, test } from 'vitest'
import { PresenceHub, type RealtimeLike } from '../src/main/sync/presence'

/** Behaves like realtime-js: on() throws after subscribe(), and channel() reuses a live topic. */
class FakeChannel {
  presence: Record<string, unknown[]> = {}
  tracked = false
  subscribed = false
  /** When set, subscribe reports this instead of SUBSCRIBED. */
  failWith: { status: string; err?: Error } | null = null
  private onSync: (() => void) | null = null
  private onStatus: ((status: string, err?: Error) => void) | null = null
  constructor(
    public name: string,
    public opts: unknown
  ) {}
  on(_type: string, _filter: unknown, cb: () => void): this {
    if (this.subscribed) throw new Error(`cannot add callbacks for ${this.name} after subscribe()`)
    this.onSync = cb
    return this
  }
  subscribe(cb: (status: string, err?: Error) => void): this {
    this.subscribed = true
    this.onStatus = cb
    if (this.failWith) cb(this.failWith.status, this.failWith.err)
    else cb('SUBSCRIBED')
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
  fireStatus(status: string, err?: Error): void {
    this.onStatus?.(status, err)
  }
}

class FakeClient implements RealtimeLike {
  channels: FakeChannel[] = []
  live = new Map<string, FakeChannel>()
  removed: string[] = []
  authed = 0
  /** Set to hold setAuth until released. */
  gate: Promise<void> | null = null
  failNext = new Map<string, { status: string; err?: Error }>()
  realtime = {
    setAuth: async (): Promise<void> => {
      this.authed++
      if (this.gate) await this.gate
    }
  }
  channel(name: string, opts: unknown): FakeChannel {
    const existing = this.live.get(name)
    if (existing) return existing
    const ch = new FakeChannel(name, opts)
    ch.failWith = this.failNext.get(name) ?? null
    this.channels.push(ch)
    this.live.set(name, ch)
    return ch
  }
  async removeChannel(ch: FakeChannel): Promise<void> {
    this.removed.push(ch.name)
    if (this.live.get(ch.name) === ch) this.live.delete(ch.name)
  }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

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

test('two concurrent syncs do not throw and join one channel per id', async () => {
  await Promise.all([hub.sync('me', ['f1']), hub.sync('me', ['f1'])])
  expect(client.channels.map((c) => c.name)).toEqual(['presence:me', 'presence:f1'])
})

test('close during a pending sync leaves no channels', async () => {
  let release!: () => void
  client.gate = new Promise((r) => (release = r))
  const pending = hub.sync('me', ['f1'])
  await tick()
  const closing = hub.close()
  release()
  await Promise.all([pending, closing])
  expect(client.live.size).toBe(0)
  expect(client.channels).toHaveLength(0)
})

test('an unauthorized error leaves the channel and marks the friend offline', async () => {
  await hub.sync('me', ['f1'])
  const f1 = client.channels[1]
  f1.presence = { f1: [{}] }
  f1.fireSync()
  expect(hub.onlineIds()).toEqual(['f1'])
  f1.fireStatus('CHANNEL_ERROR', new Error('Unauthorized: You do not have permissions to read from this Channel topic'))
  expect(hub.onlineIds()).toEqual([])
  await tick()
  expect(client.removed).toEqual(['presence:f1'])
  // The next sync may try again with a fresh channel.
  await hub.sync('me', ['f1'])
  expect(client.channels.filter((c) => c.name === 'presence:f1')).toHaveLength(2)
})

test('a refusal while subscribing removes the channel', async () => {
  client.failNext.set('presence:f1', { status: 'CHANNEL_ERROR', err: new Error('unauthorized') })
  await hub.sync('me', ['f1'])
  await tick()
  expect(client.removed).toEqual(['presence:f1'])
})

test('CLOSED marks the friend offline but keeps the channel', async () => {
  await hub.sync('me', ['f1'])
  const f1 = client.channels[1]
  f1.presence = { f1: [{}] }
  f1.fireSync()
  f1.fireStatus('CLOSED')
  expect(hub.onlineIds()).toEqual([])
  await tick()
  expect(client.removed).toEqual([])
})

test('a sync called before close does nothing, even when it runs after', async () => {
  const pending = hub.sync('me', ['f1'])
  const closing = hub.close()
  await Promise.all([pending, closing])
  expect(client.channels).toHaveLength(0)
  expect(client.authed).toBe(0)
})
