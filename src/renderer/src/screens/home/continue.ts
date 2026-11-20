import type { Track } from '../../../../shared/types'

export interface ContinuePick {
  track: Track
  /** True when it is the loaded track, so the button pauses and resumes instead of restarting. */
  isCurrent: boolean
}

/** What the Lanjutkan tile shows: the loaded track, else the most recent play, else nothing. */
export function continueTrack(current: Track | null, recent: Track[]): ContinuePick | null {
  if (current) return { track: current, isCurrent: true }
  if (recent.length > 0) return { track: recent[0], isCurrent: false }
  return null
}
