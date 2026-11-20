import type { Track } from '../../../shared/types'
import { splitArtists } from '../views'

/** The artists named in search results, in order of first appearance, without repeats (ignoring case). */
export function searchArtists(tracks: Track[], max = 6): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tracks) {
    for (const name of splitArtists(t.artist)) {
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(name)
      if (out.length === max) return out
    }
  }
  return out
}
