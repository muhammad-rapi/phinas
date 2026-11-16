import type { PhinasApi } from '../shared/ipc'
import type { Library } from './library/library'
import type { Lyrics } from '../shared/types'
import { fetchLyrics } from './music/lyrics'
import type { MusicSource } from './music/source'
import type { SyncEngine } from './sync/engine'
import type { SupabaseRemote } from './sync/supabase-remote'
import type { SystemVolume } from './system-volume'

export interface Deps {
  library: Library
  source: MusicSource
  coverData: (url: string) => Promise<string>
  systemVolume: SystemVolume
  windowControl: (action: 'minimize' | 'toggleFullscreen' | 'state') => boolean
  proxyPort: () => number
  remote: SupabaseRemote | null
  engine: SyncEngine | null
  lastError: { value?: string }
}

export function createHandlers(d: Deps): PhinasApi {
  const requireRemote = (): SupabaseRemote => {
    if (!d.remote) throw new Error('Supabase belum dikonfigurasi (.env)')
    return d.remote
  }

  // Answers (including "no lyrics") are cached for the session; network failures are not.
  const lyricsCache = new Map<string, Lyrics | null>()

  return {
    getLyrics: async (track) => {
      if (lyricsCache.has(track.videoId)) return lyricsCache.get(track.videoId) ?? null
      const found = await fetchLyrics(track)
      lyricsCache.set(track.videoId, found)
      return found
    },
    search: (q) => d.source.search(q),
    getHomeFeed: () => d.source.getHomeFeed(),
    streamUrl: async (id) => `http://127.0.0.1:${d.proxyPort()}/stream/${id}`,
    coverData: (url) => d.coverData(url),
    windowControl: async (action) => d.windowControl(action),
    getSystemVolume: () => d.systemVolume.get(),
    setSystemVolume: (level) => d.systemVolume.set(level),
    listPlaylists: async () => d.library.listPlaylists(),
    getPlaylist: async (id) => d.library.getPlaylist(id),
    createPlaylist: async (name) => d.library.createPlaylist(name),
    renamePlaylist: async (id, name) => d.library.renamePlaylist(id, name),
    deletePlaylist: async (id) => d.library.deletePlaylist(id),
    addTrack: async (pid, t) => d.library.addTrack(pid, t),
    removeTrack: async (pid, vid) => d.library.removeTrack(pid, vid),
    listLikes: async () => d.library.listLikes(),
    setLiked: async (t, liked) => d.library.setLiked(t, liked),
    syncSignIn: async (email, password) => {
      await requireRemote().signIn(email, password)
      d.lastError.value = undefined
      void d.engine?.flush()
    },
    syncSignOut: async () => requireRemote().signOut(),
    syncStatus: async () => {
      const session = d.remote ? await d.remote.session() : null
      return {
        configured: d.remote !== null,
        signedIn: session !== null,
        email: session?.email,
        pending: d.library.pendingKeys().length,
        lastError: d.lastError.value
      }
    },
    listPartnerPlaylists: async () => requireRemote().listPartnerPlaylists(),
    copyPartnerPlaylist: async (p) => {
      const copy = d.library.createPlaylist(`${p.name} (dari ${p.ownerName})`)
      for (const t of p.tracks) d.library.addTrack(copy.id, t)
      return d.library.getPlaylist(copy.id)!
    }
  }
}
