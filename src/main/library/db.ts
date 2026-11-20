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

function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

/** Column changes for databases created by older versions. Safe to run on every start. */
export function migrate(db: DatabaseSync): void {
  if (!hasColumn(db, 'playlists', 'visibility')) {
    db.exec("ALTER TABLE playlists ADD COLUMN visibility TEXT NOT NULL DEFAULT 'friends'")
  }
}

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON;')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  migrate(db)
  return db
}
