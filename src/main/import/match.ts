import type { Track } from '../../shared/types'
import type { SpotifySong } from './spotify'

/** Lowercase, no accents, no bracketed extras like "(Remastered)", only letters and digits. */
export const normalise = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Picks the YouTube Music result that is the same song as `wanted`, or null if none is.
 * The title must match; artist and length then decide between versions.
 */
export function pickMatch(wanted: SpotifySong, candidates: Track[]): Track | null {
  const title = normalise(wanted.title)
  if (!title) return null
  const artists = wanted.artist
    .split(',')
    .map(normalise)
    .filter(Boolean)
  let best: { track: Track; score: number } | null = null
  for (const c of candidates) {
    const ct = normalise(c.title)
    if (!(ct.includes(title) || (ct.length > 2 && title.includes(ct)))) continue
    let score = ct === title ? 3 : 2
    const ca = normalise(c.artist)
    if (artists.some((a) => ca.includes(a) || a.includes(ca))) score += 2
    if (wanted.durationSec > 0 && c.durationSec > 0) {
      const drift = Math.abs(wanted.durationSec - c.durationSec)
      if (drift <= 6) score += 1.5
      else if (drift <= 15) score += 0.5
      else score -= 1
    }
    if (!best || score > best.score) best = { track: c, score }
  }
  return best ? best.track : null
}

export interface MatchOutcome {
  matched: Track[]
  /** "Title - Artist" of songs that were not found on YouTube Music. */
  missing: string[]
}

/** Finds each song on YouTube Music, a few at a time, keeping the original order. */
export async function matchSongs(
  songs: SpotifySong[],
  search: (query: string) => Promise<Track[]>,
  concurrency = 4
): Promise<MatchOutcome> {
  const results: (Track | null)[] = new Array(songs.length).fill(null)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < songs.length) {
      const i = next++
      const song = songs[i]
      try {
        const first = song.artist.split(',')[0]?.trim() ?? ''
        results[i] = pickMatch(song, await search(`${song.title} ${first}`.trim()))
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, songs.length) }, worker))

  const matched: Track[] = []
  const missing: string[] = []
  const seen = new Set<string>()
  songs.forEach((s, i) => {
    const t = results[i]
    if (!t) missing.push(s.artist ? `${s.title} - ${s.artist}` : s.title)
    else if (!seen.has(t.videoId)) {
      seen.add(t.videoId)
      matched.push(t)
    }
  })
  return { matched, missing }
}
