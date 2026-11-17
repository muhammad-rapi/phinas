import type { PhinasApi } from '../shared/ipc'
import type { Library } from './library/library'
import type { Lyrics } from '../shared/types'
import { matchSongs } from './import/match'
import { fetchSpotifyList } from './import/spotify'
import { fetchLyrics } from './music/lyrics'
import type { MusicSource } from './music/source'
import type { SyncEngine } from './sync/engine'
import type { SupabaseRemote } from './sync/supabase-remote'
import type { PairChannel } from './sync/realtime'
import type { SystemVolume } from './system-volume'
import type { Recommender } from './recommend/service'
import type { SettingsStore } from './settings'

export interface Deps {
  library: Library
  source: MusicSource
  coverData: (url: string) => Promise<string>
  systemVolume: SystemVolume
  proxyPort: () => number
  remote: SupabaseRemote | null
  /** Realtime channel for listen together; null when Supabase is not configured. */
  pair: PairChannel | null
  engine: SyncEngine | null
  lastError: { value?: string }
  recommender: Recommender
  settings: SettingsStore
  /** Shows or hides the notch window right away. */
  setNotchEnabled: (enabled: boolean) => void
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
    importSpotify: async (link) => {
      const list = await fetchSpotifyList(link)
      const { matched, missing } = await matchSongs(list.songs, (q) => d.source.search(q))
      return { name: list.name, total: list.songs.length, matched, missing }
    },
    search: (q) => d.source.search(q),
    getHomeFeed: () => d.source.getHomeFeed(),
    searchPlaylists: (q) => d.source.searchPlaylists(q),
    getPublicPlaylist: (id) => d.source.getPublicPlaylist(id),
    streamUrl: async (id) => `http://127.0.0.1:${d.proxyPort()}/stream/${id}`,
    coverData: (url) => d.coverData(url),
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
    syncSignOut: async () => {
      await d.pair?.close()
      await requireRemote().signOut()
    },
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
    recordPlay: async (rec) => {
      // History must never break playback.
      try {
        d.library.recordPlay(rec)
      } catch (e) {
        console.error('could not record play:', e)
      }
    },
    listRecentPlays: async (limit = 50) => d.library.recentPlays(Math.min(limit, 50)),
    listFavoriteArtists: async (limit = 8) => d.library.favoriteArtists(Math.min(limit, 12)),
    getRecommendations: () => d.recommender.forHome(),
    getAutoplay: (current, queueIds) => d.recommender.autoplay(current, queueIds),
    getNotchEnabled: async () => d.settings.get('notch'),
    setNotchEnabled: async (enabled) => {
      d.settings.set('notch', enabled)
      d.setNotchEnabled(enabled)
    },
    listenOpen: async () => {
      if (!d.remote || !d.pair) return null
      try {
        const info = await d.remote.pairInfo()
        if (!info) return null
        await d.pair.open(info.me, info.partnerId)
        return info
      } catch (e) {
        console.warn('[listen] could not open the channel:', e)
        return null
      }
    },
    listenClose: async () => d.pair?.close(),
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false },
    copyPartnerPlaylist: async (p) => {
      const copy = d.library.createPlaylist(`${p.name} (dari ${p.ownerName})`)
      for (const t of p.tracks) d.library.addTrack(copy.id, t)
      return d.library.getPlaylist(copy.id)!
    }
  }
}
