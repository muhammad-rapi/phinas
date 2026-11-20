import { Innertube } from 'youtubei.js'
import type { ArtistDetail, ArtistHit, Genre, GenrePage, HomeFeed, PublicPlaylist, PublicPlaylistDetail, Track } from '../../shared/types'
import { fillAlbumTrack, mapGenreButton, mapGenrePlaylist, mapNewRelease, mapVideoCard, mapPanelItem, mapPlaylistItem, mapReleaseItem, mapSongItem, sectionTracks, upsizeCover, type RawPanelItem, type RawPlaylistItem, type RawSection, type RawSong, type RawTwoRowItem } from './mapper'

export interface MusicSource {
  search(query: string): Promise<Track[]>
  /** `fresh` starts a new YouTube session first (used after a URL was rejected). */
  getStreamUrl(videoId: string, fresh?: boolean): Promise<string>
  getHomeFeed(): Promise<HomeFeed>
  searchPlaylists(query: string): Promise<PublicPlaylist[]>
  /** Artists matching the search text, best first (YouTube Music's artist results). */
  searchArtists(query: string): Promise<ArtistHit[]>
  getPublicPlaylist(id: string): Promise<PublicPlaylistDetail>
  /** Songs that follow `videoId` on YouTube Music (up next plus related), best first. */
  getRelated(videoId: string): Promise<Track[]>
  /** The artist best matching `name`: top songs plus albums and singles. */
  getArtist(name: string): Promise<ArtistDetail>
  /** All of an artist's songs (up to 100), by the id from getArtist. */
  getArtistSongs(id: string): Promise<Track[]>
  /** An album or single by its browse id, shaped like a public playlist. */
  getAlbum(id: string): Promise<PublicPlaylistDetail>
  /** A mood or genre page (params from HomeFeed.genres). */
  getGenre(params: string): Promise<GenrePage>
}

