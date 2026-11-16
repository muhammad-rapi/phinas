import type { Track } from '../../../shared/types'

export interface QueueState {
  tracks: Track[]
  index: number
}

export const empty: QueueState = { tracks: [], index: -1 }

export const startQueue = (tracks: Track[], index: number): QueueState => ({ tracks, index })

export const current = (q: QueueState): Track | null => q.tracks[q.index] ?? null

export const next = (q: QueueState): QueueState | null =>
  q.index + 1 < q.tracks.length ? { ...q, index: q.index + 1 } : null

export const prev = (q: QueueState): QueueState =>
  q.index > 0 ? { ...q, index: q.index - 1 } : q

export const enqueue = (q: QueueState, track: Track): QueueState => ({
  ...q,
  tracks: [...q.tracks, track]
})

export const jumpTo = (q: QueueState, index: number): QueueState =>
  index >= 0 && index < q.tracks.length ? { ...q, index } : q
