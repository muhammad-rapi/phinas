import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus, PairClosedReason } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void

interface PairChannelLike {
  on(type: 'broadcast', filter: { event: string }, cb: (msg: { payload: unknown }) => void): PairChannelLike
  on(type: 'presence', filter: { event: 'sync' }, cb: () => void): PairChannelLike
  subscribe(cb: (status: string, err?: Error) => void): PairChannelLike
  track(payload: Record<string, unknown>): Promise<unknown>
  presenceState(): Record<string, unknown[]>
  send(msg: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>
}

/** The part of SupabaseClient the pair channel uses (so tests can fake it). */
export interface PairRealtimeLike {
  realtime: { setAuth(token?: string | null): Promise<void> }
  channel(
    name: string,
    opts: { config: { private: boolean; broadcast: { self: boolean }; presence: { key: string } } }
  ): PairChannelLike
  removeChannel(ch: never): Promise<unknown>
}

/** A refusal from the authorization policy: rejoining will not help. */
const NOT_ALLOWED = /unauthori[sz]ed|not allowed|permission/i

/**
 * One private Realtime channel per pair of friends. Only state is sent, never audio.
 * The name comes from the two sorted user ids; the server checks can_join_topic().
 *
 * open and close are serialised: the Supabase client returns the existing channel for a topic,
 * and a subscribed channel throws on `on()`, so overlapping calls must never interleave.
 */
export class PairChannel {
  private channel: PairChannelLike | null = null
  private name: string | null = null
  private connected = false
  private partnerHere = false
  private notAllowed = false
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly sb: PairRealtimeLike,
    private readonly emit: Emit
  ) {}

  status(): ListenStatus {
    return { connected: this.connected, partnerHere: this.partnerHere, notAllowed: this.notAllowed }
  }

  open(me: string, partnerId: string): Promise<void> {
    return this.run(() => this.doOpen(me, partnerId))
  }

  /** Leaves the channel. `not-allowed` tells the renderer this friend may no longer listen with us. */
  close(reason: PairClosedReason = 'closed'): Promise<void> {
    return this.run(() => this.doClose(reason))
  }

  send(msg: SyncMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  /** Runs `op` after every earlier operation; one failure does not stop the queue. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const p = this.queue.then(op)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async doOpen(me: string, partnerId: string): Promise<void> {
    const name = `pair:${[me, partnerId].sort().join(':')}`
    if (this.channel && this.name === name) return
    await this.doClose('closed')
    this.notAllowed = false
    await this.sb.realtime.setAuth()
    // Only one open runs at a time, but stay safe if a channel appeared while we waited.
    if (this.channel && this.name === name) return
    const ch = this.sb.channel(name, {
      config: { private: true, broadcast: { self: false }, presence: { key: me } }
    })
    this.channel = ch
    this.name = name
    const current = (): boolean => this.channel === ch
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (current()) this.emit('listen:message', payload)
    })
    ch.on('presence', { event: 'sync' }, () => {
      if (current()) this.setHere(partnerId in ch.presenceState())
    })
    ch.subscribe((status, err) => {
      if (!current()) return
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        this.setConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false)
        this.setHere(false) // cannot know while we are offline; the next presence sync fixes it
        // A refusal from the authorization policy will not change by retrying.
        if (status === 'CHANNEL_ERROR' && err && NOT_ALLOWED.test(err.message)) {
          this.notAllowed = true
          void this.run(async () => {
            if (this.channel === ch) await this.doClose('not-allowed')
          }).catch((e) => console.warn('[listen] could not leave a refused channel:', e))
        }
      }
    })
  }

  private async doClose(reason: PairClosedReason): Promise<void> {
    const ch = this.channel
    this.channel = null
    this.name = null
    this.setConnected(false)
    this.setHere(false)
    if (!ch) return
    this.emit('listen:closed', reason)
    await this.sb.removeChannel(ch as never)
  }

  private setConnected(v: boolean): void {
    if (this.connected === v) return
    this.connected = v
    this.emit('listen:connection', v)
  }

  private setHere(v: boolean): void {
    if (this.partnerHere === v) return
    this.partnerHere = v
    this.emit('listen:presence', v)
  }
}
