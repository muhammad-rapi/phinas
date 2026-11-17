/** Below this (seconds) the two sides count as in sync. */
export const SOFT_DRIFT = 0.2
/** While already correcting, keep going until the drift falls below this. */
export const SETTLE_DRIFT = 0.05
/** At or above this, jump instead of changing speed. */
export const SEEK_DRIFT = 1
export const SLOW_RATE = 0.97
export const FAST_RATE = 1.03

export type Correction = { kind: 'none' } | { kind: 'rate'; rate: number } | { kind: 'seek' }

/**
 * `drift` is our position minus the expected one, in seconds (positive means we are ahead).
 * `loose` doubles the thresholds, for when the clock estimate is shaky.
 * `correcting` is true while the rate is already changed, so it does not flap around the threshold.
 */
export function reconcile(drift: number, opts: { loose?: boolean; correcting?: boolean } = {}): Correction {
  const k = opts.loose ? 2 : 1
  const abs = Math.abs(drift)
  if (abs >= SEEK_DRIFT * k) return { kind: 'seek' }
  if (abs >= SOFT_DRIFT * k || (opts.correcting && abs >= SETTLE_DRIFT * k)) {
    return { kind: 'rate', rate: drift > 0 ? SLOW_RATE : FAST_RATE }
  }
  return { kind: 'none' }
}

/** Where the partner should be right now, given a heartbeat stamped at `hbLocalTs` (our clock, ms). */
export function expectedPosition(hb: { position: number; playing: boolean }, hbLocalTs: number, nowLocal: number): number {
  return hb.playing ? hb.position + Math.max(0, nowLocal - hbLocalTs) / 1000 : hb.position
}
