import type { Track } from '../../shared/types'

export interface RawSong {
  id?: string
  title?: string
  duration?: { seconds: number }
  artists?: { name: string }[]
  thumbnail?: { contents: { url: string; width: number }[] } | null
}

export const upsizeCover = (url: string): string => url.replace(/=w\d+-h\d+/, '=w544-h544')

export function mapSongItem(raw: RawSong): Track | null {
  if (!raw.id || !raw.title) return null
  const thumbs = raw.thumbnail?.contents ?? []
  const best = thumbs.reduce<{ url: string; width: number } | null>(
    (a, b) => (!a || b.width > a.width ? b : a),
    null
  )
  const artists = raw.artists?.map((a) => a.name).filter(Boolean) ?? []
  return {
    videoId: raw.id,
    title: raw.title,
    artist: artists.length ? artists.join(', ') : 'Unknown artist',
    coverUrl: best ? upsizeCover(best.url) : '',
    durationSec: raw.duration?.seconds ?? 0
  }
}
