import type { Track } from '../../shared/types'
import { artistKeys, type Profile } from './profile'

export const MAX_CONSECUTIVE_ARTIST = 2
const SKIP_PENALTY = 4
const LIKED_ARTIST_CAP = 8

export interface RankOptions {
  limit?: number
}

function score(t: Track, index: number, total: number, profile: Profile): number {
  const taste = artistKeys(t.artist).reduce((sum, a) => sum + (profile.artists.get(a) ?? 0), 0)
  // Candidates arrive roughly in YouTube's own order of relevance: keep a mild preference for that.
  const position = total > 1 ? 1 - index / (total - 1) : 1
  return Math.min(taste, LIKED_ARTIST_CAP) + position - SKIP_PENALTY * (profile.skips.get(t.videoId) ?? 0)
}

/**
 * Orders candidates for the user.
 *  - Duplicates, excluded tracks and tracks played recently are dropped.
 *  - Liked artists rise, skipped tracks fall.
 *  - Never more than 2 tracks in a row by the same artist.
 */
export function rank(
  candidates: Track[],
  profile: Profile,
  exclude: ReadonlySet<string> = new Set(),
  opts: RankOptions = {}
): Track[] {
  const recent = new Set(profile.recent)
  const seen = new Set<string>()
  const pool: Track[] = []
  for (const t of candidates) {
    if (seen.has(t.videoId) || exclude.has(t.videoId) || recent.has(t.videoId)) continue
    seen.add(t.videoId)
    pool.push(t)
  }

  const scored = pool
    .map((t, i) => ({ t, s: score(t, i, pool.length, profile), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t)

  const limit = opts.limit ?? scored.length
  const out: Track[] = []
  const remaining = [...scored]
  const lead = (t: Track): string => artistKeys(t.artist)[0] ?? t.artist.toLowerCase()
  while (out.length < limit && remaining.length) {
    const last = out[out.length - 1]
    const beforeLast = out[out.length - 2]
    const blocked =
      last && beforeLast && lead(last) === lead(beforeLast) ? lead(last) : null
    const at = remaining.findIndex((t) => lead(t) !== blocked)
    // Only one artist left: stop instead of breaking the variety rule.
    if (at === -1) break
    out.push(remaining.splice(at, 1)[0])
  }
  return out
}
