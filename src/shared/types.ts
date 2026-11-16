export interface Track {
  videoId: string
  title: string
  artist: string
  coverUrl: string
  durationSec: number
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
