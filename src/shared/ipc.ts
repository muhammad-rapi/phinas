import type { NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SyncStatus, Track } from './types'

export interface PhinasApi {
  search(query: string): Promise<Track[]>
  getHomeFeed(): Promise<HomeFeed>
  /** Public playlists matching the search text. */
  searchPlaylists(query: string): Promise<PublicPlaylist[]>
  /** One public playlist with its songs (the first page, about 100). */
  getPublicPlaylist(id: string): Promise<PublicPlaylistDetail>
  streamUrl(videoId: string): Promise<string>
  /** Lyrics from LRCLIB, or null when the song has none. Rejects on network errors. */
  getLyrics(track: Track): Promise<Lyrics | null>
  /** Reads a public Spotify playlist or album link and finds its songs on YouTube Music. */
  importSpotify(link: string): Promise<ImportResult>
  /** Cover art as a same-origin data URL (readable by canvas for the Dynamic theme). */
  coverData(url: string): Promise<string>
  /** OS output volume 0-1, or null when this platform is not supported. */
  getSystemVolume(): Promise<number | null>
  setSystemVolume(level: number): Promise<void>
  listPlaylists(): Promise<Playlist[]>
  getPlaylist(id: string): Promise<PlaylistWithTracks | null>
  createPlaylist(name: string): Promise<Playlist>
  renamePlaylist(id: string, name: string): Promise<void>
  deletePlaylist(id: string): Promise<void>
  addTrack(playlistId: string, track: Track): Promise<boolean>
  removeTrack(playlistId: string, videoId: string): Promise<void>
  listLikes(): Promise<Track[]>
  setLiked(track: Track, liked: boolean): Promise<void>
  syncSignIn(email: string, password: string): Promise<void>
  syncSignOut(): Promise<void>
  syncStatus(): Promise<SyncStatus>
  listPartnerPlaylists(): Promise<PartnerPlaylist[]>
  copyPartnerPlaylist(playlist: PartnerPlaylist): Promise<Playlist>
  /** Writes one history row. Local only. */
  recordPlay(rec: PlayRecord): Promise<void>
  /** Unique tracks played recently, newest first. */
  listRecentPlays(limit?: number): Promise<Track[]>
  /** Ranked picks from the taste profile, or `personalized: false` when there is no history yet. */
  getRecommendations(): Promise<Recommendations>
  /** Up to 10 tracks to append when the queue runs out. Empty on any failure. */
  getAutoplay(current: Track, queueIds: string[]): Promise<Track[]>
  getNotchEnabled(): Promise<boolean>
  setNotchEnabled(enabled: boolean): Promise<void>
}

/** Event channels (not request/response). Implemented in the preload script. */
export interface PhinasEvents {
  /** Main window: a command from a global shortcut, media key or the notch. Returns an unsubscribe. */
  onPlayerCommand(cb: (cmd: PlayerCommand) => void): () => void
  /** Main window: tells the notch what is playing. */
  pushNotchState(state: NotchState): void
  /** Notch window: receives player state. Returns an unsubscribe. */
  onNotchState(cb: (state: NotchState) => void): () => void
  /** Notch window: asks the main window to run a command. */
  sendPlayerCommand(cmd: PlayerCommand): void
  /** Notch window: jump to a position in the current track (seconds). */
  sendSeek(sec: number): void
  /** Main window: the notch asked to seek. Returns an unsubscribe. */
  onPlayerSeek(cb: (sec: number) => void): () => void
  /** Notch window: a playlist was changed, so the main window should reload its library. */
  notifyLibraryChanged(): void
  /** Main window: the notch changed the library. Returns an unsubscribe. */
  onLibraryChanged(cb: () => void): () => void
  /** Notch window: expanded or compact, so the main process can resize the window. */
  setNotchExpanded(expanded: boolean): void
  /** Notch window: where the pill sits (set once by the main process). */
  onNotchLayout(cb: (layout: NotchLayout) => void): () => void
}

export interface NotchLayout {
  /** True on a Mac with a camera notch: the pill merges with it. */
  hasNotch: boolean
  /** Width of the physical notch in px (0 without one). */
  notchWidth: number
  /** Height of the menu bar / notch area in px. */
  barHeight: number
  /** Pill size when idle and when open, in px. */
  compact: { w: number; h: number }
  expanded: { w: number; h: number }
  /** Transparent margin around the pill (room for its shadow). */
  pad: number
}

const CHANNEL_MAP: Record<keyof PhinasApi, true> = {
  search: true,
  getHomeFeed: true,
  searchPlaylists: true,
  getPublicPlaylist: true,
  streamUrl: true,
  getLyrics: true,
  importSpotify: true,
  coverData: true,
  getSystemVolume: true,
  setSystemVolume: true,
  listPlaylists: true,
  getPlaylist: true,
  createPlaylist: true,
  renamePlaylist: true,
  deletePlaylist: true,
  addTrack: true,
  removeTrack: true,
  listLikes: true,
  setLiked: true,
  syncSignIn: true,
  syncSignOut: true,
  syncStatus: true,
  listPartnerPlaylists: true,
  copyPartnerPlaylist: true,
  recordPlay: true,
  listRecentPlays: true,
  getRecommendations: true,
  getAutoplay: true,
  getNotchEnabled: true,
  setNotchEnabled: true
}

export const CHANNELS = Object.keys(CHANNEL_MAP) as (keyof PhinasApi)[]
