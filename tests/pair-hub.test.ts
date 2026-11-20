import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { channelPlan, eligibleFriends, PairHub, REFUSED_RETRY_MS } from '../src/main/sync/pair-hub'
import type { PairRealtimeLike } from '../src/main/sync/realtime'
import type { SyncMessage } from '../src/shared/sync/protocol'
import type { Friend } from '../src/shared/types'

/** Behaves like realtime-js: on() throws after subscribe(), and channel() reuses a live topic. */
class FakeChannel {
  subscribed = false
  sent: unknown[] = []
  failWith: { status: string; err?: Error } | null = null
  constructor(
    public name: string,
    public opts: { config: { private: boolean } }
  ) {}
  on(type: string): this {
    if (this.subscribed) throw new Error(`cannot add \`${type}\` callbacks for ${this.name} after \`subscribe()\`.`)
    return this
  }
  subscribe(cb: (status: string, err?: Error) => void): this {
    this.subscribed = true
    if (this.failWith) cb(this.failWith.status, this.failWith.err)
    else cb('SUBSCRIBED')
    return this
  }
  async track(): Promise<void> {}
  presenceState(): Record<string, unknown[]> {
    return {}
  }
  async send(msg: unknown): Promise<void> {
    this.sent.push(msg)
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

const friend = (userId: string, o: Partial<Friend> = {}): Friend => ({
  friendshipId: `fs-${userId}`,
  userId,
  name: userId.toUpperCase(),
  isPartner: false,
  partnerRequest: null,
  canListen: true,
  ...o
})

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('channelPlan', () => {
  test('opens channels for newly eligible friends and closes the others', () => {
    expect(channelPlan(['a', 'b'], ['b', 'c'])).toEqual({ open: ['c'], close: ['a'] })
  })
  test('keeps at most `cap` channels, in list order', () => {
    expect(channelPlan([], ['p', 'a', 'b'], 2)).toEqual({ open: ['p', 'a'], close: [] })
    expect(channelPlan(['b'], ['p', 'a', 'b'], 2)).toEqual({ open: ['p', 'a'], close: ['b'] })
  })
  test('nothing to do when the channels already match', () => {
    expect(channelPlan(['a'], ['a'])).toEqual({ open: [], close: [] })
  })
})

describe('eligibleFriends', () => {
  test('online friends who allow Listen Together, in list order', () => {
    const list = [friend('p', { isPartner: true }), friend('a', { canListen: false }), friend('b'), friend('c')]
    expect(eligibleFriends(list, new Set(['b', 'a', 'p']))).toEqual(['p', 'b'])
  })
})

describe('PairHub', () => {
  let client: FakeClient
  let events: [string, unknown][]
  let hub: PairHub

  beforeEach(() => {
    client = new FakeClient()
    events = []
    hub = new PairHub(client, (ch, v) => events.push([ch, v]))
  })

  const of = (ch: string): unknown[] => events.filter(([c]) => c === ch).map(([, v]) => v)

  test('opens one private channel per online friend who allows it', async () => {
    await hub.setFriends('me', [friend('a'), friend('b', { canListen: false }), friend('zz')])
    expect(client.channels).toHaveLength(0)
    await hub.setOnline(['a', 'b'])
    expect(client.channels.map((c) => c.name)).toEqual(['pair:a:me'])
    expect(client.channels[0].opts.config.private).toBe(true)
  })

  test('events name the friend they are about', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    expect(of('listen:connection')).toEqual([{ friendId: 'a', up: true }])
  })

  test('a friend going offline closes their channel with reason closed', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.setOnline([])
    expect(client.removed).toEqual(['pair:a:me'])
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'closed' }])
  })

  test('a friend who may no longer listen with us is closed as not-allowed', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.setFriends('me', [friend('a', { canListen: false })])
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'not-allowed' }])
  })

  test("send reaches only that friend's channel", async () => {
    await hub.setFriends('me', [friend('a'), friend('b')])
    await hub.setOnline(['a', 'b'])
    const msg: SyncMessage = { type: 'end', from: 'me', ts: 1 }
    hub.send('b', msg)
    expect(client.channels.find((c) => c.name === 'pair:a:me')!.sent).toEqual([])
    expect(client.channels.find((c) => c.name === 'pair:b:me')!.sent).toEqual([{ type: 'broadcast', event: 'msg', payload: msg }])
  })

  test('status is reported per friend', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    expect(hub.status()).toEqual({ a: { connected: true, partnerHere: false, notAllowed: false } })
  })

  test('close leaves every channel and forgets who was online', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.close()
    expect(client.removed).toEqual(['pair:a:me'])
    expect(hub.status()).toEqual({})
    await hub.setFriends('other', [friend('a')])
    expect(client.channels).toHaveLength(1)
  })

  test('a refused channel is not reopened while the friend stays eligible', async () => {
    client.failNext = { status: 'CHANNEL_ERROR', err: new Error('Unauthorized') }
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await tick()
    client.failNext = null
    await hub.setOnline(['a'])
    expect(client.channels).toHaveLength(1)
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'not-allowed' }])
  })

  describe('after a refusal', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    test('the channel is tried again once the cooldown has passed, not before', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      client.failNext = { status: 'CHANNEL_ERROR', err: new Error('Unauthorized') }
      await hub.setFriends('me', [friend('a')])
      await hub.setOnline(['a'])
      await tick()
      client.failNext = null
      vi.setSystemTime(Date.now() + REFUSED_RETRY_MS - 1)
      await hub.setFriends('me', [friend('a')])
      expect(client.channels).toHaveLength(1)
      vi.setSystemTime(Date.now() + 1)
      await hub.setFriends('me', [friend('a')])
      expect(client.channels).toHaveLength(2)
      expect(hub.status()).toEqual({ a: { connected: true, partnerHere: false, notAllowed: false } })
    })
  })
})
