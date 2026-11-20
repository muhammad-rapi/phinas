import { beforeEach, expect, test } from 'vitest'
import { PairChannel, type PairRealtimeLike } from '../src/main/sync/realtime'

/** Behaves like realtime-js: on() throws after subscribe(), and channel() reuses a live topic. */
class FakeChannel {
  subscribed = false
  handlers: { type: string; event: string }[] = []
  failWith: { status: string; err?: Error } | null = null
  private onStatus: ((status: string, err?: Error) => void) | null = null
  constructor(
    public name: string,
    public opts: { config: { private: boolean } }
  ) {}
  on(type: string, filter: { event: string }): this {
    if (this.subscribed) throw new Error(`cannot add \`${type}\` callbacks for ${this.name} after \`subscribe()\`.`)
    this.handlers.push({ type, event: filter.event })
    return this
  }
  subscribe(cb: (status: string, err?: Error) => void): this {
    this.subscribed = true
    this.onStatus = cb
    if (this.failWith) cb(this.failWith.status, this.failWith.err)
    else cb('SUBSCRIBED')
    return this
  }
  async track(): Promise<void> {}
  presenceState(): Record<string, unknown[]> {
    return {}
  }
  async send(): Promise<void> {}
  fireStatus(status: string, err?: Error): void {
    this.onStatus?.(status, err)
  }
}

class FakeClient implements PairRealtimeLike {
  channels: FakeChannel[] = []
  live = new Map<string, FakeChannel>()
  removed: string[] = []
  failNext: { status: string; err?: Error } | null = null
  realtime = { setAuth: async (): Promise<void> => {} }
  channel(name: string, opts: { config: { private: boolean } }): FakeChannel {
    const existing = this.live.get(name)
    if (existing) return existing
    const ch = new FakeChannel(name, opts)
    ch.failWith = this.failNext
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
let events: [string, unknown][]
let pair: PairChannel

beforeEach(() => {
  client = new FakeClient()
  events = []
  pair = new PairChannel(client, (ch, v) => events.push([ch, v]))
})

const closedEvents = (): unknown[] => events.filter(([ch]) => ch === 'listen:closed').map(([, v]) => v)

test('the channel is private and named after the sorted ids', async () => {
  await pair.open('zed', 'amy')
  expect(client.channels).toHaveLength(1)
  expect(client.channels[0].name).toBe('pair:amy:zed')
  expect(client.channels[0].opts.config.private).toBe(true)
  expect(pair.status().connected).toBe(true)
})

test('concurrent opens create one channel with one broadcast handler', async () => {
  await Promise.all([pair.open('a', 'b'), pair.open('a', 'b'), pair.open('b', 'a')])
  expect(client.channels).toHaveLength(1)
  expect(client.channels[0].handlers.filter((h) => h.type === 'broadcast')).toHaveLength(1)
  expect(closedEvents()).toEqual([])
})

test('an unauthorized subscribe error sets notAllowed and closes the channel', async () => {
  client.failNext = { status: 'CHANNEL_ERROR', err: new Error('Unauthorized: You do not have permissions') }
  await pair.open('a', 'b')
  await tick()
  expect(pair.status().notAllowed).toBe(true)
  expect(pair.status().connected).toBe(false)
  expect(client.removed).toEqual(['pair:a:b'])
  expect(closedEvents()).toEqual(['not-allowed'])
})

test('a later unauthorized error on an open channel also closes it', async () => {
  await pair.open('a', 'b')
  client.channels[0].fireStatus('CHANNEL_ERROR', new Error('not allowed'))
  await tick()
  expect(pair.status().notAllowed).toBe(true)
  expect(closedEvents()).toEqual(['not-allowed'])
})

test('close emits listen:closed once, and only for an open channel', async () => {
  await pair.close()
  expect(closedEvents()).toEqual([])
  await pair.open('a', 'b')
  await pair.close()
  await pair.close()
  expect(closedEvents()).toEqual(['closed'])
  expect(client.removed).toEqual(['pair:a:b'])
})
