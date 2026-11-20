import type { Track } from '../../shared/types'
import { artistKeys, type Profile } from './profile'

/** At most this many tracks per artist in one ranked list (counting every artist on a track). */
export const MAX_PER_ARTIST = 3
const SKIP_PENALTY = 4
/** Taste is squashed (log) and capped so a heavily played artist cannot bury everything else. */
const TASTE_CAP = 2
/** YouTube's own relevance order is worth up to this much, a bit more than the strongest taste. */
const POSITION_WEIGHT = 2.5

export interface RankOptions {
  limit?: number
  /** Overrides MAX_PER_ARTIST. */
  maxPerArtist?: number
  /** Songs already in play (by title): other versions of them are dropped. */
  excludeTitles?: string[]
}

/**
 * The song's title without decorations, to spot versions of the same song:
 * "Let Down (Remastered)", "Let Down - Live" and "let down" all give "let down".
 */
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[([{].*?[)\]}]/g, ' ')
    .replace(/\s[-–—|]\s.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function score(t: Track, index: number, total: number, profile: Profile): number {
  const raw = artistKeys(t.artist).reduce((sum, a) => sum + (profile.artists.get(a) ?? 0), 0)
  // log1p: 1 play ≈ 0.7, 10 plays ≈ 2.4 (capped at 2). Disliked artists keep their full penalty.
  const taste = raw > 0 ? Math.min(Math.log1p(raw), TASTE_CAP) : raw
  // Candidates arrive roughly in YouTube's own order of relevance.
  const position = total > 1 ? 1 - index / (total - 1) : 1
  return taste + POSITION_WEIGHT * position - SKIP_PENALTY * (profile.skips.get(t.videoId) ?? 0)
}

/**
 * Orders candidates for the user.
 *  - Duplicates, other versions of one song, excluded and recently played tracks are dropped.
 *  - Liked artists rise (mildly), skipped tracks fall.
 *  - Two tracks in a row never share an artist, and no artist appears more than MAX_PER_ARTIST times.
 *    Every artist on a track counts: "A & B" blocks both A and B.
 */
export function rank(
  candidates: Track[],
  profile: Profile,
  exclude: ReadonlySet<string> = new Set(),
  opts: RankOptions = {}
): Track[] {
  const recent = new Set(profile.recent)
  const seen = new Set<string>()
  const titles = new Set((opts.excludeTitles ?? []).map(titleKey).filter(Boolean))
  const pool: Track[] = []
  for (const t of candidates) {
    if (seen.has(t.videoId) || exclude.has(t.videoId) || recent.has(t.videoId)) continue
    // One version of each song: covers, live takes and remasters of a title already chosen are skipped.
    const key = titleKey(t.title)
    if (key && titles.has(key)) continue
    seen.add(t.videoId)
    if (key) titles.add(key)
    pool.push(t)
  }

  const scored = pool
    .map((t, i) => ({ t, s: score(t, i, pool.length, profile), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.t)

  const limit = opts.limit ?? scored.length
  const perArtist = opts.maxPerArtist ?? MAX_PER_ARTIST
  const out: Track[] = []
  const used = new Map<string, number>()
  const keys = (t: Track): string[] => {
    const k = artistKeys(t.artist)
    return k.length ? k : [t.artist.toLowerCase()]
  }
  let previous: string[] = []
  for (const t of scored) {
    if (out.length >= limit) break
    const k = keys(t)
    if (k.some((a) => previous.includes(a) || (used.get(a) ?? 0) >= perArtist)) continue
    out.push(t)
    for (const a of k) used.set(a, (used.get(a) ?? 0) + 1)
    previous = k
  }
  // A track held back only for sitting next to its artist can still fill a gap later on.
  if (out.length < limit) {
    for (const t of scored) {
      if (out.length >= limit) break
      if (out.includes(t)) continue
      const k = keys(t)
      if (k.some((a) => (used.get(a) ?? 0) >= perArtist)) continue
      // Insert at the first spot whose neighbours share no artist with it.
      const at = out.findIndex((_, i) => {
        const before = i > 0 ? keys(out[i - 1]) : []
        const after = keys(out[i])
        return !k.some((a) => before.includes(a) || after.includes(a))
      })
      const tailOk = !k.some((a) => keys(out[out.length - 1] ?? t).includes(a)) || out.length === 0
      if (at === -1 && !tailOk) continue
      if (at === -1) out.push(t)
      else out.splice(at, 0, t)
      for (const a of k) used.set(a, (used.get(a) ?? 0) + 1)
    }
  }
  return out
}
