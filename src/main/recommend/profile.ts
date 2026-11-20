import type { LikeEntry, PlayEntry, Track } from '../../shared/types'

export const LIKE_WEIGHT = 3
export const PLAY_WEIGHT = 1
export const SKIP_WEIGHT = -2
/** After this many days a signal counts half as much. */
export const HALF_LIFE_DAYS = 30
/** How many of the latest real plays are treated as "recently played" and not suggested again. */
export const RECENT_WINDOW = 40

const DAY_MS = 24 * 60 * 60 * 1000

export interface Profile {
  /** Taste per artist (lower-case name). Negative means the user keeps skipping them. */
  artists: Map<string, number>
  /** Decayed skip count per track. */
  skips: Map<string, number>
  /** Every track the user has liked, played or skipped. */
  known: Set<string>
  /** The latest plays that finished or counted as played, most recent first. */
  recent: string[]
  likedIds: Set<string>
}

/** "A, B" on a collaboration becomes two artists. */
export function artistKeys(artist: string): string[] {
  return artist
    .split(/\s*(?:,|&| feat\.? | ft\.? )\s*/i)
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
}

const decay = (ageMs: number): number => 0.5 ** (Math.max(0, ageMs) / (HALF_LIFE_DAYS * DAY_MS))

/**
 * Likes count +3, a played track +1, a skipped track -2. Older signals fade with a half life
 * of 30 days so taste follows what the user listens to now.
 */
export function buildProfile(likes: LikeEntry[], plays: PlayEntry[], now: number): Profile {
  const artists = new Map<string, number>()
  const skips = new Map<string, number>()
  const known = new Set<string>()
  const likedIds = new Set<string>()
  const add = (artist: string, w: number): void => {
    for (const k of artistKeys(artist)) artists.set(k, (artists.get(k) ?? 0) + w)
  }

  for (const l of likes) {
    known.add(l.videoId)
    likedIds.add(l.videoId)
    add(l.artist, LIKE_WEIGHT * decay(now - l.likedAt))
  }
  for (const p of plays) {
    known.add(p.videoId)
    const d = decay(now - p.playedAt)
    if (p.skipped) {
      add(p.artist, SKIP_WEIGHT * d)
      skips.set(p.videoId, (skips.get(p.videoId) ?? 0) + d)
    } else {
      add(p.artist, PLAY_WEIGHT * d)
    }
  }

  const recent: string[] = []
  const seen = new Set<string>()
  for (const p of [...plays].sort((a, b) => b.playedAt - a.playedAt)) {
    if (p.skipped || seen.has(p.videoId)) continue
    seen.add(p.videoId)
    recent.push(p.videoId)
    if (recent.length >= RECENT_WINDOW) break
  }
  return { artists, skips, known, recent, likedIds }
}

export const hasTaste = (p: Profile): boolean => p.known.size > 0

/** Tracks to ask YouTube for "related" songs: recent plays and likes by the best-liked artists. */
export function pickSeeds(profile: Profile, likes: LikeEntry[], plays: PlayEntry[], n: number): Track[] {
  const pool = new Map<string, Track>()
  for (const p of plays) if (!p.skipped && !pool.has(p.videoId)) pool.set(p.videoId, p)
  for (const l of likes) if (!pool.has(l.videoId)) pool.set(l.videoId, l)
  const weight = (t: Track): number => Math.max(0, ...artistKeys(t.artist).map((a) => profile.artists.get(a) ?? 0))
  const order = [...pool.values()].sort((a, b) => weight(b) - weight(a))
  const out: Track[] = []
  const usedArtists = new Set<string>()
  for (const t of order) {
    const key = artistKeys(t.artist)[0] ?? t.artist
    if (usedArtists.has(key)) continue
    usedArtists.add(key)
    out.push(t)
    if (out.length >= n) break
  }
  return out
}
