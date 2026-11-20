type Emit = (channel: string, value: unknown) => void

interface ChannelLike {
  on(type: 'presence', filter: { event: 'sync' }, cb: () => void): ChannelLike
  subscribe(cb: (status: string, err?: Error) => void): ChannelLike
  track(payload: Record<string, unknown>): Promise<unknown>
  presenceState(): Record<string, unknown[]>
}

/** The part of SupabaseClient this hub uses (so tests can fake it). */
export interface RealtimeLike {
  realtime: { setAuth(token?: string | null): Promise<void> }
  channel(name: string, opts: { config: { private: boolean; presence: { key: string } } }): ChannelLike
  removeChannel(ch: never): Promise<unknown>
}

/** A refusal from the authorization policy: rejoining will not help. */
const NOT_ALLOWED = /unauthori[sz]ed|not allowed|permission/i

/**
 * Who of my friends has Phinas open. I track presence on `presence:<me>`;
 * friends' channels are only watched. Access is checked by the server (can_join_topic).
 *
 * Calls are serialised: the Supabase client returns the existing channel for a topic, and a
 * subscribed channel throws on `on()`, so two overlapping syncs must never interleave.
 */
export class PresenceHub {
  private channels = new Map<string, ChannelLike>()
  private online = new Set<string>()
  private me: string | null = null
  private queue: Promise<unknown> = Promise.resolve()
  /** Bumped by close(); a sync that sees it change stops. */
  private epoch = 0

  constructor(
    private readonly sb: RealtimeLike,
    private readonly emit: Emit
  ) {}

  onlineIds(): string[] {
    return [...this.online].sort()
  }

  sync(me: string, friendIds: string[]): Promise<void> {
    return this.run(() => this.doSync(me, friendIds))
  }

  close(): Promise<void> {
    this.epoch++
    return this.run(() => this.doClose())
  }

  /** Runs `op` after every earlier operation; one failure does not stop the queue. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const p = this.queue.then(op)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async doSync(me: string, friendIds: string[]): Promise<void> {
    const epoch = this.epoch
    if (this.me !== me) await this.doClose()
    if (epoch !== this.epoch) return
    this.me = me
    const want = new Set([me, ...friendIds])
    for (const [id, ch] of this.channels) {
      if (want.has(id)) continue
      this.channels.delete(id)
      this.setOnline(id, false)
      await this.sb.removeChannel(ch as never)
      if (epoch !== this.epoch) return
    }
    const missing = [...want].filter((id) => !this.channels.has(id))
    if (missing.length === 0) return
    await this.sb.realtime.setAuth()
    if (epoch !== this.epoch) return
    for (const id of missing) {
      const ch = this.sb.channel(`presence:${id}`, { config: { private: true, presence: { key: me } } })
      // Callbacks of a channel we already left (or replaced) must not touch the online set.
      const current = (): boolean => this.channels.get(id) === ch
      this.channels.set(id, ch)
      if (id !== me) {
        ch.on('presence', { event: 'sync' }, () => {
          if (current()) this.setOnline(id, id in ch.presenceState())
        })
      }
      ch.subscribe((status, err) => {
        if (!current()) return
        if (status === 'SUBSCRIBED') {
          if (id === me) void ch.track({ at: Date.now() })
          return
        }
        if (status !== 'CHANNEL_ERROR' && status !== 'CLOSED' && status !== 'TIMED_OUT') return
        this.setOnline(id, false)
        if (status === 'CHANNEL_ERROR' && err && NOT_ALLOWED.test(err.message)) this.drop(id, ch)
      })
    }
  }

  /** Leaves a channel the server refused, so the client stops rejoining it. */
  private drop(id: string, ch: ChannelLike): void {
    void this.run(async () => {
      if (this.channels.get(id) !== ch) return
      this.channels.delete(id)
      await this.sb.removeChannel(ch as never)
    }).catch((e) => console.warn('[presence] could not leave a refused channel:', e))
  }

  private async doClose(): Promise<void> {
    const all = [...this.channels.values()]
    this.channels.clear()
    this.me = null
    if (this.online.size > 0) {
      this.online.clear()
      this.emit('friends:online', [])
    }
    for (const ch of all) await this.sb.removeChannel(ch as never)
  }

  private setOnline(id: string, v: boolean): void {
    if (this.online.has(id) === v) return
    if (v) this.online.add(id)
    else this.online.delete(id)
    this.emit('friends:online', this.onlineIds())
  }
}
