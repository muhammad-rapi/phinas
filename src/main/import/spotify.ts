const EMBED = 'https://open.spotify.com/embed'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

export type SpotifyKind = 'playlist' | 'album'

export interface SpotifySong {
  title: string
  artist: string
  durationSec: number
}

export interface SpotifyList {
  name: string
  songs: SpotifySong[]
}

/** Understands open.spotify.com links (with or without an intl-xx part) and spotify: URIs. */
export function parseSpotifyLink(input: string): { kind: SpotifyKind; id: string } | null {
  const text = input.trim()
  const uri = /^spotify:(playlist|album):([A-Za-z0-9]{22})$/.exec(text)
  if (uri) return { kind: uri[1] as SpotifyKind, id: uri[2] }
  const url = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album)\/([A-Za-z0-9]{22})(?:[/?#].*)?$/.exec(text)
  if (url) return { kind: url[1] as SpotifyKind, id: url[2] }
  return null
}

interface EmbedTrack {
  title?: unknown
  subtitle?: unknown
  duration?: unknown
}

function findEntity(node: unknown): { name?: unknown; trackList: EmbedTrack[] } | null {
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findEntity(v)
      if (hit) return hit
    }
    return null
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (Array.isArray(obj.trackList)) return obj as { name?: unknown; trackList: EmbedTrack[] }
    for (const v of Object.values(obj)) {
      const hit = findEntity(v)
      if (hit) return hit
    }
  }
  return null
}

/** Reads the song list out of the embed page's __NEXT_DATA__ JSON. */
export function parseEmbedPage(html: string): SpotifyList | null {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)
  if (!m) return null
  let data: unknown
  try {
    data = JSON.parse(m[1])
  } catch {
    return null
  }
  const entity = findEntity(data)
  if (!entity) return null
  const songs: SpotifySong[] = []
  for (const t of entity.trackList) {
    if (typeof t.title !== 'string' || !t.title.trim()) continue
    songs.push({
      title: t.title.trim(),
      // Spotify separates artists with a comma and a non-breaking space.
      artist: typeof t.subtitle === 'string' ? t.subtitle.replace(/ /g, ' ').trim() : '',
      durationSec: typeof t.duration === 'number' ? Math.round(t.duration / 1000) : 0
    })
  }
  return { name: typeof entity.name === 'string' && entity.name.trim() ? entity.name.trim() : 'Playlist Spotify', songs }
}

/**
 * Fetches a public playlist or album from Spotify's embed page. No account or key is needed,
 * but only public lists work, and Spotify shows just the first part of very long ones.
 */
export async function fetchSpotifyList(link: string, fetchImpl: typeof fetch = fetch): Promise<SpotifyList> {
  const parsed = parseSpotifyLink(link)
  if (!parsed) throw new Error('Link Spotify tidak dikenali. Tempel link playlist atau album dari Spotify.')
  const res = await fetchImpl(`${EMBED}/${parsed.kind}/${parsed.id}`, { headers: { 'User-Agent': USER_AGENT } })
  if (res.status === 404) throw new Error('Playlist tidak ditemukan. Pastikan statusnya publik.')
  if (!res.ok) throw new Error(`Spotify tidak bisa dibuka (kode ${res.status}).`)
  const list = parseEmbedPage(await res.text())
  if (!list || list.songs.length === 0) {
    throw new Error('Tidak ada lagu yang bisa dibaca. Playlist harus publik, bukan privat.')
  }
  return list
}
