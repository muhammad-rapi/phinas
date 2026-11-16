import { Innertube } from 'youtubei.js'
import type { Track } from '../../shared/types'
import { mapSongItem, type RawSong } from './mapper'

export interface MusicSource {
  search(query: string): Promise<Track[]>
  getStreamUrl(videoId: string): Promise<string>
}

/**
 * Verified 2026-11-16 against live YouTube: only VISIONOS serves the whole file.
 * IOS and ANDROID_VR return 403 for any range after the first 1 MiB (they need a PO token),
 * and YTMUSIC/ANDROID/WEB return no usable URL. Do not add those back as fallbacks: a stream
 * that dies after the first minute is worse than a clear "cannot play" message.
 */
const CLIENTS = ['VISIONOS'] as const

export class YoutubeMusicSource implements MusicSource {
  private yt?: Promise<Innertube>

  private client(): Promise<Innertube> {
    if (!this.yt) {
      this.yt = Innertube.create({ retrieve_player: true }).catch((e) => {
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
