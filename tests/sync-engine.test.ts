import { beforeEach, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import { SyncEngine, type Remote } from '../src/main/sync/engine'
import type { PartnerPlaylist, PlaylistWithTracks, Track } from '../src/shared/types'

const track: Track = { videoId: 'video000001', title: 'S', artist: 'A', coverUrl: '', durationSec: 1 }

class FakeRemote implements Remote {
  upserts: PlaylistWithTracks[] = []
  deletes: string[] = []
  likes: Track[][] = []
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
  }
  async deletePlaylist(id: string): Promise<void> {
    this.maybeFail()
    this.deletes.push(id)
  }
  async replaceLikes(t: Track[]): Promise<void> {
    this.maybeFail()
    this.likes.push(t)
  }
  async listPartnerPlaylists(): Promise<PartnerPlaylist[]> {
    return []
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

test('likes are replaced as a whole list', async () => {
  lib.setLiked(track, true)
  await engine.flush()
  expect(remote.likes).toEqual([[track]])
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
