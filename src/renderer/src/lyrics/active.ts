import type { LyricLine } from '../../../shared/types'

/** Index of the line being sung at `time`, or -1 before the first line. */
export function activeLine(lines: LyricLine[], time: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].timeSec <= time) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return found
}
