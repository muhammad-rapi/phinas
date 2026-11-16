import { Innertube } from 'youtubei.js'
import type { HomeFeed, Track } from '../../shared/types'
import { mapSongItem, sectionTracks, type RawSection, type RawSong } from './mapper'

export interface MusicSource {
  search(query: string): Promise<Track[]>
  getStreamUrl(videoId: string): Promise<string>
  getHomeFeed(): Promise<HomeFeed>
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

  async getStreamUrl(videoId: string): Promise<string> {
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
