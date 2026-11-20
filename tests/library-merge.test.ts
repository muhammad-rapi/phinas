import { beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import { mergeChanges, mergeLibrary, type LibrarySnapshot } from '../src/main/library/merge'
import type { LikeEntry, PlaylistWithTracks, Track } from '../src/shared/types'

const t = (n: number): Track => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `Song ${n}`,
  artist: 'Artist',
  coverUrl: `https://img/${n}.jpg`,
  durationSec: 100 + n
})
const pl = (id: string, updatedAt: number, tracks: Track[] = [], name = id): PlaylistWithTracks => ({
  id,
  name,
  updatedAt,
  visibility: 'friends',
  coverUrls: tracks.slice(0, 4).map((x) => x.coverUrl),
  tracks
})
const like = (n: number, likedAt: number): LikeEntry => ({ ...t(n), likedAt })
const snap = (playlists: PlaylistWithTracks[], likes: LikeEntry[] = []): LibrarySnapshot => ({ playlists, likes })

describe('mergeLibrary', () => {
  test('a playlist only on the server is added', () => {
    const plan = mergeLibrary(snap([]), snap([pl('a', 5)]), [])
    expect(plan.upsert.map((p) => p.id)).toEqual(['a'])
    expect(plan.remove).toEqual([])
  })

  test('the newer copy wins when both sides have the playlist', () => {
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 9, [t(1)])]), []).upsert.map((p) => p.id)).toEqual(['a'])
    expect(mergeLibrary(snap([pl('a', 9)]), snap([pl('a', 5)]), []).upsert).toEqual([])
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 5)]), []).upsert).toEqual([])
  })

  test('a pending local change wins even against a newer server copy', () => {
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 9)]), ['playlist:a']).upsert).toEqual([])
  })

  test('a local playlist missing on the server is removed unless it is pending', () => {
    expect(mergeLibrary(snap([pl('a', 5), pl('b', 5)]), snap([pl('a', 5)]), []).remove).toEqual(['b'])
    expect(mergeLibrary(snap([pl('b', 5)]), snap([]), ['playlist:b']).remove).toEqual([])
  })

  test('a playlist deleted here but not pushed yet is not brought back', () => {
    expect(mergeLibrary(snap([]), snap([pl('a', 5)]), ['playlist:a']).upsert).toEqual([])
  })

  test('the server likes win unless likes are pending', () => {
    const local = snap([], [like(1, 10)])
    const remote = snap([], [like(2, 20), like(1, 10)])
    expect(mergeLibrary(local, remote, []).likes?.map((l) => l.videoId)).toEqual([t(2).videoId, t(1).videoId])
    expect(mergeLibrary(local, remote, ['likes']).likes).toBeNull()
  })

  test('the same set of likes changes nothing', () => {
    expect(mergeLibrary(snap([], [like(1, 10)]), snap([], [like(1, 99)]), []).likes).toBeNull()
  })

  test('an empty server answer never wipes the local library', () => {
    const local = snap([pl('a', 5), pl('b', 5)], [like(1, 10)])
    const plan = mergeLibrary(local, snap([]), [])
    expect(plan).toEqual({ upsert: [], remove: [], likes: null })
    expect(mergeChanges(plan)).toBe(0)
    // likes alone are guarded too
    expect(mergeLibrary(snap([], [like(1, 10)]), snap([]), []).likes).toBeNull()
    // an empty local library has nothing to protect: nothing to do either way
    expect(mergeLibrary(snap([]), snap([]), [])).toEqual({ upsert: [], remove: [], likes: null })
  })

  test('mergeChanges counts what a plan would change', () => {
    expect(mergeChanges(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 5)]), []))).toBe(0)
    expect(mergeChanges(mergeLibrary(snap([pl('b', 5)]), snap([pl('a', 5)], [like(1, 1)]), []))).toBe(3)
  })
})

describe('Library.applyMerge', () => {
  let lib: Library
  let clock = 1000
  let ids = 0

  beforeEach(() => {
    clock = 1000
    ids = 0
    lib = new Library(openDb(':memory:'), () => clock++, () => `pl-${++ids}`)
  })

  test('writes server playlists and likes without queueing them for upload', () => {
    lib.applyMerge({ upsert: [pl('srv', 50, [t(1), t(2)], 'Dari server')], remove: [], likes: [like(3, 70), like(4, 60)] })
    expect(lib.getPlaylist('srv')).toMatchObject({ name: 'Dari server', updatedAt: 50, visibility: 'friends' })
    expect(lib.getPlaylist('srv')!.tracks.map((x) => x.videoId)).toEqual([t(1).videoId, t(2).videoId])
    expect(lib.likeEntries().map((l) => [l.videoId, l.likedAt])).toEqual([
      [t(3).videoId, 70],
      [t(4).videoId, 60]
    ])
    expect(lib.pendingKeys()).toEqual([])
  })

  test('replaces the tracks of an existing playlist and removes deleted ones', () => {
    const a = lib.createPlaylist('A')
    lib.addTrack(a.id, t(1))
    const b = lib.createPlaylist('B')
    lib.clearKey(`playlist:${a.id}`)
    lib.clearKey(`playlist:${b.id}`)
    lib.applyMerge({ upsert: [{ ...pl(a.id, 99, [t(5)], 'A baru'), visibility: 'public' }], remove: [b.id], likes: null })
    expect(lib.getPlaylist(a.id)).toMatchObject({ name: 'A baru', visibility: 'public', updatedAt: 99 })
    expect(lib.getPlaylist(a.id)!.tracks.map((x) => x.videoId)).toEqual([t(5).videoId])
    expect(lib.getPlaylist(b.id)).toBeNull()
    expect(lib.pendingKeys()).toEqual([])
  })

  test('allPlaylists returns every playlist with its tracks', () => {
    const a = lib.createPlaylist('A')
    lib.addTrack(a.id, t(1))
    expect(lib.allPlaylists().map((p) => [p.id, p.tracks.length])).toEqual([[a.id, 1]])
  })
})
