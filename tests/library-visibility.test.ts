import { DatabaseSync } from 'node:sqlite'
import { beforeEach, expect, test } from 'vitest'
import { migrate, openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'

let lib: Library
let clock = 1000
let ids = 0

beforeEach(() => {
  clock = 1000
  ids = 0
  lib = new Library(openDb(':memory:'), () => clock++, () => `pl-${++ids}`)
})

test('new playlists are visible to friends', () => {
  const p = lib.createPlaylist('A')
  expect(p.visibility).toBe('friends')
  expect(lib.listPlaylists()[0].visibility).toBe('friends')
  expect(lib.getPlaylist(p.id)?.visibility).toBe('friends')
})

test('setVisibility stores it, bumps updatedAt and queues a sync', () => {
  const p = lib.createPlaylist('A')
  lib.clearKey(`playlist:${p.id}`)
  lib.setVisibility(p.id, 'public')
  const got = lib.getPlaylist(p.id)!
  expect(got.visibility).toBe('public')
  expect(got.updatedAt).toBeGreaterThan(p.updatedAt)
  expect(lib.pendingKeys()).toEqual([`playlist:${p.id}`])
})

test('setVisibility rejects unknown values', () => {
  const p = lib.createPlaylist('A')
  expect(() => lib.setVisibility(p.id, 'everyone' as never)).toThrow('visibility')
})

test('migrate adds the column to an old database and defaults to friends', () => {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE playlists(id TEXT PRIMARY KEY, name TEXT NOT NULL, updated_at INTEGER NOT NULL)')
  db.exec("INSERT INTO playlists VALUES ('old', 'Old', 1)")
  migrate(db)
  migrate(db) // running twice is safe
  const row = db.prepare('SELECT visibility FROM playlists WHERE id = ?').get('old') as { visibility: string }
  expect(row.visibility).toBe('friends')
})
