import type { Recommendations, Track } from '../../shared/types'
import type { Library } from '../library/library'
import type { MusicSource } from '../music/source'
import { buildProfile, hasTaste, pickSeeds } from './profile'
import { rank } from './rank'

const HOME_SEEDS = 4
/** Autoplay follows the song playing; one taste seed adds a little of what you usually like. */
const AUTOPLAY_PROFILE_SEEDS = 1
const HOME_LIMIT = 20
const AUTOPLAY_LIMIT = 10

/** Joins the taste profile, YouTube's related songs and the ranking. */
export class Recommender {
  private lastHome: Recommendations | null = null

  constructor(
    private library: Library,
    private source: MusicSource,
    private now: () => number = Date.now
  ) {}

  private profile() {
    const likes = this.library.likeEntries()
    const plays = this.library.playEntries()
    return { likes, plays, profile: buildProfile(likes, plays, this.now()) }
  }

  /** Related songs for several seeds; a seed that fails to load is simply left out. */
  private async candidates(seeds: Track[]): Promise<Track[]> {
    const lists = await Promise.allSettled(seeds.map((s) => this.source.getRelated(s.videoId)))
    return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  }

  /** "Pilihan untukmu". With no history and no likes it says so and the caller shows Quick picks. */
  async forHome(): Promise<Recommendations> {
    const { likes, plays, profile } = this.profile()
    if (!hasTaste(profile)) return { personalized: false, tracks: [] }
    try {
      const seeds = pickSeeds(profile, likes, plays, HOME_SEEDS)
      const pool = [...(await this.candidates(seeds))]
      const tracks = rank(pool, profile, new Set(), { limit: HOME_LIMIT })
      if (tracks.length) {
        this.lastHome = { personalized: true, tracks }
        return this.lastHome
      }
    } catch {
      // fall through to the last good result
    }
    return this.lastHome ?? { personalized: false, tracks: [] }
  }

  /** Tracks to append when the queue is about to run out. Never throws: no network means no tracks. */
  async autoplay(current: Track, queueIds: string[]): Promise<Track[]> {
    try {
      const { likes, plays, profile } = this.profile()
      const seeds = [current, ...pickSeeds(profile, likes, plays, AUTOPLAY_PROFILE_SEEDS).filter((s) => s.videoId !== current.videoId)]
      const pool = await this.candidates(seeds)
      return rank(pool, profile, new Set([current.videoId, ...queueIds]), { limit: AUTOPLAY_LIMIT, excludeTitles: [current.title] })
    } catch {
      return []
    }
  }
}
