/** Seconds for a pointer at `clientX` over a bar spanning [left, left + width]. Clamped to the track. */
export function seekFromPointer(clientX: number, left: number, width: number, durationSec: number): number {
  if (width <= 0 || durationSec <= 0) return 0
  const ratio = Math.min(1, Math.max(0, (clientX - left) / width))
  return ratio * durationSec
}
