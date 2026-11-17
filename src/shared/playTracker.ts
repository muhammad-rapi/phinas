import type { PlayRecord, Track } from './types'

export const PLAY_THRESHOLD_SEC = 30

/** Seconds of listening after which a track counts as played: 30 s, or half of a short track. */
export function playThreshold(durationSec: number): number {
  return durationSec > 0 ? Math.min(PLAY_THRESHOLD_SEC, durationSec / 2) : PLAY_THRESHOLD_SEC
}

/**
 * Turns the player's events for one track into at most one history record.
 *  - Counted as played as soon as the listen time reaches the threshold (reported once).
 *  - Counted as skipped when the user moves to another track before that.
 *  - Anything else (playback error, app closing) records nothing.
 */
export class PlayTracker {
  private track: Track | null = null
  private listened = 0
  private recorded = false

  constructor(private emit: (rec: PlayRecord) => void) {}

  start(track: Track): void {
    this.track = track
    this.listened = 0
    this.recorded = false
  }

  /** `listenedSec` is how far into the track playback has got. */
  tick(listenedSec: number): void {
    if (!this.track) return
    this.listened = Math.max(this.listened, listenedSec)
    if (!this.recorded && this.listened >= playThreshold(this.track.durationSec)) {
      this.recorded = true
      this.emit({ track: this.track, listenedSec: this.listened, skipped: false })
    }
  }

  /** The track stopped being current. `byUser` is true for a manual next, previous or pick. */
  finish(byUser: boolean): void {
    const t = this.track
    if (!t) return
    this.track = null
    if (!this.recorded && byUser) {
      this.emit({ track: t, listenedSec: this.listened, skipped: true })
    }
  }
}
