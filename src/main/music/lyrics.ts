import type { Lyrics, LyricLine, Track } from '../../shared/types'

const LRCLIB = 'https://lrclib.net/api'
const USER_AGENT = 'Phinas/0.1 (personal music player)'

/** Parses LRC text ("[01:23.45] words") into timed lines, sorted by time. */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    if (stamps.length === 0) continue
    const text = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0
      lines.push({ timeSec: Number(m[1]) * 60 + Number(m[2]) + frac, text })
    }
  }
  return lines.sort((a, b) => a.timeSec - b.timeSec)
}

/** Strips YouTube decoration so "Artist - Song (Official Video)" matches the lyrics database. */
export function cleanTitle(title: string, artist: string): string {
  let t = title
    .replace(/[([](?:official|lyric|lyrics|audio|video|music video|mv|visuali[sz]er|hd|4k|remaster(?:ed)?)[^)\]]*[)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const prefix = new RegExp(`^${artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i')
  t = t.replace(prefix, '')
  // "Someone - Song": the part before the dash is the performer even when YouTube lists a
  // channel as the artist, so keep only the song name.
  const dash = t.match(/^[^-–—]+\s[-–—]\s+(.+)$/)
  if (dash) t = dash[1]
  return t.trim() || title
}

/** The "Someone" in a "Someone - Song" title, or null. */
export function titlePerformer(title: string): string | null {
  const m = title.match(/^([^-–—]+?)\s[-–—]\s+.+$/)
  return m ? cleanArtist(m[1]) : null
}

export function cleanArtist(artist: string): string {
  return artist.replace(/\s*-\s*Topic$/i, '').split(/\s*(?:,|&| feat\.? | ft\.? )\s*/i)[0].trim()
}

interface LrclibHit {
  syncedLyrics?: string | null
  plainLyrics?: string | null
  instrumental?: boolean
  duration?: number
}

function toLyrics(hit: LrclibHit | undefined): Lyrics | null {
  if (!hit || hit.instrumental) return null
  const synced = hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : []
  if (synced.length > 0) return { synced, plain: null }
  if (hit.plainLyrics?.trim()) return { synced: null, plain: hit.plainLyrics.trim() }
  return null
}

type Fetch = typeof fetch

/**
 * Looks lyrics up on LRCLIB (free, no key). Only the song title, artist and length are sent.
 * Returns null when nothing is found; throws on network errors so the caller can retry later.
 */
export async function fetchLyrics(track: Track, fetchImpl: Fetch = fetch): Promise<Lyrics | null> {
  const title = cleanTitle(track.title, track.artist)
  const artist = cleanArtist(track.artist)
  const headers = { 'User-Agent': USER_AGENT }

  const exact = new URLSearchParams({ track_name: title, artist_name: artist })
  if (track.durationSec > 0) exact.set('duration', String(Math.round(track.durationSec)))
  const res = await fetchImpl(`${LRCLIB}/get?${exact}`, { headers })
  if (res.ok) {
    const found = toLyrics((await res.json()) as LrclibHit)
    if (found) return found
  } else if (res.status !== 404) {
    throw new Error(`LRCLIB responded ${res.status}`)
  }

  // Fall back to a looser search and take the closest-length hit that has lyrics.
  // The performer named in the YouTube title is tried too, since the listed "artist" may be a
  // channel such as "Amazing Lyrics".
  const performer = titlePerformer(track.title)
  const names = performer && performer.toLowerCase() !== artist.toLowerCase() ? [artist, performer] : [artist]
  for (const name of names) {
    const hits = await searchHits(new URLSearchParams({ track_name: title, artist_name: name }), fetchImpl)
    const found = pickClosest(hits, track.durationSec)
    if (found) return found
  }

  // YouTube's "artist" is sometimes a channel name ("Lyrics Channel"). Search by title alone, but
  // then insist on a near-identical length so a different song with the same title is not shown.
  const byTitle = await searchHits(new URLSearchParams({ track_name: title }), fetchImpl)
  return pickClosest(byTitle, track.durationSec, MAX_TITLE_ONLY_DRIFT_SEC)
}

const MAX_TITLE_ONLY_DRIFT_SEC = 5

async function searchHits(params: URLSearchParams, fetchImpl: Fetch): Promise<LrclibHit[]> {
  const res = await fetchImpl(`${LRCLIB}/search?${params}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`LRCLIB responded ${res.status}`)
  }
  return ((await res.json()) as LrclibHit[]).filter((h) => !h.instrumental && (h.syncedLyrics || h.plainLyrics))
}

function pickClosest(hits: LrclibHit[], durationSec: number, maxDriftSec = Infinity): Lyrics | null {
  const drift = (h: LrclibHit): number => Math.abs((h.duration ?? 0) - durationSec)
  const near = hits.filter((h) => drift(h) <= maxDriftSec)
  const withSynced = near.filter((h) => h.syncedLyrics)
  const pool = withSynced.length > 0 ? withSynced : near
  pool.sort((a, b) => drift(a) - drift(b))
  return toLyrics(pool[0])
}
