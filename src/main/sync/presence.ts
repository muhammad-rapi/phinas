type Emit = (channel: string, value: unknown) => void

interface ChannelLike {
  on(type: 'presence', filter: { event: 'sync' }, cb: () => void): ChannelLike
  subscribe(cb: (status: string) => void): ChannelLike
  track(payload: Record<string, unknown>): Promise<unknown>
  presenceState(): Record<string, unknown[]>
}

/** The part of SupabaseClient this hub uses (so tests can fake it). */
export interface RealtimeLike {
  realtime: { setAuth(token?: string | null): Promise<void> }
  channel(name: string, opts: { config: { private: boolean; presence: { key: string } } }): ChannelLike
  removeChannel(ch: never): Promise<unknown>
}

/**
 * Who of my friends has Phinas open. I track presence on `presence:<me>`;
 * friends' channels are only watched. Access is checked by the server (can_join_topic).
 */
export class PresenceHub {
  private channels = new Map<string, ChannelLike>()
  private online = new Set<string>()
  private me: string | null = null

  constructor(
    private readonly sb: RealtimeLike,
    private readonly emit: Emit
  ) {}

  onlineIds(): string[] {
    return [...this.online].sort()
  }

  async sync(me: string, friendIds: string[]): Promise<void> {
    if (this.me !== me) await this.close()
    this.me = me
    const want = new Set([me, ...friendIds])
    for (const [id, ch] of this.channels) {
      if (want.has(id)) continue
      this.channels.delete(id)
      await this.sb.removeChannel(ch as never)
      this.setOnline(id, false)
    }
    const missing = [...want].filter((id) => !this.channels.has(id))
    if (missing.length === 0) return
    await this.sb.realtime.setAuth()
    for (const id of missing) {
      const ch = this.sb.channel(`presence:${id}`, { config: { private: true, presence: { key: me } } })
      if (id !== me) ch.on('presence', { event: 'sync' }, () => this.setOnline(id, id in ch.presenceState()))
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED' && id === me) void ch.track({ at: Date.now() })
      })
      this.channels.set(id, ch)
    }
  }

  async close(): Promise<void> {
    const all = [...this.channels.values()]
    this.channels.clear()
    this.me = null
    for (const ch of all) await this.sb.removeChannel(ch as never)
    if (this.online.size > 0) {
      this.online.clear()
      this.emit('friends:online', [])
    }
  }

  private setOnline(id: string, v: boolean): void {
    if (this.online.has(id) === v) return
    if (v) this.online.add(id)
    else this.online.delete(id)
    this.emit('friends:online', this.onlineIds())
  }
}
