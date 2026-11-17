import type { Track } from '../../../shared/types'

export type RepeatMode = 'off' | 'all' | 'one'

export interface QueueState {
  tracks: Track[]
  index: number
  /** The order before shuffling. Present only while shuffle is on. */
  original?: Track[]
}

export const empty: QueueState = { tracks: [], index: -1 }

export const startQueue = (tracks: Track[], index: number): QueueState => ({ tracks, index })

export const current = (q: QueueState): Track | null => q.tracks[q.index] ?? null

export const isShuffled = (q: QueueState): boolean => q.original !== undefined

/**
 * The next state, or null when the queue is finished.
 * Repeat "all" wraps to the first track. Repeat "one" is handled by the player
 * (it replays the current track when it ends); a manual skip still moves on.
 */
export const next = (q: QueueState, repeat: RepeatMode = 'off'): QueueState | null => {
  if (q.index + 1 < q.tracks.length) return { ...q, index: q.index + 1 }
  if (repeat === 'all' && q.tracks.length > 0) return { ...q, index: 0 }
  return null
}

export const prev = (q: QueueState): QueueState => (q.index > 0 ? { ...q, index: q.index - 1 } : q)

export const enqueue = (q: QueueState, track: Track): QueueState => ({
  ...q,
  tracks: [...q.tracks, track],
  original: q.original ? [...q.original, track] : undefined
})

/** Plays `track` right after the current one. */
export const insertNext = (q: QueueState, track: Track): QueueState => ({
  ...q,
  tracks: [...q.tracks.slice(0, q.index + 1), track, ...q.tracks.slice(q.index + 1)],
  original: q.original ? [...q.original, track] : undefined
})

export const jumpTo = (q: QueueState, index: number): QueueState =>
  index >= 0 && index < q.tracks.length ? { ...q, index } : q

/** Shuffles only the tracks after the current one, so the song that is playing never changes. */
export function shuffleOn(q: QueueState, rand: () => number = Math.random): QueueState {
  if (isShuffled(q)) return q
  const head = q.tracks.slice(0, q.index + 1)
  const upcoming = q.tracks.slice(q.index + 1)
  for (let i = upcoming.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]]
  }
  return { tracks: [...head, ...upcoming], index: q.index, original: q.tracks }
}

/** Restores the original order, keeping the current song playing. */
export function shuffleOff(q: QueueState): QueueState {
  if (!q.original) return q
  const playing = current(q)
  const index = playing ? q.original.findIndex((t) => t.videoId === playing.videoId) : -1
  return { tracks: q.original, index: index === -1 ? 0 : index }
}

/**
 * "Putar acak": starts on a random track with the rest shuffled after it. `original` stays the
 * list's real order, so turning shuffle off afterwards restores it.
 */
export function shuffleStart(tracks: Track[], rand: () => number = Math.random): QueueState {
  if (tracks.length === 0) return empty
  const first = Math.floor(rand() * tracks.length)
  const reordered = [tracks[first], ...tracks.slice(0, first), ...tracks.slice(first + 1)]
  return { ...shuffleOn(startQueue(reordered, 0), rand), original: tracks }
}
