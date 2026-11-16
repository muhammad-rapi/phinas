import { describe, expect, test } from 'vitest'
import { mapSongItem, upsizeCover } from '../src/main/music/mapper'

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
