import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { ListenCard } from '../components/ListenCard'
import { CoverArt, MediaCard } from '../components/MediaCard'
import { PartnerShelf } from '../components/PartnerShelf'
import { PlaylistCover } from '../components/PlaylistCover'
import { Shelf } from '../components/Shelf'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[]>([])
  const [forYou, setForYou] = useState<Track[]>([])

  useEffect(() => {
    window.phinas
      .listRecentPlays(20)
      .then(setRecent)
      .catch(() => setRecent([]))
    // With no history yet, or when the request fails, Quick picks stays as the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setForYou(r.personalized ? r.tracks : []))
      .catch(() => setForYou([]))
  }, [])

  useEffect(() => {
    window.phinas
      .getHomeFeed()
      .then(setFeed)
      .catch(() => setFeedFailed(true))
  }, [])

  const playPlaylist = async (id: string): Promise<void> => {
    const p = await window.phinas.getPlaylist(id)
    if (p?.tracks.length) player.play(p.tracks, 0)
  }

  const trackCards = (tracks: Track[]): React.ReactNode =>
    tracks.map((t, i) => (
      <MediaCard
        key={t.videoId}
        art={<CoverArt url={t.coverUrl} />}
        title={t.title}
        subtitle={t.artist}
        onOpen={() => player.play(tracks, i)}
        onPlay={() => player.play(tracks, i)}
      />
    ))

  return (
    <>
      <h2 className="page-title">{name ? `${greeting()}, ${name}` : greeting()}</h2>

      <ListenCard />

      {recent.length > 0 && <Shelf title="Putar lagi">{trackCards(recent)}</Shelf>}
      {forYou.length > 0 && <Shelf title="Pilihan untukmu">{trackCards(forYou)}</Shelf>}
      {feed && feed.trending.length > 0 && <Shelf title="Lagi tren">{trackCards(feed.trending)}</Shelf>}
      {forYou.length === 0 && feed && feed.picks.length > 0 && <Shelf title="Pilihan untukmu">{trackCards(feed.picks)}</Shelf>}
      {!feed && !feedFailed && <p className="muted">Memuat yang lagi tren...</p>}
      {feedFailed && <p className="muted">Tidak bisa memuat yang lagi tren. Cek koneksi internetmu.</p>}

      {lib.playlists.length > 0 && (
        <Shelf title="Playlist kamu">
          {lib.playlists.map((p) => (
            <MediaCard
              key={p.id}
              art={<PlaylistCover covers={p.coverUrls} />}
              title={p.name}
              subtitle="Playlist"
              onOpen={() => nav({ name: 'playlist', id: p.id })}
              onPlay={() => void playPlaylist(p.id)}
            />
          ))}
        </Shelf>
      )}

      <PartnerShelf nav={nav} />
    </>
  )
}
