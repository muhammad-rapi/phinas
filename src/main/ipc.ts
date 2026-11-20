import type { PhinasApi } from '../shared/ipc'
import type { Lyrics } from '../shared/types'
import { matchSongs } from './import/match'
import { fetchSpotifyList } from './import/spotify'
import type { LibraryHost } from './library/host'
import { fetchLyrics } from './music/lyrics'
import type { MusicSource } from './music/source'
import type { SyncEngine } from './sync/engine'
import type { SupabaseRemote } from './sync/supabase-remote'
import type { PairChannel } from './sync/realtime'
import type { SystemVolume } from './system-volume'
import type { Recommender } from './recommend/service'
import type { SettingsStore } from './settings'
import type { Updater } from './updater'
import { LEGAL_URLS } from '../shared/links'
import { withCache, type CacheStore } from './sync/cache'
import type { PresenceHub } from './sync/presence'

/** What depends on the active library; the host rebuilds it whenever another library opens. */
export interface LibraryServices {
  engine: SyncEngine | null
  recommender: Recommender
}

export interface Deps {
  /** The active local library (one per account) with its sync engine and recommender. */
  host: LibraryHost<LibraryServices>
  source: MusicSource
  coverData: (url: string) => Promise<string>
  systemVolume: SystemVolume
  proxyPort: () => number
  remote: SupabaseRemote | null
  /** Realtime channel for listen together; null when Supabase is not configured. */
  pair: PairChannel | null
  /** Friends' online state; null when Supabase is not configured. */
  presence: PresenceHub | null
  cache: CacheStore
  openExternal: (url: string) => void
  /** Tells the renderer the signed-in account changed (sign-in, sign-up, sign-out, deletion). */
  notifyAccountChanged: () => void
  /** Pushes, then pulls the account's library from the server. Never throws. */
  pullLibrary: () => Promise<void>
  lastError: { value?: string }
  settings: SettingsStore
  /** Shows or hides the notch window right away. */
  setNotchEnabled: (enabled: boolean) => void
  updater: Updater
}

