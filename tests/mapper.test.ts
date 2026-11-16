import { describe, expect, test } from 'vitest'
import { mapSongItem, sectionTracks, upsizeCover } from '../src/main/music/mapper'

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
