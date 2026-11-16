import { describe, expect, test, vi } from 'vitest'
import { matchSongs, normalise, pickMatch } from '../src/main/import/match'
import { fetchSpotifyList, parseEmbedPage, parseSpotifyLink } from '../src/main/import/spotify'
import type { Track } from '../src/shared/types'

const ID = '37i9dQZF1DXcBWIGoYBM5M'

describe('parseSpotifyLink', () => {
  test('reads playlist and album links, with tracking parameters and country paths', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/playlist/${ID}?si=abc123`)).toEqual({ kind: 'playlist', id: ID })
    expect(parseSpotifyLink(`https://open.spotify.com/intl-id/album/${ID}`)).toEqual({ kind: 'album', id: ID })
    expect(parseSpotifyLink(`spotify:playlist:${ID}`)).toEqual({ kind: 'playlist', id: ID })
    expect(parseSpotifyLink(`  https://open.spotify.com/playlist/${ID}  `)?.id).toBe(ID)
  })
  test('rejects everything else', () => {
    expect(parseSpotifyLink('https://example.com/playlist/' + ID)).toBeNull()
    expect(parseSpotifyLink('https://open.spotify.com/track/' + ID)).toBeNull()
    expect(parseSpotifyLink('not a link')).toBeNull()
  })
})

const page = (entity: unknown): string =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } })}</script></html>`

describe('parseEmbedPage', () => {
  test('returns the name and songs, tidying the artist separator', () => {
    const list = parseEmbedPage(
      page({
        name: 'My Mix',
        trackList: [
          { title: 'Song A', subtitle: 'Ann, Bob', duration: 200_400 },
          { title: '  ', subtitle: 'skipped' },
          { title: 'Song B', subtitle: 'Cy', duration: 61_000 }
        ]
      })
    )
    expect(list).toEqual({
      name: 'My Mix',
      songs: [
        { title: 'Song A', artist: 'Ann, Bob', durationSec: 200 },
        { title: 'Song B', artist: 'Cy', durationSec: 61 }
      ]
    })
  })
  test('null when the page has no song data', () => {
    expect(parseEmbedPage('<html>nothing</html>')).toBeNull()
    expect(parseEmbedPage('<script id="__NEXT_DATA__" type="application/json">{oops</script>')).toBeNull()
  })
})

describe('fetchSpotifyList', () => {
  const ok = (body: string): Response => ({ ok: true, status: 200, text: async () => body }) as Response
  test('asks the embed page for the right list', async () => {
    const f = vi.fn().mockResolvedValue(ok(page({ name: 'X', trackList: [{ title: 'T', subtitle: 'A', duration: 1000 }] })))
    const list = await fetchSpotifyList(`https://open.spotify.com/playlist/${ID}`, f as unknown as typeof fetch)
    expect(list.songs).toHaveLength(1)
    expect(String(f.mock.calls[0][0])).toBe(`https://open.spotify.com/embed/playlist/${ID}`)
  })
  test('clear errors for a bad link, a missing list and an empty page', async () => {
    await expect(fetchSpotifyList('nope')).rejects.toThrow(/tidak dikenali/)
    const notFound = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(fetchSpotifyList(`https://open.spotify.com/playlist/${ID}`, notFound as unknown as typeof fetch)).rejects.toThrow(/publik/)
    const empty = vi.fn().mockResolvedValue(ok('<html></html>'))
    await expect(fetchSpotifyList(`https://open.spotify.com/playlist/${ID}`, empty as unknown as typeof fetch)).rejects.toThrow(/publik/)
  })
})

const track = (videoId: string, title: string, artist: string, durationSec: number): Track => ({
  videoId,
  title,
  artist,
  coverUrl: '',
  durationSec
})

describe('normalise', () => {
  test('ignores case, accents, punctuation and bracketed extras', () => {
    expect(normalise('Beyoncé - Halo (Remastered 2020)')).toBe('beyonce halo')
  })
})

describe('pickMatch', () => {
  const wanted = { title: 'Halo', artist: 'Beyoncé', durationSec: 261 }
  test('prefers the right artist and length over a cover with the same title', () => {
    const pick = pickMatch(wanted, [
      track('cover000001', 'Halo', 'Some Cover Band', 200),
      track('right000001', 'Halo', 'Beyoncé', 262)
    ])
    expect(pick?.videoId).toBe('right000001')
  })
  test('null when no title matches', () => {
    expect(pickMatch(wanted, [track('other000001', 'Something Else', 'Beyoncé', 261)])).toBeNull()
  })
  test('accepts a title with extra words, such as a version label', () => {
    expect(pickMatch(wanted, [track('v0000000001', 'Halo - Live', 'Beyoncé', 265)])?.videoId).toBe('v0000000001')
  })
})

describe('matchSongs', () => {
  test('keeps order, skips duplicates and reports what was not found', async () => {
    const songs = [
      { title: 'One', artist: 'A', durationSec: 100 },
      { title: 'Two', artist: 'B', durationSec: 100 },
      { title: 'One', artist: 'A', durationSec: 100 },
      { title: 'Ghost', artist: 'C', durationSec: 100 }
    ]
    const search = vi.fn(async (q: string) => {
      if (q.startsWith('One')) return [track('one00000001', 'One', 'A', 100)]
      if (q.startsWith('Two')) return [track('two00000001', 'Two', 'B', 100)]
      return []
    })
    const out = await matchSongs(songs, search, 2)
    expect(out.matched.map((t) => t.videoId)).toEqual(['one00000001', 'two00000001'])
    expect(out.missing).toEqual(['Ghost - C'])
  })
  test('a failing search counts as not found instead of failing the import', async () => {
    const out = await matchSongs([{ title: 'X', artist: 'Y', durationSec: 1 }], async () => {
      throw new Error('offline')
    })
    expect(out.missing).toEqual(['X - Y'])
  })
})
