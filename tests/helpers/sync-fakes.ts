import type { SyncAction, SyncMessage } from '../../src/shared/sync/protocol'
import type { PlayerPort, PlayerSnapshot, Transport } from '../../src/shared/sync/session'

/** A transport wired straight to another one. Uses setTimeout, so tests drive it with fake timers. */
export class FakeTransport implements Transport {
  peer: FakeTransport | null = null
  latency: number | (() => number) = 0
  /** While true, nothing is sent or received (a dropped connection). */
  down = false
  sent: SyncMessage[] = []
  private msg = new Set<(m: SyncMessage) => void>()
  private pres = new Set<(here: boolean) => void>()
  private conn = new Set<(up: boolean) => void>()

  send(m: SyncMessage): void {
    this.sent.push(m)
    const peer = this.peer
    if (!peer || this.down) return
    const delay = typeof this.latency === 'function' ? this.latency() : this.latency
    setTimeout(() => {
      if (!peer.down) peer.deliver(structuredClone(m))
    }, delay)
  }
  onMessage(cb: (m: SyncMessage) => void): () => void {
    this.msg.add(cb)
    return () => this.msg.delete(cb)
  }
  onPartnerPresence(cb: (here: boolean) => void): () => void {
    this.pres.add(cb)
    return () => this.pres.delete(cb)
  }
  onConnection(cb: (up: boolean) => void): () => void {
    this.conn.add(cb)
    return () => this.conn.delete(cb)
  }

  deliver(m: SyncMessage): void {
    this.msg.forEach((cb) => cb(m))
  }
  emitPresence(here: boolean): void {
    this.pres.forEach((cb) => cb(here))
  }
  emitConnection(up: boolean): void {
    this.conn.forEach((cb) => cb(up))
  }
  sentOfType(type: SyncMessage['type']): SyncMessage[] {
    return this.sent.filter((m) => m.type === type)
  }
}

/** A player that just records what it is told and updates its snapshot accordingly. */
export class FakePlayer implements PlayerPort {
  snap: PlayerSnapshot = { tracks: [], index: 0, position: 0, playing: false }
  applied: SyncAction[] = []
  rate = 1

  snapshot(): PlayerSnapshot {
    return this.snap
  }
  apply(a: SyncAction): void {
    this.applied.push(a)
    if (a.kind === 'queue') this.snap = { tracks: a.tracks, index: a.index, position: a.position, playing: a.playing }
    else if (a.kind === 'play') this.snap = { ...this.snap, position: a.position, playing: true }
    else if (a.kind === 'pause') this.snap = { ...this.snap, position: a.position, playing: false }
    else this.snap = { ...this.snap, position: a.position }
  }
  setRate(r: number): void {
    this.rate = r
  }
}
