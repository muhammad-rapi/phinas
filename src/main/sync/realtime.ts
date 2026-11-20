import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void

/**
 * One Realtime channel shared by the two accounts. Only state is sent (see the spec),
 * never audio. The channel name comes from the two user ids, so no table is needed.
 */
export class PairChannel {
  private channel: RealtimeChannel | null = null
  private name: string | null = null
  private connected = false
  private partnerHere = false

  constructor(
    private readonly sb: SupabaseClient,
    private readonly emit: Emit
  ) {}

  status(): ListenStatus {
    return { connected: this.connected, partnerHere: this.partnerHere }
  }

  async open(me: string, partnerId: string): Promise<void> {
    const name = `phinas:pair:${[me, partnerId].sort().join(':')}`
    if (this.channel && this.name === name) return
    await this.close()
    const ch = this.sb.channel(name, { config: { broadcast: { self: false }, presence: { key: me } } })
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => this.emit('listen:message', payload))
    ch.on('presence', { event: 'sync' }, () => this.setHere(partnerId in ch.presenceState()))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        this.setConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false)
        this.setHere(false) // cannot know while we are offline; the next presence sync fixes it
      }
    })
    this.channel = ch
    this.name = name
  }

  send(msg: SyncMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  async close(): Promise<void> {
    const ch = this.channel
    this.channel = null
    this.name = null
    if (ch) await this.sb.removeChannel(ch)
    this.setConnected(false)
    this.setHere(false)
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
