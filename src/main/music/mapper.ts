import type { PublicPlaylist, Track } from '../../shared/types'

export interface RawSong {
  id?: string
  title?: string
  duration?: { seconds: number }
  artists?: { name: string }[]
  /** Video items (e.g. in Trending) list the uploader here instead of `artists`. */
  authors?: { name: string }[]
  thumbnail?: { contents: { url: string; width: number }[] } | null
}

/** An item of the "up next" panel (PlaylistPanelVideo). Its shape differs from search results. */
export interface RawPanelItem {
  video_id?: string
  title?: { text?: string } | string
  duration?: { seconds: number }
  artists?: { name: string }[]
  author?: string
  thumbnail?: { url: string; width: number }[]
}

export interface RawPlaylistItem {
  id?: string
  title?: string
  author?: { name?: string }
  /** e.g. "Playlist • Someone • 120 songs" */
  subtitle?: { text?: string }
  thumbnails?: { url: string; width: number }[]
}

export interface RawSection {
  header?: { title?: { text?: string } }
  contents?: RawSong[]
}

/** Tracks from the section with the given title (case-insensitive), skipping unmappable items. */
export function sectionTracks(sections: RawSection[] | undefined, title: string, limit = 20): Track[] {
  const wanted = title.trim().toLowerCase()
  const section = sections?.find((s) => s.header?.title?.text?.trim().toLowerCase() === wanted)
  return (section?.contents ?? [])
    .map(mapSongItem)
    .filter((t): t is Track => t !== null)
    .slice(0, limit)
}

export const upsizeCover = (url: string): string => url.replace(/=w\d+-h\d+/, '=w544-h544')

/** A playlist from search results, or null if it has no id or title. */
export function mapPlaylistItem(raw: RawPlaylistItem): PublicPlaylist | null {
  if (!raw.id || !raw.title) return null
  const best = (raw.thumbnails ?? []).reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  return {
    id: raw.id,
    title: raw.title,
    author: raw.author?.name?.trim() || 'YouTube Music',
    coverUrl: best ? upsizeCover(best.url) : ''
  }
}

export function mapSongItem(raw: RawSong): Track | null {
  if (!raw.id || !raw.title) return null
  const thumbs = raw.thumbnail?.contents ?? []
  const best = thumbs.reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  const artists = (raw.artists ?? raw.authors ?? []).map((a) => a.name).filter(Boolean)
  return {
    videoId: raw.id,
    title: raw.title,
    artist: artists.length ? artists.join(', ') : 'Unknown artist',
    coverUrl: best ? upsizeCover(best.url) : '',
    durationSec: raw.duration?.seconds ?? 0
  }
}

export function mapPanelItem(raw: RawPanelItem): Track | null {
  const title = typeof raw.title === 'string' ? raw.title : raw.title?.text
  if (!raw.video_id || !title) return null
  const best = (raw.thumbnail ?? []).reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  const artists = (raw.artists ?? []).map((a) => a.name).filter(Boolean)
  return {
    videoId: raw.video_id,
    title,
    artist: artists.length ? artists.join(', ') : raw.author?.trim() || 'Unknown artist',
    coverUrl: best ? upsizeCover(best.url) : '',
    durationSec: raw.duration?.seconds ?? 0
  }
}

/** An album or single card on an artist page (MusicTwoRowItem). */
export interface RawTwoRowItem {
  id?: string
  /** "playlist", "album", "song", "video", "artist", ... */
  item_type?: string
  title?: { text?: string } | string
  subtitle?: { text?: string }
  year?: string
  artists?: { name: string }[]
  author?: { name?: string }
  /** The play button; on video cards it holds the real video id. */
  thumbnail_overlay?: { content?: { endpoint?: { payload?: { videoId?: string; watchEndpointMusicSupportedConfigs?: { watchEndpointMusicConfig?: { musicVideoType?: string } } } } } }
  /** A list on artist pages; wrapped in `{ contents }` on genre pages. */
  thumbnail?: { url: string; width: number }[] | { contents?: { url: string; width: number }[] }
}

