import type { Track } from '../types'
import { ClockEstimator } from './clock'
import {
  CLOCK_RESYNC_MS,
  GRACE_MS,
  HEARTBEAT_MS,
  INVITE_TTL_MS,
  PROTOCOL_VERSION,
  windowQueue,
  type MessageOf,
  type SyncAction,
  type SyncMessage,
  type SyncPayload
} from './protocol'
import { expectedPosition, reconcile } from './reconcile'

/** How the session reaches the partner. Desktop uses IPC to a Supabase channel; mobile will use its own. */
export interface Transport {
  send(msg: SyncMessage): void
  onMessage(cb: (msg: SyncMessage) => void): () => void
  /** Whether the partner is on the channel. Should call back right away with the current value. */
  onPartnerPresence(cb: (here: boolean) => void): () => void
  /** Whether our own connection to the channel is up. Should call back right away with the current value. */
  onConnection(cb: (up: boolean) => void): () => void
}

export interface PlayerSnapshot {
  tracks: Track[]
  index: number
  /** Seconds into the current track. */
  position: number
  playing: boolean
}

/** What the session needs from the audio player. `apply` must NOT report the change back to the session. */
export interface PlayerPort {
  snapshot(): PlayerSnapshot
  apply(action: SyncAction): void
  setRate(rate: number): void
}

export type SessionStatus = 'idle' | 'inviting' | 'invited' | 'active' | 'ended'
export type EndReason = 'ended' | 'declined' | 'expired' | 'timeout' | 'version' | 'partner-ended' | 'busy'

export interface SessionState {
  status: SessionStatus
  /** The partner is on the channel. */
  partnerHere: boolean
  /** Our own connection to the channel is up. */
  connected: boolean
  /** The partner reported that their stream failed. */
  partnerError: boolean
  /** The clock estimate is shaky, so drift correction is more forgiving. */
  looseSync: boolean
  endReason: EndReason | null
}

export const INITIAL_STATE: SessionState = {
  status: 'idle',
  partnerHere: false,
  connected: false,
  partnerError: false,
  looseSync: true,
  endReason: null
}

export interface SessionOptions {
  /** Our user id. */
  me: string
  transport: Transport
  player: PlayerPort
  /** Clock in ms. Tests pass a skewed one. */
  now?: () => number
}

type Timer = ReturnType<typeof setTimeout>

export class SyncSession {
  private state: SessionState = { ...INITIAL_STATE }
  private listeners = new Set<() => void>()
  private clock = new ClockEstimator()
  private readonly me: string
  private readonly transport: Transport
  private readonly player: PlayerPort
  private readonly now: () => number
  /** Whoever made the last action; only the lead sends heartbeats. */
  private lead: string | null = null
  private lastAction: { ts: number; from: string } | null = null
  private rejoining = false
  private rate = 1
  private failedId: string | null = null
  private pingSeq = 0
  private inviteTimer: Timer | null = null
  private graceTimer: Timer | null = null
  private heartbeatTimer: Timer | null = null
  private clockTimer: Timer | null = null
  private readonly offs: (() => void)[]

  constructor(o: SessionOptions) {
    this.me = o.me
    this.transport = o.transport
    this.player = o.player
    this.now = o.now ?? Date.now
    this.offs = [
      o.transport.onMessage((m) => this.onMessage(m)),
      o.transport.onPartnerPresence((here) => this.onPresence(here)),
      o.transport.onConnection((up) => this.onConnection(up))
    ]
  }

