import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PartnerPlaylist, PlaylistWithTracks, Track } from '../../shared/types'
import type { Remote } from './engine'
import { FileStorage } from './file-storage'

interface TrackRow {
  video_id: string
  title: string
  artist: string
  cover_url: string
  duration_sec: number
  position?: number
}

const toRow = (t: Track): TrackRow => ({
  video_id: t.videoId,
  title: t.title,
  artist: t.artist,
  cover_url: t.coverUrl,
  duration_sec: t.durationSec
})

const fromRow = (r: TrackRow): Track => ({
  videoId: r.video_id,
  title: r.title,
  artist: r.artist,
  coverUrl: r.cover_url,
  durationSec: r.duration_sec
})

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

export class SupabaseRemote implements Remote {
  private sb: SupabaseClient

  constructor(url: string, anonKey: string, sessionFile: string) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storage: new FileStorage(sessionFile) }
    })
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut()
  }

  async session(): Promise<{ email?: string } | null> {
    const { data } = await this.sb.auth.getSession()
    return data.session ? { email: data.session.user.email } : null
  }

  private async me(): Promise<string> {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) throw new Error('Not signed in')
    return data.user.id
  }

  async upsertPlaylist(p: PlaylistWithTracks): Promise<void> {
    await this.me()
    check(
      await this.sb
        .from('playlists')
        .upsert({ id: p.id, name: p.name, updated_at: new Date(p.updatedAt).toISOString() })
    )
    check(await this.sb.from('playlist_tracks').delete().eq('playlist_id', p.id))
    if (p.tracks.length) {
      check(
        await this.sb
          .from('playlist_tracks')
          .insert(p.tracks.map((t, i) => ({ playlist_id: p.id, position: i, ...toRow(t) })))
      )
    }
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.me()
    check(await this.sb.from('playlists').delete().eq('id', id))
  }

  async replaceLikes(tracks: Track[]): Promise<void> {
    const me = await this.me()
    check(await this.sb.from('liked_tracks').delete().eq('owner_id', me))
    if (tracks.length) check(await this.sb.from('liked_tracks').insert(tracks.map(toRow)))
  }

  async listPartnerPlaylists(): Promise<PartnerPlaylist[]> {
    const me = await this.me()
    const rows = check(
      await this.sb
        .from('playlists')
        .select(
          'id, name, updated_at, profiles(display_name), playlist_tracks(position, video_id, title, artist, cover_url, duration_sec)'
        )
        .neq('owner_id', me)
        .order('updated_at', { ascending: false })
    ) as unknown as {
      id: string
      name: string
      updated_at: string
      profiles: { display_name: string } | null
      playlist_tracks: TrackRow[]
    }[]
    return rows.map((r) => {
      const tracks = [...r.playlist_tracks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(fromRow)
      return {
        id: r.id,
        name: r.name,
        updatedAt: new Date(r.updated_at).getTime(),
        ownerName: r.profiles?.display_name ?? 'Pasangan',
        coverUrls: tracks
          .slice(0, 4)
          .map((t) => t.coverUrl)
          .filter(Boolean),
        tracks
      }
    })
  }
}
