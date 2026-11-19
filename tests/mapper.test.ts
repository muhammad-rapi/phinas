import { describe, expect, test } from 'vitest'
import { mapPlaylistItem, mapSongItem, sectionTracks, upsizeCover, mapVideoCard, mapNewRelease } from '../src/main/music/mapper'

describe('author fallback', () => {
  test('uses authors when artists is missing (video items)', () => {
    expect(
      mapSongItem({ id: 'y1sg-gnbJNs', title: 'Laut Kidul', authors: [{ name: 'Jeyma Monica' }] })?.artist
    ).toBe('Jeyma Monica')
  })
})

describe('sectionTracks', () => {
  const item = (id: string, title: string) => ({ id, title, artists: [{ name: 'A' }] })
  const sections = [
    { header: { title: { text: 'Quick picks' } }, contents: [item('aaaaaaaaaaa', 'One'), { title: 'no id' }] },
    { header: { title: { text: 'Trending' } }, contents: [item('bbbbbbbbbbb', 'Two'), item('ccccccccccc', 'Three')] },
    { contents: [item('ddddddddddd', 'Headerless')] }
  ]

  test('finds a section by title (case-insensitive) and maps its items', () => {
    expect(sectionTracks(sections, 'trending').map((t) => t.title)).toEqual(['Two', 'Three'])
  })

  test('drops items that cannot be mapped', () => {
    expect(sectionTracks(sections, 'Quick picks').map((t) => t.title)).toEqual(['One'])
  })

  test('applies the limit', () => {
    expect(sectionTracks(sections, 'Trending', 1)).toHaveLength(1)
  })

  test('returns an empty list for a missing section or undefined input', () => {
    expect(sectionTracks(sections, 'Nope')).toEqual([])
    expect(sectionTracks(undefined, 'Trending')).toEqual([])
  })
})

describe('upsizeCover', () => {
  test('replaces the size suffix', () => {
    expect(upsizeCover('https://lh3.googleusercontent.com/abc=w60-h60-l90-rj')).toBe(
      'https://lh3.googleusercontent.com/abc=w544-h544-l90-rj'
    )
  })
  test('leaves other urls alone', () => {
    expect(upsizeCover('https://i.ytimg.com/vi/x/hq.jpg')).toBe('https://i.ytimg.com/vi/x/hq.jpg')
  })
})

describe('mapSongItem', () => {
  const raw = {
    item_type: 'song',
    id: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    duration: { seconds: 213 },
    artists: [{ name: 'Rick Astley' }, { name: 'Guest' }],
    thumbnail: {
      contents: [
        { url: 'https://x/a=w60-h60', width: 60 },
        { url: 'https://x/a=w120-h120', width: 120 }
      ]
    }
  }

  test('maps a song', () => {
    expect(mapSongItem(raw)).toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley, Guest',
      coverUrl: 'https://x/a=w544-h544',
      durationSec: 213
    })
  })

  test('returns null without id or title', () => {
    expect(mapSongItem({ ...raw, id: undefined })).toBeNull()
    expect(mapSongItem({ ...raw, title: undefined })).toBeNull()
  })

  test('tolerates missing artists, duration and thumbnail', () => {
    expect(mapSongItem({ id: 'abcdefghijk', title: 'X' })).toEqual({
      videoId: 'abcdefghijk',
      title: 'X',
      artist: 'Unknown artist',
      coverUrl: '',
      durationSec: 0
    })
  })
})

describe('mapPlaylistItem', () => {
  test('maps a search result, taking the biggest thumbnail', () => {
    const p = mapPlaylistItem({
      id: 'VLPL123',
      title: 'Lofi mix',
      author: { name: ' Someone ' },
      thumbnails: [
        { url: 'https://x/=w60-h60', width: 60 },
        { url: 'https://x/=w226-h226', width: 226 }
      ]
    })
    expect(p).toEqual({ id: 'VLPL123', title: 'Lofi mix', author: 'Someone', coverUrl: 'https://x/=w544-h544' })
  })
  test('falls back when author or thumbnails are missing, and skips items without an id', () => {
    expect(mapPlaylistItem({ id: 'VLPL1', title: 'T' })).toEqual({ id: 'VLPL1', title: 'T', author: 'YouTube Music', coverUrl: '' })
    expect(mapPlaylistItem({ title: 'No id' })).toBeNull()
  })
})

describe('Explore cards', () => {
  const thumb = [
    { url: 'https://x/small=w60-h60', width: 60 },
    { url: 'https://x/big=w226-h226', width: 226 }
  ]
  test('a video card plays by the id in its overlay, not its browse id', () => {
    const t = mapVideoCard({
      id: 'MPED_abc',
      title: { text: 'Song (Official Video)' },
      subtitle: { text: 'Someone • 1.2M views' },
      thumbnail: thumb,
      thumbnail_overlay: { content: { endpoint: { payload: { videoId: 'abcdefghijk' } } } }
    })
    expect(t).toEqual({ videoId: 'abcdefghijk', title: 'Song (Official Video)', artist: 'Someone', coverUrl: 'https://x/big=w226-h226', durationSec: 0 })
  })
  test('podcast episodes and cards without a video id are skipped', () => {
    const podcast = { watchEndpointMusicSupportedConfigs: { watchEndpointMusicConfig: { musicVideoType: 'MUSIC_VIDEO_TYPE_PODCAST_EPISODE' } } }
    expect(mapVideoCard({ title: 'Ep 1', thumbnail_overlay: { content: { endpoint: { payload: { videoId: 'abcdefghijk', ...podcast } } } } })).toBeNull()
    expect(mapVideoCard({ id: 'MPED_x', title: 'No id' })).toBeNull()
  })
  test('a new release keeps its kind and artist line', () => {
    expect(mapNewRelease({ id: 'MPREb_1', title: { text: 'Kekasih' }, subtitle: { text: 'Single • Tereza' }, thumbnail: thumb })).toEqual({
      id: 'MPREb_1',
      title: 'Kekasih',
      author: 'Single • Tereza',
      coverUrl: 'https://x/big=w544-h544'
    })
  })
})