  getState(): SessionState {
    return this.state
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  dispose(): void {
    this.offs.forEach((off) => off())
    this.clearTimers()
    this.listeners.clear()
  }

  // ---- what the user can do ----

  invite(): void {
    if (this.state.status !== 'idle' && this.state.status !== 'ended') return
    this.set({ status: 'inviting', endReason: null, partnerError: false })
    this.send({ type: 'invite', version: PROTOCOL_VERSION })
    this.inviteTimer = setTimeout(() => this.finish('expired'), INVITE_TTL_MS)
  }

  accept(): void {
    if (this.state.status !== 'invited' || !this.lead) return
    this.doAccept(this.lead)
  }

  decline(): void {
    if (this.state.status !== 'invited') return
    this.clearInviteTimer()
    this.send({ type: 'decline' })
    this.set({ status: 'idle' })
  }

  /** Ends an active session, or cancels an invite we sent. */
  end(): void {
    if (this.state.status !== 'active' && this.state.status !== 'inviting') return
    this.send({ type: 'end' })
    this.finish('ended')
  }

  // ---- incoming ----

  private onMessage(m: SyncMessage): void {
    if (m.from === this.me) return
    switch (m.type) {
      case 'invite':
        return this.onInvite(m)
      case 'accept':
        return this.onAccept(m)
      case 'decline':
        if (this.state.status === 'inviting') {
          this.finish(m.reason === 'version' ? 'version' : m.reason === 'busy' ? 'busy' : 'declined')
        }
        return
      case 'end':
        if (this.state.status === 'active') this.finish('partner-ended')
        else if (this.state.status === 'invited') {
          this.clearInviteTimer()
          this.set({ status: 'idle' })
        }
        return
      case 'action':
        if (this.state.status === 'active') this.applyIncoming(m.action, m.ts, m.from)
        return
      case 'ping':
        if (this.state.status === 'active') this.send({ type: 'pong', id: m.id, t0: m.ts })
        return
      case 'pong':
        if (this.state.status !== 'active') return
        this.clock.add(m.t0, m.ts, this.now())
        this.set({ looseSync: !this.clock.stable })
        return
      case 'heartbeat':
        if (this.state.status === 'active') this.onHeartbeat(m)
        return
      case 'resync':
        if (this.state.status === 'active' && this.lead === this.me) this.sendSnapshot()
        return
      case 'status':
        if (this.state.status === 'active') this.set({ partnerError: m.state === 'error' })
        return
      case 'hello':
        if (this.state.status === 'active') this.onHello(m)
        return
      default:
        return
    }
  }

  private onInvite(m: MessageOf<'invite'>): void {
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'decline', reason: 'version' })
      return
    }
    const s = this.state.status
    if (s === 'active') return
    if (s === 'inviting') {
      // Both asked at once: the smaller id's invite stands, the other side accepts it.
      if (m.from < this.me) this.doAccept(m.from)
      return
    }
    this.lead = m.from
    this.clearInviteTimer()
    this.set({ status: 'invited', endReason: null })
    this.inviteTimer = setTimeout(() => {
      this.inviteTimer = null
      this.set({ status: 'idle' })
    }, INVITE_TTL_MS)
  }

  private onAccept(m: MessageOf<'accept'>): void {
    if (this.state.status !== 'inviting') return
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'end' })
      this.finish('version')
      return
    }
    this.clearInviteTimer()
    this.startActive(this.me)
    // Whoever is already playing sets the starting state; the inviter wins if both are.
    const mine = this.snapshotAction()
    if (mine) this.localAction(mine)
    else if (m.snapshot) this.applyIncoming(m.snapshot, m.ts, m.from)
  }

  // ---- internals ----

  /** Called by the player whenever the user does something. Applied locally already; this tells the partner. */
  localAction(action: SyncAction): void {
    if (this.state.status !== 'active') return
    const a = action.kind === 'queue' ? this.windowed(action) : action
    const ts = this.now()
    this.lastAction = { ts, from: this.me }
    this.lead = this.me
    this.send({ type: 'action', action: a }, ts)
  }

  /** Applies an action from the partner unless a later one (ours or theirs) already won. */
  private applyIncoming(action: SyncAction, peerTs: number, from: string): void {
    const ts = this.clock.toLocal(peerTs)
    const last = this.lastAction
    if (last && (last.ts > ts || (last.ts === ts && last.from < from))) return
    this.lastAction = { ts, from }
    this.lead = from
    this.rejoining = false
    this.player.apply(action)
  }

  private windowed(a: Extract<SyncAction, { kind: 'queue' }>): SyncAction {
    const w = windowQueue(a.tracks, a.index)
    return { ...a, tracks: w.tracks, index: w.index }
  }

  /** The current queue as an action, or null when nothing is loaded. */
  private snapshotAction(): SyncAction | null {
    const s = this.player.snapshot()
    if (!s.tracks[s.index]) return null
    return this.windowed({ kind: 'queue', tracks: s.tracks, index: s.index, position: s.position, playing: s.playing })
  }

  private sendSnapshot(): void {
    const a = this.snapshotAction()
    if (a) this.localAction(a)
  }

  private burstPings(n: number, gapMs: number): void {
    for (let i = 0; i < n; i++) setTimeout(() => this.sendPing(), i * gapMs)
  }

  private sendPing(): void {
    if (this.state.status !== 'active') return
    this.send({ type: 'ping', id: `${this.me}:${++this.pingSeq}` })
  }

  private onHello(m: MessageOf<'hello'>): void {
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'end' })
      this.finish('version')
      return
    }
    this.burstPings(3, 200) // latency may have changed with the new connection
    if (this.rejoining) {
      // Both sides were away: the smaller id's state stands, the other waits for it.
      if (this.me < m.from) {
        this.rejoining = false
        this.sendSnapshot()
      }
      return
    }
    this.sendSnapshot()
  }

  /** The player calls this when a track cannot be streamed, so the session does not fight the skip. */
  reportStreamError(videoId: string): void {
    if (this.state.status !== 'active') return
    this.failedId = videoId
    this.send({ type: 'status', state: 'error' })
  }

  private beat(): void {
    if (this.state.status !== 'active' || this.lead !== this.me) return
    const s = this.player.snapshot()
    this.send({
      type: 'heartbeat',
      videoId: s.tracks[s.index]?.videoId ?? null,
      position: s.position,
      playing: s.playing
    })
  }

  private onHeartbeat(m: MessageOf<'heartbeat'>): void {
    if (this.lead === this.me) return
    // A heartbeat with no track says nothing about the song we failed on, so it must not clear the error.
    if (this.failedId && m.videoId !== null && m.videoId !== this.failedId) {
      this.failedId = null
      this.send({ type: 'status', state: 'ok' })
    }
    const s = this.player.snapshot()
    const mine = s.tracks[s.index]?.videoId ?? null
    if (m.videoId !== mine) {
      // A missed message, or we skipped a track we could not play. Ask again unless it is the latter.
      if (m.videoId !== null && m.videoId !== this.failedId) this.send({ type: 'resync' })
      return
    }
    if (mine === null) return
    const expected = expectedPosition(m, this.clock.toLocal(m.ts), this.now())
    if (m.playing !== s.playing) {
      this.player.apply({ kind: m.playing ? 'play' : 'pause', position: expected })
      return
    }
    const c = reconcile(s.position - expected, { loose: !this.clock.stable, correcting: this.rate !== 1 })
    if (c.kind === 'seek') {
      this.player.apply({ kind: 'seek', position: expected })
      this.setRate(1)
    } else if (c.kind === 'rate') {
      this.setRate(c.rate)
    } else {
      this.setRate(1)
    }
  }

  private doAccept(inviter: string): void {
    this.clearInviteTimer()
    this.send({ type: 'accept', version: PROTOCOL_VERSION, snapshot: this.snapshotAction() })
    this.startActive(inviter)
  }

  private startActive(lead: string): void {
    this.lead = lead
    this.lastAction = null
    this.rejoining = false
    this.failedId = null
    this.clock = new ClockEstimator()
    this.set({ status: 'active', endReason: null, partnerError: false, looseSync: true })
    this.burstPings(5, 200)
    this.clockTimer = setInterval(() => this.sendPing(), CLOCK_RESYNC_MS)
    this.heartbeatTimer = setInterval(() => this.beat(), HEARTBEAT_MS)
    this.updateGrace()
  }

  private onPresence(here: boolean): void {
    this.set({ partnerHere: here })
    this.updateGrace()
  }

  private onConnection(up: boolean): void {
    const was = this.state.connected
    this.set({ connected: up })
    if (up && !was && this.state.status === 'active') {
      // We were away: tell the partner and wait for the current state.
      this.rejoining = true
      this.send({ type: 'hello', version: PROTOCOL_VERSION })
    }
    this.updateGrace()
  }

  /** Starts or cancels the 2-minute countdown depending on whether either side is away. */
  private updateGrace(): void {
    const away = this.state.status === 'active' && (!this.state.partnerHere || !this.state.connected)
    if (away && !this.graceTimer) {
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null
        this.send({ type: 'end' }) // best effort: it is lost if we are the side that is offline
        this.finish('timeout')
      }, GRACE_MS)
    } else if (!away && this.graceTimer) {
      clearTimeout(this.graceTimer)
      this.graceTimer = null
    }
  }

  private finish(reason: EndReason): void {
    this.clearTimers()
    this.setRate(1)
    this.set({ status: 'ended', endReason: reason, partnerError: false })
  }

  private setRate(r: number): void {
    if (this.rate === r) return
    this.rate = r
    this.player.setRate(r)
  }

  private clearInviteTimer(): void {
    if (this.inviteTimer) clearTimeout(this.inviteTimer)
    this.inviteTimer = null
  }

  private clearTimers(): void {
    this.clearInviteTimer()
    if (this.graceTimer) clearTimeout(this.graceTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.graceTimer = this.heartbeatTimer = this.clockTimer = null
  }

  private set(patch: Partial<SessionState>): void {
    const next = { ...this.state, ...patch }
    if (Object.keys(patch).every((k) => this.state[k as keyof SessionState] === next[k as keyof SessionState])) return
    this.state = next
    this.listeners.forEach((cb) => cb())
  }

  private send(payload: SyncPayload, ts: number = this.now()): void {
    this.transport.send({ ...payload, from: this.me, ts } as SyncMessage)
  }
}
