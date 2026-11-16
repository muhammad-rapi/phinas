import { beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import type { Track } from '../src/shared/types'

const t = (n: number): Track => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `Song ${n}`,
  artist: 'Artist',
  coverUrl: `https://img/${n}.jpg`,
  durationSec: 100 + n
})

let lib: Library
let clock = 1000
let ids = 0

beforeEach(() => {
  clock = 1000
  ids = 0
  lib = new Library(openDb(':memory:'), () => clock++, () => `pl-${++ids}`)
})

describe('playlists', () => {
  test('create and list, newest update first', () => {
    const a = lib.createPlaylist('A')
    const b = lib.createPlaylist('B')
    expect(lib.listPlaylists().map((p) => p.id)).toEqual([b.id, a.id])
    lib.renamePlaylist(a.id, 'A2')
    expect(lib.listPlaylists()[0]).toMatchObject({ id: a.id, name: 'A2' })
  })

  test('addTrack appends in order and ignores duplicates', () => {
    const p = lib.createPlaylist('P')
    expect(lib.addTrack(p.id, t(1))).toBe(true)
    expect(lib.addTrack(p.id, t(2))).toBe(true)
    expect(lib.addTrack(p.id, t(1))).toBe(false)
    expect(lib.getPlaylist(p.id)!.tracks.map((x) => x.title)).toEqual(['Song 1', 'Song 2'])
  })

  test('removeTrack keeps order contiguous', () => {
    const p = lib.createPlaylist('P')
    ;[1, 2, 3].forEach((n) => lib.addTrack(p.id, t(n)))
    lib.removeTrack(p.id, t(2).videoId)
    expect(lib.getPlaylist(p.id)!.tracks.map((x) => x.title)).toEqual(['Song 1', 'Song 3'])
    lib.addTrack(p.id, t(4))
    expect(lib.getPlaylist(p.id)!.tracks.map((x) => x.title)).toEqual(['Song 1', 'Song 3', 'Song 4'])
  })

  test('deletePlaylist removes it and its tracks', () => {
    const p = lib.createPlaylist('P')
    lib.addTrack(p.id, t(1))
    lib.deletePlaylist(p.id)
    expect(lib.getPlaylist(p.id)).toBeNull()
    expect(lib.listPlaylists()).toEqual([])
  })
})

describe('likes', () => {
  test('like, unlike, list newest first', () => {
    lib.setLiked(t(1), true)
    lib.setLiked(t(2), true)
    expect(lib.listLikes().map((x) => x.title)).toEqual(['Song 2', 'Song 1'])
    lib.setLiked(t(1), false)
    expect(lib.listLikes().map((x) => x.title)).toEqual(['Song 2'])
  })
})

describe('outbox', () => {
  test('mutations queue one coalesced key per playlist', () => {
    const p = lib.createPlaylist('P')
    lib.addTrack(p.id, t(1))
    lib.addTrack(p.id, t(2))
    lib.setLiked(t(1), true)
    expect(lib.pendingKeys().sort()).toEqual([`playlist:${p.id}`, 'likes'].sort())
  })

  test('clearKey removes a key', () => {
    const p = lib.createPlaylist('P')
    lib.clearKey(`playlist:${p.id}`)
    expect(lib.pendingKeys()).toEqual([])
  })

  test('deleting a playlist still queues its key', () => {
    const p = lib.createPlaylist('P')
    lib.clearKey(`playlist:${p.id}`)
    lib.deletePlaylist(p.id)
    expect(lib.pendingKeys()).toEqual([`playlist:${p.id}`])
  })
})
