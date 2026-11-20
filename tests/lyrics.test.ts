import { describe, expect, test, vi } from 'vitest'
import { cleanArtist, cleanTitle, fetchLyrics, parseLrc } from '../src/main/music/lyrics'
import { activeLine } from '../src/renderer/src/lyrics/active'

const track = { videoId: 'v', title: 'Amnesia (Official Video)', artist: 'Al Ghazali - Topic', coverUrl: '', durationSec: 200 }

describe('parseLrc', () => {
  test('reads timestamps and text, sorted', () => {
    const lines = parseLrc('[00:12.50] second\n[00:01.00]first\nnot a line')
    expect(lines).toEqual([
      { timeSec: 1, text: 'first' },
      { timeSec: 12.5, text: 'second' }
    ])
  })
  test('a line with several stamps repeats', () => {
    expect(parseLrc('[00:05.00][01:05.00]chorus').map((l) => l.timeSec)).toEqual([5, 65])
  })
  test('keeps empty instrumental lines', () => {
    expect(parseLrc('[00:03.00]')).toEqual([{ timeSec: 3, text: '' }])
  })
})

describe('cleaning', () => {
  test('drops video decoration and the artist prefix', () => {
    expect(cleanTitle('Al Ghazali - Amnesia (Official Music Video)', 'Al Ghazali')).toBe('Amnesia')
    expect(cleanTitle('Song [Lyrics]', 'X')).toBe('Song')
  })
  test('drops "Someone - " even when the listed artist is a channel name', () => {
    expect(cleanTitle('Al Ghazali - Amnesia (Lyrics)', 'Amazing Lyrics')).toBe('Amnesia')
  })
  test('keeps real parentheses', () => {
    expect(cleanTitle('Song (feat. Someone)', 'X')).toBe('Song (feat. Someone)')
  })
  test('artist: no Topic suffix, first artist only', () => {
    expect(cleanArtist('Al Ghazali - Topic')).toBe('Al Ghazali')
    expect(cleanArtist('Ade Govinda, Gloria Jessica')).toBe('Ade Govinda')
  })
})

describe('fetchLyrics', () => {
  const ok = (body: unknown): Response => ({ ok: true, status: 200, json: async () => body }) as Response
  const status = (s: number): Response => ({ ok: false, status: s, json: async () => ({}) }) as Response

  test('uses synced lyrics from the exact match', async () => {
    const f = vi.fn().mockResolvedValue(ok({ syncedLyrics: '[00:01.00]hi' }))
    const r = await fetchLyrics(track, f as unknown as typeof fetch)
    expect(r?.synced).toEqual([{ timeSec: 1, text: 'hi' }])
    expect(String(f.mock.calls[0][0])).toContain('track_name=Amnesia')
  })
  test('falls back to search, preferring synced and closest duration', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(status(404))
      .mockResolvedValueOnce(
        ok([
          { plainLyrics: 'plain only', duration: 200 },
          { syncedLyrics: '[00:01.00]far', duration: 300 },
          { syncedLyrics: '[00:01.00]near', duration: 201 }
        ])
      )
    const r = await fetchLyrics(track, f as unknown as typeof fetch)
    expect(r?.synced?.[0].text).toBe('near')
  })
  test('the performer in the title is searched as an artist when the channel name fails', async () => {
    const channelTrack = { ...track, title: 'Al Ghazali - Amnesia (Lyrics)', artist: 'Amazing Lyrics', durationSec: 217 }
    const f = vi
      .fn()
      .mockResolvedValueOnce(status(404)) // exact
      .mockResolvedValueOnce(ok([])) // channel as artist
      .mockResolvedValueOnce(ok([{ syncedLyrics: '[00:01.00]found', duration: 219 }])) // performer
    const r = await fetchLyrics(channelTrack, f as unknown as typeof fetch)
    expect(r?.synced?.[0].text).toBe('found')
    expect(decodeURIComponent(String(f.mock.calls[2][0]))).toContain('artist_name=Al+Ghazali')
  })
  test('a channel-name artist falls back to a title-only search with a tight duration check', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(status(404)) // exact
      .mockResolvedValueOnce(ok([])) // title + artist
      .mockResolvedValueOnce(
        ok([
          { syncedLyrics: '[00:01.00]other song', duration: 260 },
          { syncedLyrics: '[00:01.00]right song', duration: 202 }
        ])
      )
    const r = await fetchLyrics(track, f as unknown as typeof fetch)
    expect(r?.synced?.[0].text).toBe('right song')
    expect(String(f.mock.calls[2][0])).not.toContain('artist_name')
  })
  test('title-only hits with a different length are rejected', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(status(404))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([{ syncedLyrics: '[00:01.00]x', duration: 260 }]))
    expect(await fetchLyrics(track, f as unknown as typeof fetch)).toBeNull()
  })
  test('plain lyrics when nothing is synced', async () => {
    const f = vi.fn().mockResolvedValue(ok({ plainLyrics: ' la la ' }))
    expect(await fetchLyrics(track, f as unknown as typeof fetch)).toEqual({ synced: null, plain: 'la la' })
  })
  test('null when nothing found; throws on server error', async () => {
    const f404 = vi.fn().mockResolvedValue(status(404))
    expect(await fetchLyrics(track, f404 as unknown as typeof fetch)).toBeNull()
    const f500 = vi.fn().mockResolvedValue(status(500))
    await expect(fetchLyrics(track, f500 as unknown as typeof fetch)).rejects.toThrow()
  })
  test('instrumentals have no lyrics', async () => {
    const f = vi.fn().mockResolvedValue(ok({ instrumental: true }))
    f.mockResolvedValueOnce(ok({ instrumental: true })).mockResolvedValue(ok([]))
    expect(await fetchLyrics(track, f as unknown as typeof fetch)).toBeNull()
  })
})

describe('activeLine', () => {
  const lines = [1, 5, 9].map((t) => ({ timeSec: t, text: String(t) }))
  test('finds the current line', () => {
    expect(activeLine(lines, 0)).toBe(-1)
    expect(activeLine(lines, 1)).toBe(0)
    expect(activeLine(lines, 8.9)).toBe(1)
    expect(activeLine(lines, 100)).toBe(2)
  })
})
