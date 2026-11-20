export interface Track {
  videoId: string
  title: string
  artist: string
  coverUrl: string
  durationSec: number
}

export interface LyricLine {
  timeSec: number
  text: string
}

/** Either timed lines (karaoke-style) or plain text; null when neither exists. */
export interface Lyrics {
  synced: LyricLine[] | null
  plain: string | null
}

/** A playlist from YouTube Music's public catalogue (not one of ours). */
export interface PublicPlaylist {
  id: string
  title: string
  author: string
  coverUrl: string
}

export interface PublicPlaylistDetail extends PublicPlaylist {
  tracks: Track[]
}

/** An artist page from YouTube Music. */
export interface ArtistDetail {
  id: string
  name: string
  photoUrl: string
  /** Their top songs, most popular first (the full list comes from getArtistSongs). */
  songs: Track[]
  /** Albums, then singles and EPs. `author` holds the kind and year (e.g. "Album • 2021"). */
  releases: PublicPlaylist[]
}

/** A Spotify playlist or album matched against YouTube Music. */
export interface ImportResult {
  name: string
  /** How many songs Spotify listed. */
  total: number
  matched: Track[]
  /** "Title - Artist" of songs that were not found on YouTube Music. */
  missing: string[]
}

export interface HomeFeed {
  /** What is trending now in the user's region (YouTube Music's chart, refreshed by YouTube about weekly). */
  trending: Track[]
  /** The full trending chart as a public playlist id, when YouTube links one. */
  trendingId?: string
  /** Personalised-looking quick picks from the anonymous home feed. */
  picks: Track[]
  /** YouTube Music's moods and genres for the region. */
  genres: Genre[]
  /** New albums and singles (open with getAlbum). */
  releases: PublicPlaylist[]
  /** New music videos, played as audio like any track. */
  videos: Track[]
}

/** A mood or genre from YouTube Music's Explore page. */
export interface Genre {
  title: string
  /** Opaque browse params; pass back to getGenre. */
  params: string
}

/** A mood or genre page: shelves of playlists. */
export interface GenrePage {
  /** Only playlist and album shelves; `album` says which (they open differently). */
  shelves: { title: string; album: boolean; playlists: PublicPlaylist[] }[]
}

/** Who can see a playlist: only me, my friends, or every Phinas user. */
export type Visibility = 'private' | 'friends' | 'public'

export interface Playlist {
  id: string
  name: string
  updatedAt: number
  /** Cover art of the first (up to) 4 tracks, used for the playlist thumbnail. */
  coverUrls: string[]
  visibility: Visibility
}

export interface PlaylistWithTracks extends Playlist {
  tracks: Track[]
}

/** Someone else's playlist (a friend's, the partner's, or a public one). */
export interface PartnerPlaylist extends PlaylistWithTracks {
  ownerId: string
  ownerName: string
}

/** Who may start Listen Together with me. */
export type ListenScope = 'friends' | 'partner' | 'off'

export interface MyProfile {
  id: string
  displayName: string
  role: 'user' | 'admin'
  disabled: boolean
  /** Short code friends type to add me, e.g. PHN-7K2Q9M. */
  friendCode: string
  listenScope: ListenScope
  /** Codes I can still create; null for admins (no limit). */
  invitesLeft: number | null
}

export interface Friend {
  friendshipId: string
  userId: string
  name: string
  isPartner: boolean
  /** A pending partner request on this friendship, from my point of view. */
  partnerRequest: 'incoming' | 'outgoing' | null
  /** Both scopes and the global switch allow Listen Together. */
  canListen: boolean
}

export interface FriendRequest {
  friendshipId: string
  userId: string
  name: string
  incoming: boolean
}

export interface InviteCode {
  code: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  usedByName: string | null
  revoked: boolean
}

export interface AppConfig {
  listenTogetherEnabled: boolean
  registrationOpen: boolean
  inviteQuota: number
}

export interface SignUpInput {
  email: string
  password: string
  displayName: string
  inviteCode: string
  acceptedTerms: boolean
}

export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email?: string
  pending: number
  lastError?: string
  /** The welcome screen was answered on this computer. */
  welcomeDone: boolean
  /** An account took this computer's pre-account library, so signed out shows an empty one. */
  libraryClaimed: boolean
  /** Why the last library switch failed; the previous library stayed open. */
  libraryError?: string
}

/** One finished listen of a track, as stored in the local history. */
/** An artist from the play history, for "Artis favoritmu". */
export interface FavoriteArtist {
  artist: string
  /** Plays of all their tracks, skips not counted. */
  plays: number
  /** Cover of their most played track (there is no artist photo). */
  coverUrl: string
  /** Their tracks, most played first. */
  tracks: Track[]
}

export interface PlayRecord {
  track: Track
  listenedSec: number
  /** True when the user moved on before the track counted as played. */
  skipped: boolean
}

/** A history row: the track plus when it was played. */
export interface PlayEntry extends Track {
  playedAt: number
  listenedSec: number
  skipped: boolean
}

/** A liked track with the time it was liked (used to weigh taste by age). */
export interface LikeEntry extends Track {
  likedAt: number
}

/** Home "Pilihan untukmu": ranked tracks, or none when there is no taste data yet. */
export interface Recommendations {
  personalized: boolean
  tracks: Track[]
}

/** Commands any window can send to the player. The main window is the only one that runs them. */
export type PlayerCommand = 'toggle' | 'next' | 'prev' | 'like' | 'volumeUp' | 'volumeDown' | 'mute' | 'shuffle' | 'repeat' | 'focusSearch'

/** What the notch overlay needs to draw itself. */
export interface NotchState {
  track: Track | null
  playing: boolean
  time: number
  duration: number
  liked: boolean
  /** The app's resolved mode. The notch stays a dark pill in both; it only takes the accent. */
  theme: 'day' | 'night'
  /** The accent made for a dark surface (the Malam accent), and the text colour on it. */
  accent: string
  onAccent: string
}

/** Who we listen together with by default: the partner, when Listen Together is allowed with them. */
export interface ListenInfo {
  me: string
  partnerId: string
  partnerName: string
}

/** Live state of the realtime channel, so the renderer can catch up on events it missed. */
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
  /** The server refused the channel (switch off, scope, not friends). No retry until reopened. */
  notAllowed: boolean
}

/** The app update, as the updater sees it. */
export interface UpdateStatus {
  /** idle: up to date or not checked yet; available: a newer version can be downloaded;
   *  downloading/ready: Windows fetches it in the background, then installs on restart. */
  state: 'idle' | 'available' | 'downloading' | 'ready'
  current: string
  latest?: string
  /** The installer (or release page) for this platform. */
  url?: string
  /** 0-100 while downloading. */
  progress?: number
}
