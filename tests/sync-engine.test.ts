import { beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import type { LibrarySnapshot } from '../src/main/library/merge'
import { engineFor, SyncEngine, type Remote } from '../src/main/sync/engine'
import type { LikeEntry, PlaylistWithTracks, Track } from '../src/shared/types'

const track: Track = { videoId: 'video000001', title: 'S', artist: 'A', coverUrl: '', durationSec: 1 }

/** Keeps a server copy like Supabase would: pushes land in it, pulls read it. */
class FakeRemote implements Remote {
  /** Who the stored session says is signed in. */
  signedIn: string | null = 'u1'
  /** Runs while pullLibrary's request is out. */
  duringPull: (() => void) | null = null
  async session(): Promise<{ userId: string } | null> {
    return this.signedIn ? { userId: this.signedIn } : null
  }
  upserts: PlaylistWithTracks[] = []
  deletes: string[] = []
  likes: LikeEntry[][] = []
  server: LibrarySnapshot = { playlists: [], likes: [] }
  failNext = false
  private maybeFail(): void {
    if (this.failNext) {
      this.failNext = false
      throw new Error('offline')
    }
  }
  async upsertPlaylist(p: PlaylistWithTracks): Promise<void> {
    this.maybeFail()
    this.upserts.push(p)
    this.server.playlists = [...this.server.playlists.filter((x) => x.id !== p.id), p]
  }
  async deletePlaylist(id: string): Promise<void> {
    this.maybeFail()
    this.deletes.push(id)
    this.server.playlists = this.server.playlists.filter((x) => x.id !== id)
  }
  async replaceLikes(l: LikeEntry[]): Promise<void> {
    this.maybeFail()
    this.likes.push(l)
    this.server.likes = l
  }
  async pullLibrary(): Promise<LibrarySnapshot> {
    this.maybeFail()
    this.duringPull?.()
    return structuredClone(this.server)
  }
}

let lib: Library
let remote: FakeRemote
let engine: SyncEngine
let n = 0

beforeEach(() => {
  n = 0
  lib = new Library(openDb(':memory:'), () => 1000 + n, () => `pl-${++n}`)
  remote = new FakeRemote()
  engine = new SyncEngine(lib, remote)
})

test('flush pushes changed playlists and clears the outbox', async () => {
  const p = lib.createPlaylist('P')
  lib.addTrack(p.id, track)
  const r = await engine.flush()
  expect(r).toEqual({ pushed: 1 })
  expect(remote.upserts).toHaveLength(1)
  expect(remote.upserts[0].tracks).toHaveLength(1)
  expect(lib.pendingKeys()).toEqual([])
})

test('a playlist deleted locally is deleted remotely', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  lib.deletePlaylist(p.id)
  await engine.flush()
  expect(remote.deletes).toEqual([p.id])
})

test('likes are replaced as a whole list, with their like times', async () => {
  lib.setLiked(track, true)
  await engine.flush()
  expect(remote.likes).toEqual([[{ ...track, likedAt: 1000 }]])
})

test('on failure the key stays queued and flush reports the error', async () => {
  const p = lib.createPlaylist('P')
  remote.failNext = true
  const r = await engine.flush()
  expect(r.error).toBe('offline')
  expect(lib.pendingKeys()).toEqual([`playlist:${p.id}`])
  expect(await engine.flush()).toEqual({ pushed: 1 })
})

test('unknown outbox keys are dropped', async () => {
  ;(lib as unknown as { enqueue(k: string): void }).enqueue('mystery:1')
  expect(await engine.flush()).toEqual({ pushed: 1 })
  expect(lib.pendingKeys()).toEqual([])
})

test('pull pushes pending changes first, then adds what only the server has', async () => {
  const p = lib.createPlaylist('Lokal')
  remote.server.playlists.push({ id: 'srv', name: 'Server', updatedAt: 5, visibility: 'friends', coverUrls: [], tracks: [track] })
  expect(await engine.pull()).toBe(true)
  expect(remote.upserts.map((x) => x.id)).toEqual([p.id])
  expect(lib.listPlaylists().map((x) => x.name).sort()).toEqual(['Lokal', 'Server'])
  expect(lib.getPlaylist('srv')!.tracks).toEqual([track])
  expect(lib.pendingKeys()).toEqual([])
})

test('a playlist deleted on another computer is removed here', async () => {
  const p = lib.createPlaylist('P')
  const keep = lib.createPlaylist('Keep')
  await engine.flush()
  // the server still has one playlist (an entirely empty answer is ignored, see mergeLibrary)
  remote.server.playlists = remote.server.playlists.filter((x) => x.id === keep.id)
  expect(await engine.pull()).toBe(true)
  expect(lib.getPlaylist(p.id)).toBeNull()
  expect(lib.getPlaylist(keep.id)).not.toBeNull()
})

test('an empty server answer does not wipe the library', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  remote.server = { playlists: [], likes: [] }
  expect(await engine.pull()).toBe(false)
  expect(lib.getPlaylist(p.id)).not.toBeNull()
})

test('a pull with nothing new reports no change', async () => {
  lib.createPlaylist('P')
  await engine.pull()
  expect(await engine.pull()).toBe(false)
})

test('a failed pull leaves the library as it was', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  remote.server.playlists = []
  remote.failNext = true
  await expect(engine.pull()).rejects.toThrow('offline')
  expect(lib.getPlaylist(p.id)).not.toBeNull()
})

describe('owner guard', () => {
  const owned = (owner: string | null, active = (): boolean => true): SyncEngine | null =>
    engineFor(lib, owner, remote, active)

  test('a library no account owns gets no engine', () => {
    expect(owned(null)).toBeNull()
    expect(engineFor(lib, 'u1', null, () => true)).toBeNull()
  })

  test('nothing is pushed or pulled while another account is signed in', async () => {
    const e = owned('u1')!
    lib.createPlaylist('P')
    remote.server.playlists.push({ id: 'srv', name: 'Server', updatedAt: 5, visibility: 'friends', coverUrls: [], tracks: [] })
    remote.signedIn = 'u2'
    expect(await e.flush()).toEqual({ pushed: 0, skipped: true })
    expect(await e.pull()).toBe(false)
    expect(remote.upserts).toEqual([])
    expect(lib.getPlaylist('srv')).toBeNull()
    expect(lib.pendingKeys()).toHaveLength(1)
  })

  test('nothing is synced when signed out', async () => {
    const e = owned('u1')!
    lib.createPlaylist('P')
    remote.signedIn = null
    expect((await e.flush()).skipped).toBe(true)
    expect(remote.upserts).toEqual([])
  })

  test('the owner signed in syncs as usual', async () => {
    const e = owned('u1')!
    lib.createPlaylist('P')
    expect(await e.flush()).toEqual({ pushed: 1 })
  })

  test('a pulled copy is discarded when the account changed while the request was out', async () => {
    const e = owned('u1')!
    remote.server.playlists.push({ id: 'srv', name: 'Server', updatedAt: 5, visibility: 'friends', coverUrls: [], tracks: [] })
    remote.duringPull = () => {
      remote.signedIn = 'u2'
    }
    expect(await e.pull()).toBe(false)
    expect(lib.getPlaylist('srv')).toBeNull()
  })

  test('an engine that is no longer the active one does nothing', async () => {
    const e = owned('u1', () => false)!
    lib.createPlaylist('P')
    expect((await e.flush()).skipped).toBe(true)
    expect(remote.upserts).toEqual([])
  })
})
