import { Innertube } from 'youtubei.js'
import type { HomeFeed, PublicPlaylist, PublicPlaylistDetail, Track } from '../../shared/types'
import { mapPlaylistItem, mapSongItem, sectionTracks, type RawPlaylistItem, type RawSection, type RawSong } from './mapper'

export interface MusicSource {
  search(query: string): Promise<Track[]>
  /** `fresh` starts a new YouTube session first (used after a URL was rejected). */
  getStreamUrl(videoId: string, fresh?: boolean): Promise<string>
  getHomeFeed(): Promise<HomeFeed>
  searchPlaylists(query: string): Promise<PublicPlaylist[]>
  getPublicPlaylist(id: string): Promise<PublicPlaylistDetail>
}

const HOME_TTL_MS = 10 * 60 * 1000

/**
 * Verified 2026-11-16 against live YouTube: only VISIONOS serves the whole file.
 * IOS and ANDROID_VR return 403 for any range after the first 1 MiB (they need a PO token),
 * and YTMUSIC/ANDROID/WEB return no usable URL. Do not add those back as fallbacks: a stream
 * that dies after the first minute is worse than a clear "cannot play" message.
 */
const CLIENTS = ['VISIONOS'] as const

export class YoutubeMusicSource implements MusicSource {
  private yt?: Promise<Innertube>
  private home?: { at: number; feed: HomeFeed }

  /** `location` is a 2-letter country code (e.g. "ID") that decides what is trending. */
  constructor(private location?: string) {}

  private client(): Promise<Innertube> {
    if (!this.yt) {
      this.yt = Innertube.create({ retrieve_player: true, location: this.location }).catch((e) => {
        this.yt = undefined
        throw e
      })
    }
    return this.yt
  }

  async search(query: string): Promise<Track[]> {
    const yt = await this.client()
    const res = await yt.music.search(query, { type: 'song' })
    const items = (res.songs?.contents ?? []) as unknown as RawSong[]
    return items.map(mapSongItem).filter((t): t is Track => t !== null)
  }

  async searchPlaylists(query: string): Promise<PublicPlaylist[]> {
    const yt = await this.client()
    const res = await yt.music.search(query, { type: 'playlist' })
    const items = (res.playlists?.contents ?? []) as unknown as RawPlaylistItem[]
    return items.map(mapPlaylistItem).filter((p): p is PublicPlaylist => p !== null)
  }

  async getPublicPlaylist(id: string): Promise<PublicPlaylistDetail> {
    const yt = await this.client()
    const pl = await yt.music.getPlaylist(id)
    const tracks = ((pl.items ?? []) as unknown as RawSong[]).map(mapSongItem).filter((t): t is Track => t !== null)
    const header = pl.header as unknown as {
      title?: { text?: string }
      strapline_text_one?: { text?: string }
      thumbnail?: { contents?: { url: string; width: number }[] }
    } | undefined
    const asItem = mapPlaylistItem({
      id,
      title: header?.title?.text,
      author: { name: header?.strapline_text_one?.text },
      thumbnails: header?.thumbnail?.contents
    })
    return {
      id,
      title: asItem?.title ?? 'Playlist',
      author: asItem?.author ?? 'YouTube Music',
      coverUrl: asItem?.coverUrl || tracks[0]?.coverUrl || '',
      tracks
    }
  }

  async getHomeFeed(): Promise<HomeFeed> {
    if (this.home && Date.now() - this.home.at < HOME_TTL_MS) return this.home.feed
    const yt = await this.client()
    // Each part is independent: if one request fails the other still shows.
    const [explore, home] = await Promise.allSettled([yt.music.getExplore(), yt.music.getHomeFeed()])
    const feed: HomeFeed = {
      trending:
        explore.status === 'fulfilled'
          ? sectionTracks(explore.value.sections as unknown as RawSection[], 'Trending')
          : [],
      picks:
        home.status === 'fulfilled'
          ? sectionTracks(home.value.sections as unknown as RawSection[], 'Quick picks')
          : []
    }
    if (feed.trending.length || feed.picks.length) this.home = { at: Date.now(), feed }
    return feed
  }

  async getStreamUrl(videoId: string, fresh = false): Promise<string> {
    if (fresh) this.yt = undefined
    const yt = await this.client()
    let lastError: unknown = new Error('No stream available')
    for (const client of CLIENTS) {
      try {
        const format = await yt.getStreamingData(videoId, { type: 'audio', quality: 'best', client })
        const url = format.url ?? (await format.decipher(yt.session.player))
        if (url) return url
      } catch (e) {
        lastError = e
      }
    }
    throw lastError
  }
}
