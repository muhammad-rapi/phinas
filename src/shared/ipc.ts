import type { PartnerPlaylist, Playlist, PlaylistWithTracks, SyncStatus, Track } from './types'

export interface PhinasApi {
  search(query: string): Promise<Track[]>
  streamUrl(videoId: string): Promise<string>
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
}

const CHANNEL_MAP: Record<keyof PhinasApi, true> = {
  search: true,
  streamUrl: true,
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
  copyPartnerPlaylist: true
}

export const CHANNELS = Object.keys(CHANNEL_MAP) as (keyof PhinasApi)[]
