import { Heart, Pause, Play, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { BentoRow, Tile, TrackRows } from '../components/Bento'
import { ListenCard } from '../components/ListenCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav, View } from '../views'
import { continueTrack } from './home/continue'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** The big tile: the loaded track, or the last one played. */
function ContinueTile({ recent }: { recent: Track[] }): React.JSX.Element {
  const player = usePlayer()
  const pick = continueTrack(player.track, recent)
  if (!pick) {
    return (
      <Tile span={8} className="continue empty">
        <span className="continue-title">Cari lagu untuk mulai</span>
        <button className="pill-btn" onClick={() => player.run('focusSearch')}>
          <Search size={16} /> Cari lagu
        </button>
      </Tile>
    )
  }
  const { track, isCurrent } = pick
  const playing = isCurrent && player.playing
  return (
    <Tile span={8} className="continue">
      <div className="continue-cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
      <div className="continue-text">
        <span className="muted continue-label">{isCurrent ? 'Sedang diputar' : 'Lanjutkan'}</span>
        <span className="continue-title">{track.title}</span>
        <span className="muted">{track.artist}</span>
        <button
          className="continue-play"
          onClick={() => (isCurrent ? player.toggle() : player.play(recent, 0))}
          aria-label={playing ? 'Jeda' : 'Putar'}
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
      </div>
    </Tile>
  )
}

/** Listen-together when signed in with a partner, otherwise the liked songs. */
function TogetherTile({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  if (listen.available) return <ListenCard compact onOpen={() => nav({ name: 'together' })} />
  return (
    <button className="tile span-4 liked-tile" onClick={() => nav({ name: 'liked' })}>
      <Heart size={28} fill="currentColor" />
      <span className="liked-tile-text">
        <span className="tile-title">Lagu yang disukai</span>
        <span>{lib.likes.length} lagu</span>
      </span>
    </button>
  )
}

function PickGrid({ tracks }: { tracks: Track[] }): React.JSX.Element {
  const player = usePlayer()
  return (
    <div className="pick-grid">
      {tracks.map((t, i) => (
        <button key={`${t.videoId}-${i}`} className="pick" onClick={() => player.play(tracks, i)}>
          <span className="queue-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
          <span className="queue-text">
            <span className="queue-name">{t.title}</span>
            <span className="muted queue-artist">{t.artist}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Up to four playlists, own first, then the partner's. */
function PlaylistTile({ nav }: { nav: Nav }): React.JSX.Element {
  const lib = useLibrary()
  const items: { key: string; covers: string[]; name: string; sub: string; view: View }[] = [
    ...lib.playlists.map((p) => ({ key: p.id, covers: p.coverUrls, name: p.name, sub: 'Playlist', view: { name: 'playlist', id: p.id } as View })),
    ...lib.partner.map((p) => ({
      key: `partner-${p.id}`,
      covers: p.coverUrls,
      name: p.name,
      sub: p.ownerName,
      view: { name: 'partner', id: p.id } as View
    }))
  ].slice(0, 4)

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <Tile span={6} title="Playlist">
      {items.length === 0 ? (
        <>
          <p className="muted">Buat playlist pertamamu.</p>
          <button className="pill-btn" onClick={() => void create()}>
            <Plus size={16} /> Buat playlist
          </button>
        </>
      ) : (
        <div className="pl-grid">
          {items.map((p) => (
            <button key={p.key} className="lib-row" onClick={() => nav(p.view)}>
              <PlaylistCover covers={p.covers} size={48} />
              <span className="lib-row-text">
                <span className="lib-row-title">{p.name}</span>
                <span className="muted lib-row-sub">{p.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Tile>
  )
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[]>([])
  const [forYou, setForYou] = useState<Track[]>([])

  useEffect(() => {
    window.phinas.listRecentPlays(20).then(setRecent).catch(() => setRecent([]))
    // With no history yet, or when the request fails, the feed's picks are the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setForYou(r.personalized ? r.tracks : []))
      .catch(() => setForYou([]))
  }, [])

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const picks = forYou.length > 0 ? forYou : (feed?.picks ?? [])
  // Kept while loading (placeholder rows) and on failure (the error line); hidden only when empty.
  const showTrending = !feed || feed.trending.length > 0

  return (
    <>
      <h2 className="page-title">{name ? `${greeting()}, ${name}` : greeting()}</h2>

      <BentoRow>
        <ContinueTile recent={recent} />
        <TogetherTile nav={nav} />
      </BentoRow>

      <BentoRow>
        {recent.length > 0 && (
          <Tile span={4} title="Putar lagi" onTitle={() => nav({ name: 'recent' })}>
            <div className="cover-stack" aria-hidden="true">
              {recent.slice(0, 3).map((t, i) => (
                <span key={`${t.videoId}-${i}`} style={{ backgroundImage: `url("${t.coverUrl}")` }} />
              ))}
            </div>
            <TrackRows tracks={recent.slice(0, 4)} onPlay={(i) => player.play(recent, i)} />
          </Tile>
        )}
        {picks.length > 0 && (
          <Tile span={8} title="Pilihan untukmu">
            <PickGrid tracks={picks.slice(0, 8)} />
          </Tile>
        )}
      </BentoRow>

      <BentoRow>
        {showTrending && (
          <Tile span={6} title="Lagi tren">
            {feed ? (
              <TrackRows numbered tracks={feed.trending.slice(0, 5)} onPlay={(i) => player.play(feed.trending, i)} />
            ) : feedFailed ? (
              <p className="muted">Tidak bisa memuat yang lagi tren. Cek koneksi internetmu.</p>
            ) : (
              <div className="track-rows" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="track-row skeleton" />
                ))}
              </div>
            )}
          </Tile>
        )}
        <PlaylistTile nav={nav} />
      </BentoRow>
    </>
  )
}
