import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS playlists(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_tracks(
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, position)
);
CREATE TABLE IF NOT EXISTS liked_tracks(
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  liked_at INTEGER NOT NULL
);
-- Local listening history. Never synced and never queued in the outbox.
CREATE TABLE IF NOT EXISTS plays(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  played_at INTEGER NOT NULL,
  listened_sec INTEGER NOT NULL,
  skipped INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS plays_played_at ON plays(played_at);
CREATE INDEX IF NOT EXISTS plays_video ON plays(video_id);
CREATE TABLE IF NOT EXISTS outbox(
  key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
`

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON;')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  return db
}
