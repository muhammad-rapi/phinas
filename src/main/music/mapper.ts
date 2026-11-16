import type { Track } from '../../shared/types'

export interface RawSong {
  id?: string
  title?: string
  duration?: { seconds: number }
  artists?: { name: string }[]
  /** Video items (e.g. in Trending) list the uploader here instead of `artists`. */
  authors?: { name: string }[]
  thumbnail?: { contents: { url: string; width: number }[] } | null
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
