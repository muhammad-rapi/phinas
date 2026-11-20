import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { FavoriteArtist, LikeEntry, PlayEntry, Playlist, PlaylistWithTracks, PlayRecord, Track } from '../../shared/types'

interface TrackRow {
  video_id: string
  title: string
  artist: string
  cover_url: string
  duration_sec: number
}

const toTrack = (r: TrackRow): Track => ({
  videoId: r.video_id,
  title: r.title,
  artist: r.artist,
  coverUrl: r.cover_url,
  durationSec: r.duration_sec
})

export class Library {
  constructor(
    private db: DatabaseSync,
    private now: () => number = Date.now,
    private newId: () => string = randomUUID
  ) {}

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const out = fn()
      this.db.exec('COMMIT')
      return out
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }

  private enqueue(key: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO outbox(key, created_at) VALUES (?, ?)')
      .run(key, this.now())
  }

  private touch(id: string): void {
    this.db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(this.now(), id)
    this.enqueue(`playlist:${id}`)
  }

  createPlaylist(name: string): Playlist {
    const p: Playlist = { id: this.newId(), name, updatedAt: this.now(), coverUrls: [] }
    this.tx(() => {
      this.db
        .prepare('INSERT INTO playlists(id, name, updated_at) VALUES (?, ?, ?)')
        .run(p.id, p.name, p.updatedAt)
      this.enqueue(`playlist:${p.id}`)
    })
    return p
  }

  renamePlaylist(id: string, name: string): void {
    this.tx(() => {
      this.db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(name, id)
      this.touch(id)
    })
  }

  deletePlaylist(id: string): void {
    this.tx(() => {
      this.db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
      this.enqueue(`playlist:${id}`)
    })
  }

  listPlaylists(): Playlist[] {
    const rows = this.db
      .prepare('SELECT id, name, updated_at FROM playlists ORDER BY updated_at DESC, rowid DESC')
      .all() as { id: string; name: string; updated_at: number }[]
    const covers = this.db
      .prepare(
        `SELECT playlist_id, cover_url FROM playlist_tracks
         WHERE position < 4 AND cover_url != '' ORDER BY playlist_id, position`
      )
      .all() as { playlist_id: string; cover_url: string }[]
    const byPlaylist = new Map<string, string[]>()
    for (const c of covers) {
      const list = byPlaylist.get(c.playlist_id) ?? []
      list.push(c.cover_url)
      byPlaylist.set(c.playlist_id, list)
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updated_at,
      coverUrls: byPlaylist.get(r.id) ?? []
    }))
  }

  getPlaylist(id: string): PlaylistWithTracks | null {
    const p = this.db.prepare('SELECT id, name, updated_at FROM playlists WHERE id = ?').get(id) as
      | { id: string; name: string; updated_at: number }
      | undefined
    if (!p) return null
    const rows = this.db
      .prepare(
        `SELECT video_id, title, artist, cover_url, duration_sec
         FROM playlist_tracks WHERE playlist_id = ? ORDER BY position`
      )
      .all(id) as unknown as TrackRow[]
    const tracks = rows.map(toTrack)
    const coverUrls = tracks
      .slice(0, 4)
      .map((t) => t.coverUrl)
      .filter(Boolean)
    return { id: p.id, name: p.name, updatedAt: p.updated_at, coverUrls, tracks }
  }

  addTrack(playlistId: string, track: Track): boolean {
    return this.tx(() => {
      const dup = this.db
        .prepare('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?')
        .get(playlistId, track.videoId)
      if (dup) return false
      const max = this.db
        .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM playlist_tracks WHERE playlist_id = ?')
        .get(playlistId) as { m: number }
      this.db
        .prepare(
          `INSERT INTO playlist_tracks(playlist_id, position, video_id, title, artist, cover_url, duration_sec)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(playlistId, max.m + 1, track.videoId, track.title, track.artist, track.coverUrl, track.durationSec)
      this.touch(playlistId)
      return true
    })
  }

  removeTrack(playlistId: string, videoId: string): void {
    this.tx(() => {
      const current = this.getPlaylist(playlistId)
      if (!current) return
      const kept = current.tracks.filter((x) => x.videoId !== videoId)
      this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId)
      const insert = this.db.prepare(
        `INSERT INTO playlist_tracks(playlist_id, position, video_id, title, artist, cover_url, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      kept.forEach((x, i) =>
        insert.run(playlistId, i, x.videoId, x.title, x.artist, x.coverUrl, x.durationSec)
      )
      this.touch(playlistId)
    })
  }

  listLikes(): Track[] {
    const rows = this.db
      .prepare(
        `SELECT video_id, title, artist, cover_url, duration_sec
         FROM liked_tracks ORDER BY liked_at DESC, rowid DESC`
      )
      .all() as unknown as TrackRow[]
    return rows.map(toTrack)
  }

  setLiked(track: Track, liked: boolean): void {
    this.tx(() => {
      if (liked) {
        this.db
          .prepare(
            `INSERT OR REPLACE INTO liked_tracks(video_id, title, artist, cover_url, duration_sec, liked_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(track.videoId, track.title, track.artist, track.coverUrl, track.durationSec, this.now())
      } else {
        this.db.prepare('DELETE FROM liked_tracks WHERE video_id = ?').run(track.videoId)
      }
      this.enqueue('likes')
    })
  }

  /** Likes with their timestamp, newest first. */
  likeEntries(): LikeEntry[] {
    const rows = this.db
      .prepare(
        `SELECT video_id, title, artist, cover_url, duration_sec, liked_at
         FROM liked_tracks ORDER BY liked_at DESC, rowid DESC`
      )
      .all() as unknown as (TrackRow & { liked_at: number })[]
    return rows.map((r) => ({ ...toTrack(r), likedAt: r.liked_at }))
  }

  /** History is local only: no outbox entry, never synced. */
  recordPlay(rec: PlayRecord, playedAt: number = this.now()): void {
    const t = rec.track
    this.db
      .prepare(
        `INSERT INTO plays(video_id, title, artist, cover_url, duration_sec, played_at, listened_sec, skipped)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        t.videoId,
        t.title,
        t.artist,
        t.coverUrl,
        t.durationSec,
        playedAt,
        Math.max(0, Math.round(rec.listenedSec)),
        rec.skipped ? 1 : 0
      )
  }

  /** Raw history rows, newest first (used to build the taste profile). */
  playEntries(limit = 2000): PlayEntry[] {
    const rows = this.db
      .prepare(
        `SELECT video_id, title, artist, cover_url, duration_sec, played_at, listened_sec, skipped
         FROM plays ORDER BY played_at DESC, id DESC LIMIT ?`
      )
      .all(limit) as unknown as (TrackRow & { played_at: number; listened_sec: number; skipped: number })[]
    return rows.map((r) => ({
      ...toTrack(r),
      playedAt: r.played_at,
      listenedSec: r.listened_sec,
      skipped: r.skipped === 1
    }))
  }

  /** Unique tracks that were really played (not skipped), most recent first. */
  recentPlays(limit = 50): Track[] {
    const rows = this.db
      .prepare(
        `SELECT video_id, title, artist, cover_url, duration_sec, MAX(played_at) AS last_at
         FROM plays WHERE skipped = 0
         GROUP BY video_id ORDER BY last_at DESC, MAX(id) DESC LIMIT ?`
      )
      .all(limit) as unknown as TrackRow[]
    return rows.map(toTrack)
  }

  /** Artists ordered by how many times their tracks were played (skips not counted). */
  topArtists(limit = 10): { artist: string; plays: number }[] {
    return this.db
      .prepare(
        `SELECT artist, COUNT(*) AS plays FROM plays WHERE skipped = 0
         GROUP BY artist ORDER BY plays DESC, MAX(played_at) DESC LIMIT ?`
      )
      .all(limit) as { artist: string; plays: number }[]
  }

  /** Play and skip counts per track. */
  /** The most played artists, each with up to 20 of their tracks (most played first). */
  favoriteArtists(limit = 8): FavoriteArtist[] {
    const tracksOf = this.db.prepare(
      `SELECT video_id, title, artist, cover_url, duration_sec FROM plays WHERE skipped = 0 AND artist = ?
       GROUP BY video_id ORDER BY COUNT(*) DESC, MAX(played_at) DESC LIMIT 20`
    )
    return this.topArtists(limit).map(({ artist, plays }) => {
      const tracks = (tracksOf.all(artist) as unknown as TrackRow[]).map(toTrack)
      return { artist, plays, coverUrl: tracks[0]?.coverUrl ?? '', tracks }
    })
  }

  trackStats(): Map<string, { plays: number; skips: number }> {
    const rows = this.db
      .prepare(
        `SELECT video_id, SUM(skipped = 0) AS plays, SUM(skipped = 1) AS skips FROM plays GROUP BY video_id`
      )
      .all() as { video_id: string; plays: number; skips: number }[]
    return new Map(rows.map((r) => [r.video_id, { plays: r.plays, skips: r.skips }]))
  }

  pendingKeys(): string[] {
    const rows = this.db.prepare('SELECT key FROM outbox ORDER BY created_at, rowid').all() as {
      key: string
    }[]
    return rows.map((r) => r.key)
  }

  clearKey(key: string): void {
    this.db.prepare('DELETE FROM outbox WHERE key = ?').run(key)
  }
}
