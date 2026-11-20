import type { AppConfig, ArtistDetail, FavoriteArtist, Friend, FriendRequest, GenrePage, InviteCode, UpdateStatus, ListenInfo, ListenScope, ListenStatus, MyProfile, NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SignUpInput, SyncStatus, Track, Visibility } from './types'
import type { LegalPage } from './links'
import type { SyncMessage } from './sync/protocol'

export interface PhinasApi {
  search(query: string): Promise<Track[]>
  getHomeFeed(): Promise<HomeFeed>
  /** Public playlists matching the search text. */
  searchPlaylists(query: string): Promise<PublicPlaylist[]>
  /** One public playlist with its songs (the first page, about 100). */
  getPublicPlaylist(id: string): Promise<PublicPlaylistDetail>
  /** The app update status (current version, newer version if any). */
  getUpdateStatus(): Promise<UpdateStatus>
  /** Checks GitHub for a newer version now. */
  checkForUpdate(): Promise<UpdateStatus>
  /** Windows: restart and install the downloaded update. Mac: open the new installer's download. */
  installUpdate(): Promise<void>
  /** An artist's page, found by name. */
  getArtist(name: string): Promise<ArtistDetail>
  /** All of an artist's songs (up to 100). Slower: the artist page loads first. */
  getArtistSongs(id: string): Promise<Track[]>
  /** An album or single (browse id from an artist page). */
  getAlbum(id: string): Promise<PublicPlaylistDetail>
  /** A mood or genre page (params from the home feed). */
  getGenre(params: string): Promise<GenrePage>
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
  /** Registers with an invite code; signs in on success. Errors carry `phinas:<code>`. */
  syncSignUp(input: SignUpInput): Promise<void>
  /** Null when not signed in or Supabase is not configured. Falls back to the cache offline. */
  myProfile(): Promise<MyProfile | null>
  /** Null leaves a field unchanged. */
  updateMyProfile(displayName: string | null, listenScope: ListenScope | null): Promise<void>
  /** Null when not signed in. Falls back to the cache offline. */
  getConfig(): Promise<AppConfig | null>
  /** Accepted friends, partner first. Falls back to the cache offline. */
  listFriends(): Promise<Friend[]>
  listFriendRequests(): Promise<FriendRequest[]>
  sendFriendRequest(friendCode: string): Promise<void>
  respondFriendRequest(friendshipId: string, accept: boolean): Promise<void>
  removeFriend(friendshipId: string): Promise<void>
  requestPartner(friendshipId: string): Promise<void>
  respondPartner(friendshipId: string, accept: boolean): Promise<void>
  endPartner(friendshipId: string): Promise<void>
  listMyInvites(): Promise<InviteCode[]>
  createInvite(): Promise<string>
  revokeInvite(code: string): Promise<void>
  /** Deletes the account and everything in it on the server, then signs out. Local data stays. */
  deleteAccount(): Promise<void>
  /** Ids of friends who have Phinas open right now. */
  onlineFriends(): Promise<string[]>
  setPlaylistVisibility(id: string, visibility: Visibility): Promise<void>
  /** Playlists of one friend, or of every friend. */
  listFriendPlaylists(friendId?: string): Promise<PartnerPlaylist[]>
  /** Public playlists of every other user. */
  listPublicPlaylists(): Promise<PartnerPlaylist[]>
  /** Opens the terms or privacy page in the browser. */
  openLegal(page: LegalPage): Promise<void>
  /** The partner's playlists (Berdua tab). Renamed in the redesign. */
  listPartnerPlaylists(): Promise<PartnerPlaylist[]>
  copyPartnerPlaylist(playlist: PartnerPlaylist): Promise<Playlist>
  /** Writes one history row. Local only. */
  recordPlay(rec: PlayRecord): Promise<void>
  /** Unique tracks played recently, newest first. */
  listRecentPlays(limit?: number): Promise<Track[]>
  /** The most played artists, for Home's "Artis favoritmu". */
  listFavoriteArtists(limit?: number): Promise<FavoriteArtist[]>
  /** Ranked picks from the taste profile, or `personalized: false` when there is no history yet. */
  getRecommendations(): Promise<Recommendations>
  /** Up to 10 tracks to append when the queue runs out. Empty on any failure. */
  getAutoplay(current: Track, queueIds: string[]): Promise<Track[]>
  getNotchEnabled(): Promise<boolean>
  setNotchEnabled(enabled: boolean): Promise<void>
  /** Joins the pair channel. Null when not signed in, Supabase is not configured, or there is no partner yet. */
  listenOpen(): Promise<ListenInfo | null>
  listenClose(): Promise<void>
  /** Current connection and partner presence, for catching up on events fired before we subscribed. */
  listenStatus(): Promise<ListenStatus>
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
  /** Main window: the notch was shown or hidden (from Profil, the player bar or the notch itself). Returns an unsubscribe. */
  onNotchEnabled(cb: (enabled: boolean) => void): () => void
  /** Sends a listen-together message to the partner. */
  listenSend(msg: SyncMessage): void
  /** A raw message from the partner (validate it with `parseMessage`). Returns an unsubscribe. */
  onListenMessage(cb: (raw: unknown) => void): () => void
  onListenPresence(cb: (here: boolean) => void): () => void
  onListenConnection(cb: (up: boolean) => void): () => void
  /** The set of online friends changed. Returns an unsubscribe. */
  onFriendsOnline(cb: (ids: string[]) => void): () => void
  /** The update status changed (found, downloading, ready). Returns an unsubscribe. */
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
  /** The partner invited us: the main process shows a system notification when the window is not focused. */
  notifyListenInvite(partnerName: string): void
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
  getUpdateStatus: true,
  checkForUpdate: true,
  installUpdate: true,
  getArtist: true,
  getArtistSongs: true,
  getAlbum: true,
  getGenre: true,
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
  syncSignUp: true,
  myProfile: true,
  updateMyProfile: true,
  getConfig: true,
  listFriends: true,
  listFriendRequests: true,
  sendFriendRequest: true,
  respondFriendRequest: true,
  removeFriend: true,
  requestPartner: true,
  respondPartner: true,
  endPartner: true,
  listMyInvites: true,
  createInvite: true,
  revokeInvite: true,
  deleteAccount: true,
  onlineFriends: true,
  setPlaylistVisibility: true,
  listFriendPlaylists: true,
  listPublicPlaylists: true,
  openLegal: true,
  listPartnerPlaylists: true,
  copyPartnerPlaylist: true,
  recordPlay: true,
  listRecentPlays: true,
  listFavoriteArtists: true,
  getRecommendations: true,
  getAutoplay: true,
  getNotchEnabled: true,
  setNotchEnabled: true,
  listenOpen: true,
  listenClose: true,
  listenStatus: true
}

export const CHANNELS = Object.keys(CHANNEL_MAP) as (keyof PhinasApi)[]
