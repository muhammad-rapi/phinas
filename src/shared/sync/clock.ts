interface Sample {
  offset: number
  rtt: number
}

/**
 * Estimates how far the partner's clock is ahead of ours, NTP-style:
 * we send a ping at t0, the peer stamps t1 when it answers, we receive at t2.
 * The sample with the shortest round trip is the most trustworthy.
 */
export class ClockEstimator {
  private samples: Sample[] = []

  constructor(private readonly max = 8) {}

  add(t0: number, t1: number, t2: number): void {
    const rtt = t2 - t0
    if (rtt < 0) return
    this.samples.push({ offset: t1 - (t0 + t2) / 2, rtt })
    if (this.samples.length > this.max) this.samples.shift()
  }

  /** Peer clock minus our clock, in ms. 0 until the first sample. */
  get offset(): number {
    let best: Sample | undefined
    for (const s of this.samples) if (!best || s.rtt < best.rtt) best = s
    return best?.offset ?? 0
  }

  toLocal(peerTs: number): number {
    return peerTs - this.offset
  }

  /** True once there are enough samples and they agree to within 100 ms. */
  get stable(): boolean {
    if (this.samples.length < 3) return false
    const offs = this.samples.map((s) => s.offset)
    return Math.max(...offs) - Math.min(...offs) < 100
  }
}
