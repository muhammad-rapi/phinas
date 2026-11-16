import { Heart, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { CoverArt, MediaCard } from '../components/MediaCard'
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

interface Shortcut {
  key: string
  title: string
  thumb: React.ReactNode
  open: () => void
  play: () => void
}

export function Home({ nav }: { nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const playPlaylist = async (id: string): Promise<void> => {
    const p = await window.phinas.getPlaylist(id)
    if (p?.tracks.length) player.play(p.tracks, 0)
  }

  const shortcuts: Shortcut[] = [
    {
      key: 'liked',
      title: 'Lagu yang disukai',
      thumb: (
        <div className="pcover pcover-liked" style={{ width: 56, height: 56 }}>
          <Heart size={22} fill="currentColor" />
        </div>
      ),
      open: () => nav({ name: 'liked' }),
      play: () => lib.likes.length && player.play(lib.likes, 0)
    },
    ...lib.playlists.slice(0, 5).map((p) => ({
      key: p.id,
      title: p.name,
      thumb: <PlaylistCover covers={p.coverUrls} size={56} />,
      open: () => nav({ name: 'playlist', id: p.id }),
      play: () => void playPlaylist(p.id)
    })),
    ...lib.partner.slice(0, 2).map((p) => ({
      key: `partner-${p.id}`,
      title: p.name,
      thumb: <PlaylistCover covers={p.coverUrls} size={56} />,
      open: () => nav({ name: 'partner', id: p.id }),
      play: () => p.tracks.length && player.play(p.tracks, 0)
    }))
  ].slice(0, 8)

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
      <h2 className="page-title">{greeting()}</h2>

      <div className="shortcuts">
        {shortcuts.map((s) => (
          <div key={s.key} className="shortcut">
            <button className="shortcut-main" onClick={s.open}>
              {s.thumb}
              <span className="shortcut-title">{s.title}</span>
            </button>
            <button className="shortcut-play" onClick={s.play} aria-label={`Putar ${s.title}`}>
              <Play size={20} fill="currentColor" />
            </button>
          </div>
        ))}
      </div>

      {feed && feed.trending.length > 0 && <Shelf title="Lagi tren">{trackCards(feed.trending)}</Shelf>}
      {feed && feed.picks.length > 0 && <Shelf title="Pilihan untukmu">{trackCards(feed.picks)}</Shelf>}
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

      {lib.partner.length > 0 && (
        <Shelf title="Dari pasangan">
          {lib.partner.map((p) => (
            <MediaCard
              key={p.id}
              art={<PlaylistCover covers={p.coverUrls} />}
              title={p.name}
              subtitle={p.ownerName}
              onOpen={() => nav({ name: 'partner', id: p.id })}
              onPlay={() => p.tracks.length && player.play(p.tracks, 0)}
            />
          ))}
        </Shelf>
      )}
    </>
  )
}
