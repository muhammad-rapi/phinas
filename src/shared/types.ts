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
  /** What is trending now in the user's region. */
  trending: Track[]
  /** Personalised-looking quick picks from the anonymous home feed. */
  picks: Track[]
}

export interface Playlist {
  id: string
  name: string
  updatedAt: number
  /** Cover art of the first (up to) 4 tracks, used for the playlist thumbnail. */
  coverUrls: string[]
}

export interface PlaylistWithTracks extends Playlist {
  tracks: Track[]
}

export interface PartnerPlaylist extends PlaylistWithTracks {
  ownerName: string
}

export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email?: string
  pending: number
  lastError?: string
}

/** One finished listen of a track, as stored in the local history. */
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
  /** The app's current theme, so the notch looks like the app. */
  theme: 'dynamic' | 'dark' | 'light'
  accent: string
  accentText: string
  gradTop: string
}

/** Who we can listen together with. There are only two accounts, so the partner is the other profile. */
export interface ListenInfo {
  me: string
  partnerId: string
  partnerName: string
}

/** Live state of the realtime channel, so the renderer can catch up on events it missed. */
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
}