export function createHandlers(d: Deps): PhinasApi {
  const requireRemote = (): SupabaseRemote => {
    if (!d.remote) throw new Error('Supabase belum dikonfigurasi (.env)')
    return d.remote
  }

  /** The remote and the signed-in user's id, or null when signed out or not configured. */
  const signedIn = async (): Promise<{ r: SupabaseRemote; uid: string } | null> => {
    if (!d.remote) return null
    // From the stored session, not the network, so the cache still works offline.
    const s = await d.remote.session()
    return s ? { r: d.remote, uid: s.userId } : null
  }

  /** Leaves every realtime channel and forgets cached social data. */
  const leaveAll = async (): Promise<void> => {
    await d.pair?.close()
    await d.presence?.close()
    d.cache.clear()
  }

  /** After sign-in or sign-up: open that account's library, pull it, then tell the renderer. */
  const enterAccount = async (r: SupabaseRemote): Promise<void> => {
    const s = await r.session()
    if (s) d.host.useAccount(s.userId)
    d.settings.set('welcomeDone', true)
    d.lastError.value = undefined
    await d.pullLibrary()
    d.notifyAccountChanged()
  }

  /** After sign-out or account deletion: back to the signed-out library. */
  const leaveAccount = (): void => {
    d.host.useGuest()
    d.lastError.value = undefined
    d.notifyAccountChanged()
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
    getUpdateStatus: async () => d.updater.status(),
    checkForUpdate: () => d.updater.check(),
    installUpdate: async () => d.updater.install(),
    getArtist: (name) => d.source.getArtist(name),
    getArtistSongs: (id) => d.source.getArtistSongs(id),
    getAlbum: (id) => d.source.getAlbum(id),
    getGenre: (params) => d.source.getGenre(params),
    streamUrl: async (id) => `http://127.0.0.1:${d.proxyPort()}/stream/${id}`,
    coverData: (url) => d.coverData(url),
    getSystemVolume: () => d.systemVolume.get(),
    setSystemVolume: (level) => d.systemVolume.set(level),
    listPlaylists: async () => d.host.library.listPlaylists(),
    getPlaylist: async (id) => d.host.library.getPlaylist(id),
    createPlaylist: async (name) => d.host.library.createPlaylist(name),
    renamePlaylist: async (id, name) => d.host.library.renamePlaylist(id, name),
    deletePlaylist: async (id) => d.host.library.deletePlaylist(id),
    addTrack: async (pid, t) => d.host.library.addTrack(pid, t),
    removeTrack: async (pid, vid) => d.host.library.removeTrack(pid, vid),
    listLikes: async () => d.host.library.listLikes(),
    setLiked: async (t, liked) => d.host.library.setLiked(t, liked),
    syncSignIn: async (email, password) => {
      const r = requireRemote()
      d.cache.clear()
      await r.signIn(email, password)
      await enterAccount(r)
    },
    syncSignOut: async () => {
      await leaveAll()
      await requireRemote().signOut()
      leaveAccount()
    },
    syncSignUp: async (input) => {
      const r = requireRemote()
      d.cache.clear()
      await r.signUp(input)
      await enterAccount(r)
    },
    myProfile: async () => {
      const s = await signedIn()
      return s ? withCache(d.cache, s.uid, 'profile', () => s.r.myProfile()) : null
    },
    updateMyProfile: async (name, scope) => {
      await requireRemote().updateMyProfile(name, scope)
      const s = await signedIn()
      if (s) await withCache(d.cache, s.uid, 'profile', () => s.r.myProfile())
    },
    getConfig: async () => {
      const s = await signedIn()
      return s ? withCache(d.cache, s.uid, 'config', () => s.r.getConfig()) : null
    },
    listFriends: async () => {
      const s = await signedIn()
      if (!s) return []
      const friends = await withCache(d.cache, s.uid, 'friends', () => s.r.listFriends())
      void d.presence
        ?.sync(s.uid, friends.map((f) => f.userId))
        .catch((e) => console.warn('[presence] sync failed:', e))
      return friends
    },
    listFriendRequests: () => requireRemote().listFriendRequests(),
    sendFriendRequest: (code) => requireRemote().sendFriendRequest(code),
    respondFriendRequest: (id, accept) => requireRemote().respondFriendRequest(id, accept),
    removeFriend: (id) => requireRemote().removeFriend(id),
    requestPartner: (id) => requireRemote().requestPartner(id),
    respondPartner: (id, accept) => requireRemote().respondPartner(id, accept),
    endPartner: (id) => requireRemote().endPartner(id),
    listMyInvites: () => requireRemote().listMyInvites(),
    createInvite: () => requireRemote().createInvite(),
    revokeInvite: (code) => requireRemote().revokeInvite(code),
    deleteAccount: async () => {
      await requireRemote().deleteAccount()
      await leaveAll()
      leaveAccount()
    },
    onlineFriends: async () => d.presence?.onlineIds() ?? [],
    setPlaylistVisibility: async (id, v) => d.host.library.setVisibility(id, v),
    listFriendPlaylists: (friendId) => requireRemote().listFriendPlaylists(friendId),
    listPublicPlaylists: () => requireRemote().listPublicPlaylists(),
    openLegal: async (page) => {
      if (!Object.hasOwn(LEGAL_URLS, page)) return
      d.openExternal(LEGAL_URLS[page])
    },
    finishWelcome: async () => d.settings.set('welcomeDone', true),
    syncStatus: async () => {
      const session = d.remote ? await d.remote.session() : null
      return {
        configured: d.remote !== null,
        signedIn: session !== null,
        email: session?.email,
        pending: d.host.library.pendingKeys().length,
        lastError: d.lastError.value,
        welcomeDone: d.settings.get('welcomeDone'),
        libraryClaimed: d.settings.get('claimedBy') !== null,
        libraryError: d.host.error ?? undefined
      }
    },
    listPartnerPlaylists: async () => requireRemote().listPartnerPlaylists(),
    recordPlay: async (rec) => {
      // History must never break playback.
      try {
        d.host.library.recordPlay(rec)
      } catch (e) {
        console.error('could not record play:', e)
      }
    },
    listRecentPlays: async (limit = 50) => d.host.library.recentPlays(Math.min(limit, 50)),
    listFavoriteArtists: async (limit = 8) => d.host.library.favoriteArtists(Math.min(limit, 12)),
    getRecommendations: () => d.host.services.recommender.forHome(),
    getAutoplay: (current, queueIds) => d.host.services.recommender.autoplay(current, queueIds),
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
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false, notAllowed: false },
    copyPartnerPlaylist: async (p) => {
      const lib = d.host.library
      const copy = lib.createPlaylist(`${p.name} (dari ${p.ownerName})`)
      for (const t of p.tracks) lib.addTrack(copy.id, t)
      return lib.getPlaylist(copy.id)!
    }
  }
}