const thumbList = (t: RawTwoRowItem['thumbnail']): { url: string; width: number }[] =>
  Array.isArray(t) ? t : (t?.contents ?? [])

/** An album or single as a playlist-like card, or null without an id or title. */
export function mapReleaseItem(raw: RawTwoRowItem, kind: string): PublicPlaylist | null {
  const title = typeof raw.title === 'string' ? raw.title : raw.title?.text
  if (!raw.id || !title) return null
  const best = thumbList(raw.thumbnail).reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  const year = raw.year?.trim() || raw.subtitle?.text?.match(/\b(19|20)\d{2}\b/)?.[0]
  return { id: raw.id, title, author: year ? `${kind} • ${year}` : kind, coverUrl: best ? upsizeCover(best.url) : '' }
}

/** Album tracks come without artist or cover: borrow the album's. */
export function fillAlbumTrack(t: Track, artist: string, coverUrl: string): Track {
  return {
    ...t,
    artist: t.artist === 'Unknown artist' && artist ? artist : t.artist,
    coverUrl: t.coverUrl || coverUrl
  }
}

/** A mood or genre button from the Explore page, or null without browse params. */
export function mapGenreButton(raw: { button_text?: string; endpoint?: { payload?: { params?: string } } }): { title: string; params: string } | null {
  const title = raw.button_text?.trim()
  const params = raw.endpoint?.payload?.params
  return title && params ? { title, params } : null
}

/** A playlist card on a genre page. Its id carries the "VL" browse prefix, which playlist ids do not. */
export function mapGenrePlaylist(raw: RawTwoRowItem): PublicPlaylist | null {
  const title = typeof raw.title === 'string' ? raw.title : raw.title?.text
  if (!raw.id || !title) return null
  const best = thumbList(raw.thumbnail).reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  // "Playlist • YouTube Music" -> "YouTube Music"
  const author = raw.subtitle?.text?.split('•').pop()?.trim() || 'YouTube Music'
  return { id: raw.id.replace(/^VL/, ''), title, author, coverUrl: best ? upsizeCover(best.url) : '' }
}

/** An Explore "new music videos" card as a playable track. Podcast episodes and cards without a video id give null. */
export function mapVideoCard(raw: RawTwoRowItem): Track | null {
  const title = typeof raw.title === 'string' ? raw.title : raw.title?.text
  const watch = raw.thumbnail_overlay?.content?.endpoint?.payload
  const videoId = watch?.videoId
  if (!videoId || !title) return null
  if (watch?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType === 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE') return null
  const best = thumbList(raw.thumbnail).reduce<{ url: string; width: number } | null>((a, b) => (!a || b.width > a.width ? b : a), null)
  const artists = (raw.artists ?? []).map((a) => a.name).filter(Boolean)
  // Subtitle: "Artist • 1.2M views" (or "7 min • Artist"): fall back to its non-numeric part.
  const fromSubtitle = raw.subtitle?.text?.split('•').map((x) => x.trim()).find((x) => x && !/\d/.test(x))
  return {
    videoId,
    title,
    artist: artists.length ? artists.join(', ') : raw.author?.name?.trim() || fromSubtitle || 'Unknown artist',
    coverUrl: best?.url ?? '',
    durationSec: 0
  }
}

/** An Explore "new albums & singles" card. `author` keeps YouTube's subtitle ("Single • Artist"). */
export function mapNewRelease(raw: RawTwoRowItem): PublicPlaylist | null {
  const title = typeof raw.title === 'string' ? raw.title : raw.title?.text
  if (!raw.id || !title) return null
  const best = thumbList(raw.thumbnail).reduce<{ url: string; width: number } | null>((a, b) => (!a || b.width > a.width ? b : a), null)
  return { id: raw.id, title, author: raw.subtitle?.text?.trim() || 'Rilis baru', coverUrl: best ? upsizeCover(best.url) : '' }
}
