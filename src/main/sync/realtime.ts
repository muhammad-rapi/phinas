import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void

/**
 * One private Realtime channel per pair of friends. Only state is sent, never audio.
 * The name comes from the two sorted user ids; the server checks can_join_topic().
 */
export class PairChannel {
  private channel: RealtimeChannel | null = null
  private name: string | null = null
  private connected = false
  private partnerHere = false
  private notAllowed = false

  constructor(
    private readonly sb: SupabaseClient,
    private readonly emit: Emit
  ) {}

  status(): ListenStatus {
    return { connected: this.connected, partnerHere: this.partnerHere, notAllowed: this.notAllowed }
  }

  async open(me: string, partnerId: string): Promise<void> {
    const name = `pair:${[me, partnerId].sort().join(':')}`
    if (this.channel && this.name === name) return
    await this.close()
    this.notAllowed = false
    await this.sb.realtime.setAuth()
    const ch = this.sb.channel(name, {
      config: { private: true, broadcast: { self: false }, presence: { key: me } }
    })
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => this.emit('listen:message', payload))
    ch.on('presence', { event: 'sync' }, () => this.setHere(partnerId in ch.presenceState()))
    ch.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        this.setConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false)
        this.setHere(false) // cannot know while we are offline; the next presence sync fixes it
        // A refusal from the authorization policy will not change by retrying.
        if (status === 'CHANNEL_ERROR' && err && /unauthori[sz]ed|not allowed|permission/i.test(err.message)) {
          this.notAllowed = true
          void this.close()
        }
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
