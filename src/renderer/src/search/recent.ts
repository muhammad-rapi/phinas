import type { Track } from '../../../shared/types'

const MAX_RECENT = 8
const STORAGE_KEY = 'phinas.recentSearches'

/** Something the user searched for: typed text, or a song they picked from the results. */
export type RecentEntry = { kind: 'query'; text: string } | { kind: 'track'; track: Track }

const norm = (s: string): string => s.trim().toLowerCase()

export const entryKey = (e: RecentEntry): string => (e.kind === 'track' ? `t:${e.track.videoId}` : `q:${norm(e.text)}`)

export function addRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  if (entry.kind === 'query' && !entry.text.trim()) return list
  const normalised: RecentEntry = entry.kind === 'query' ? { kind: 'query', text: entry.text.trim() } : entry
  return [normalised, ...list.filter((x) => entryKey(x) !== entryKey(normalised))].slice(0, MAX_RECENT)
}

export function removeRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  return list.filter((x) => entryKey(x) !== entryKey(entry))
}

/** Drops a typed query (used when the user then picks a song: the song replaces the text). */
export function removeQuery(list: RecentEntry[], text: string): RecentEntry[] {
  return removeRecent(list, { kind: 'query', text })
}

function isTrack(x: unknown): x is Track {
  const t = x as Track
  return !!t && typeof t.videoId === 'string' && typeof t.title === 'string' && typeof t.artist === 'string'
}

export function loadRecent(): RecentEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    const out: RecentEntry[] = []
    for (const x of parsed) {
      // Older versions stored plain strings.
      if (typeof x === 'string') out.push({ kind: 'query', text: x })
      else if (x?.kind === 'query' && typeof x.text === 'string') out.push({ kind: 'query', text: x.text })
      else if (x?.kind === 'track' && isTrack(x.track)) out.push({ kind: 'track', track: x.track })
    }
    return out
  } catch {
    return []
  }
}

export function saveRecent(list: RecentEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: history just will not persist */
  }
}