const HOME_TTL_MS = 10 * 60 * 1000
const RELATED_TTL_MS = 30 * 60 * 1000
const RELATED_CACHE_MAX = 200
const ARTIST_SONGS_MAX = 100
const ARTIST_TTL_MS = 30 * 60 * 1000
const ARTIST_CACHE_MAX = 30
/** Artist page shelves we show, with the label used on their cards. */
const RELEASE_SHELVES: [string, string][] = [
  ['albums', 'Album'],
  ['singles & eps', 'Single'],
  ['singles', 'Single']
]

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
  private related = new Map<string, { at: number; tracks: Track[] }>()
  private artists = new Map<string, { at: number; detail: ArtistDetail }>()
  private artistSongs = new Map<string, { at: number; tracks: Track[] }>()
  private artistPages = new Map<string, Awaited<ReturnType<Innertube['music']['getArtist']>>>()

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

  async searchArtists(query: string): Promise<ArtistHit[]> {
    const yt = await this.client()
    const found = await yt.music.search(query, { type: 'artist' })
    type RawArtist = { id?: string; name?: string; thumbnail?: { contents?: { url: string; width: number }[] } }
    const items = (found.artists?.contents ?? []) as unknown as RawArtist[]
    const hits: ArtistHit[] = []
    for (const a of items) {
      const name = a.name?.trim()
      if (!a.id || !name) continue
      const thumbs = a.thumbnail?.contents ?? []
      const best = thumbs.reduce<{ url: string; width: number } | null>((x, y) => (!x || y.width > x.width ? y : x), null)
      hits.push({ id: a.id, name, photoUrl: best ? upsizeCover(best.url) : '' })
      if (hits.length === 8) break
    }
    return hits
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
    type ExploreShelf = RawSection & {
      header?: { title?: { text?: string }; more_content?: { endpoint?: { payload?: { browseId?: string } } } }
      contents?: unknown[]
    }
    const shelves = explore.status === 'fulfilled' ? (explore.value.sections as unknown as ExploreShelf[]) : []
    const shelf = (title: string): ExploreShelf | undefined =>
      shelves.find((sh) => sh.header?.title?.text?.trim().toLowerCase() === title)
    const trendingId = shelf('trending')?.header?.more_content?.endpoint?.payload?.browseId?.replace(/^VL/, '')
    const genres = ((shelf('moods & genres')?.contents ?? []) as Parameters<typeof mapGenreButton>[0][])
      .map(mapGenreButton)
      .filter((g): g is Genre => g !== null)
    const feed: HomeFeed = {
      trending: sectionTracks(shelves as RawSection[], 'Trending'),
      trendingId,
      picks:
        home.status === 'fulfilled'
          ? sectionTracks(home.value.sections as unknown as RawSection[], 'Quick picks')
          : [],
      genres,
      releases: ((shelf('new albums & singles')?.contents ?? []) as RawTwoRowItem[])
        .map(mapNewRelease)
        .filter((r): r is PublicPlaylist => r !== null),
      videos: ((shelf('new music videos')?.contents ?? []) as RawTwoRowItem[])
        .map(mapVideoCard)
        .filter((t): t is Track => t !== null)
    }
    if (feed.trending.length || feed.picks.length || feed.releases.length) this.home = { at: Date.now(), feed }
    return feed
  }

  async getRelated(videoId: string): Promise<Track[]> {
    const hit = this.related.get(videoId)
    if (hit && Date.now() - hit.at < RELATED_TTL_MS) return hit.tracks
    const yt = await this.client()
    const panel = await yt.music.getUpNext(videoId)
    const tracks = ((panel.contents ?? []) as unknown as RawPanelItem[])
      .map(mapPanelItem)
      .filter((t): t is Track => t !== null && t.videoId !== videoId)
    if (tracks.length) {
      if (this.related.size >= RELATED_CACHE_MAX) this.related.delete(this.related.keys().next().value as string)
      this.related.set(videoId, { at: Date.now(), tracks })
    }
    return tracks
  }

  async getArtist(name: string): Promise<ArtistDetail> {
    const key = name.trim().toLowerCase()
    const hit = this.artists.get(key)
    if (hit && Date.now() - hit.at < ARTIST_TTL_MS) return hit.detail
    const yt = await this.client()
    const found = await yt.music.search(name, { type: 'artist' })
    type RawArtist = { id?: string; name?: string; thumbnail?: { contents?: { url: string; width: number }[] } }
    const items = (found.artists?.contents ?? []) as unknown as RawArtist[]
    const match = items.find((a) => a.id && a.name?.trim().toLowerCase() === key) ?? items.find((a) => a.id)
    if (!match?.id) throw new Error(`artist not found: ${name}`)

    const page = await yt.music.getArtist(match.id)
    type Shelf = { type?: string; header?: { title?: { text?: string } }; title?: { text?: string }; contents?: unknown[] }
    const sections = (page.sections ?? []) as unknown as Shelf[]
    const shelfTitle = (sh: Shelf): string => (sh.header?.title?.text ?? sh.title?.text ?? '').trim().toLowerCase()
    // Only the page's top songs here, so the page shows fast; getArtistSongs fetches the full list.
    const top = sections.find((sh) => sh.type === 'MusicShelf')
    const songs = ((top?.contents ?? []) as RawSong[]).map(mapSongItem).filter((t): t is Track => t !== null)

    const releases: PublicPlaylist[] = []
    const seen = new Set<string>()
    for (const [title, kind] of RELEASE_SHELVES) {
      const shelf = sections.find((sh) => shelfTitle(sh) === title)
      for (const raw of (shelf?.contents ?? []) as RawTwoRowItem[]) {
        const r = mapReleaseItem(raw, kind)
        if (r && !seen.has(r.id)) {
          seen.add(r.id)
          releases.push(r)
        }
      }
    }

    const thumbs = match.thumbnail?.contents ?? []
    const best = thumbs.reduce<{ url: string; width: number } | null>((a, b) => (!a || b.width > a.width ? b : a), null)
    const header = page.header as unknown as { title?: { text?: string } } | undefined
    const detail: ArtistDetail = {
      id: match.id,
      name: header?.title?.text?.trim() || match.name?.trim() || name,
      photoUrl: best ? upsizeCover(best.url) : songs[0]?.coverUrl ?? '',
      songs,
      releases
    }
    if (this.artists.size >= ARTIST_CACHE_MAX) this.artists.delete(this.artists.keys().next().value as string)
    this.artists.set(key, { at: Date.now(), detail })
    this.artistPages.set(match.id, page)
    if (this.artistPages.size > ARTIST_CACHE_MAX) this.artistPages.delete(this.artistPages.keys().next().value as string)
    return detail
  }

  async getArtistSongs(id: string): Promise<Track[]> {
    const hit = this.artistSongs.get(id)
    if (hit && Date.now() - hit.at < ARTIST_TTL_MS) return hit.tracks
    const yt = await this.client()
    const page = this.artistPages.get(id) ?? (await yt.music.getArtist(id))
    const all = (await page.getAllSongs()) as unknown as { contents?: RawSong[] } | undefined
    const tracks = (all?.contents ?? [])
      .map(mapSongItem)
      .filter((t): t is Track => t !== null)
      .slice(0, ARTIST_SONGS_MAX)
    if (tracks.length) {
      if (this.artistSongs.size >= ARTIST_CACHE_MAX) this.artistSongs.delete(this.artistSongs.keys().next().value as string)
      this.artistSongs.set(id, { at: Date.now(), tracks })
    }
    return tracks
  }

  async getAlbum(id: string): Promise<PublicPlaylistDetail> {
    const yt = await this.client()
    const album = await yt.music.getAlbum(id)
    const header = album.header as unknown as {
      title?: { text?: string }
      strapline_text_one?: { text?: string }
      subtitle?: { text?: string }
      thumbnail?: { contents?: { url: string; width: number }[] }
    } | undefined
    const thumbs = header?.thumbnail?.contents ?? []
    const best = thumbs.reduce<{ url: string; width: number } | null>((a, b) => (!a || b.width > a.width ? b : a), null)
    const coverUrl = best ? upsizeCover(best.url) : ''
    const artist = header?.strapline_text_one?.text?.trim() ?? ''
    const tracks = ((album.contents ?? []) as unknown as RawSong[])
      .map(mapSongItem)
      .filter((t): t is Track => t !== null)
      .map((t) => fillAlbumTrack(t, artist, coverUrl))
    return {
      id,
      title: header?.title?.text?.trim() || 'Album',
      author: artist || 'YouTube Music',
      coverUrl: coverUrl || tracks[0]?.coverUrl || '',
      tracks
    }
  }

  async getGenre(params: string): Promise<GenrePage> {
    const yt = await this.client()
    const res = (await yt.actions.execute('/browse', {
      browseId: 'FEmusic_moods_and_genres_category',
      params,
      client: 'YTMUSIC',
      parse: true
    })) as unknown as { contents?: { item?: () => unknown } }
    type Page = { tabs?: { content?: { contents?: GenreShelf[] } }[]; contents?: GenreShelf[] }
    type GenreShelf = { header?: { title?: { text?: string } }; contents?: RawTwoRowItem[] }
    const page = (res.contents?.item?.() ?? res.contents) as Page | undefined
    const list = page?.tabs?.[0]?.content?.contents ?? page?.contents ?? []
    return {
      shelves: list
        .map((sh) => {
          const items = sh.contents ?? []
          // Song and video shelves are skipped: they are single tracks, not collections.
          const album = items.some((i) => i.item_type === 'album')
          const kept = items.filter((i) => i.item_type === (album ? 'album' : 'playlist'))
          return {
            title: sh.header?.title?.text?.trim() ?? '',
            album,
            playlists: kept.map(mapGenrePlaylist).filter((p): p is PublicPlaylist => p !== null)
          }
        })
        .filter((sh) => sh.title && sh.playlists.length > 0)
    }
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
