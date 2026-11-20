import { useEffect, useState } from 'react'
import type { FavoriteArtist, HomeFeed, PartnerPlaylist, Track } from '../../../shared/types'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import { PlaylistCover } from '../components/PlaylistCover'
import { formatTime } from '../components/TrackRow'
import { ArtistLinks } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import { rememberPlaylist } from '../social/playlistCache'
import { useSocial } from '../social/SocialProvider'
import type { Nav } from '../views'

const FEED_ERROR = 'Tidak bisa memuat bagian ini. Cek koneksi internetmu.'

import { genreIcon } from '../theme/genreIcon'

/** A mood or genre pill with its icon. */
function GenrePill({ title, onOpen }: { title: string; onOpen: () => void }): React.JSX.Element {
  const Icon = genreIcon(title)
  return (
    <button className="ex-pill" onClick={onOpen}>
      <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
      {title}
    </button>
  )
}

/** Numbered rows with a small cover: number, cover, title and artist, duration. Clicking plays from that row. */
function RankedRows({ tracks, onPlay }: { tracks: Track[]; onPlay: (index: number) => void }): React.JSX.Element {
  const player = usePlayer()
  return (
    <ol className="ex-rows">
      {tracks.map((t, i) => (
        <li key={`${t.videoId}-${i}`}>
          {/* Mouse: the whole row plays. Keyboard and screen readers: the number is the play button. */}
          <div className={`ex-row${player.track?.videoId === t.videoId ? ' playing' : ''}`} onClick={() => onPlay(i)}>
            <button
              className="ex-num"
              onClick={(e) => {
                e.stopPropagation()
                onPlay(i)
              }}
              aria-label={`Putar ${t.title}`}
            >
              {String(i + 1).padStart(2, '0')}
            </button>
            <span className="ex-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
            <span className="ex-text">
              <span className="ex-title">{t.title}</span>
              <ArtistLinks className="ex-artist" artist={t.artist} />
            </span>
            <span className="ex-time">{t.durationSec > 0 ? formatTime(t.durationSec) : ''}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RowsSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="ex-rows" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ex-skel skeleton" />
      ))}
    </div>
  )
}

/** Everything that left Beranda: moods and genres, the full chart, new releases, favourite artists, new videos. */
export function Explore({ nav }: { nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [failed, setFailed] = useState(false)
  const [artists, setArtists] = useState<FavoriteArtist[]>([])
  const social = useSocial()
  const [publicLists, setPublicLists] = useState<PartnerPlaylist[] | null>(null)
  const [publicFailed, setPublicFailed] = useState(false)

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFailed(true))
    window.phinas.listFavoriteArtists(6).then(setArtists).catch(() => setArtists([]))
  }, [])

  // Public playlists come from other Phinas users, so they need an account.
  useEffect(() => {
    if (!social.signedIn) return
    let alive = true
    setPublicFailed(false)
    window.phinas
      .listPublicPlaylists()
      .then((p) => {
        if (alive) setPublicLists(p.slice(0, 12))
      })
      .catch(() => {
        if (alive) setPublicFailed(true)
      })
    return () => {
      alive = false
    }
  }, [social.signedIn])

  /** A feed section shows while loading (placeholders) and on failure (the error line); hidden only when empty. */
  const shown = (count: number | undefined): boolean => !feed || (count ?? 0) > 0
  const error = <p className="muted">{FEED_ERROR}</p>

  return (
    <div className="explore">
      <h1 className="page-title">Jelajah</h1>

      {shown(feed?.genres.length) && (
        <section className="sec">
          <h2 className="section-title">Mood &amp; genre</h2>
          {feed ? (
            <div className="ex-pills">
              {feed.genres.map((g) => (
                <GenrePill key={g.params} title={g.title} onOpen={() => nav({ name: 'genre', id: g.params, title: g.title })} />
              ))}
            </div>
          ) : failed ? (
            error
          ) : (
            <div className="ex-pills" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="ex-pill skeleton" />
              ))}
            </div>
          )}
        </section>
      )}

      {shown(feed?.trending.length) && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="section-title">Lagi ramai</h2>
            {feed?.trendingId && (
              <button className="text-link ex-more" onClick={() => nav({ name: 'public', id: feed.trendingId!, author: 'YouTube Music' })}>
                Lihat semua
              </button>
            )}
          </div>
          {feed ? (
            <RankedRows tracks={feed.trending.slice(0, 10)} onPlay={(i) => player.play(feed.trending, i)} />
          ) : failed ? (
            error
          ) : (
            <RowsSkeleton count={5} />
          )}
        </section>
      )}

      {shown(feed?.releases.length) && (
        <section className="sec">
          <h2 className="section-title">Rilis baru</h2>
          {feed ? (
            <CoverGrid
              four
              items={feed.releases.slice(0, 8).map((r) => ({
                key: r.id,
                art: r.coverUrl,
                title: r.title,
                // "Album • 2026" or "Single • 2026" (see mapNewRelease).
                meta: r.author,
                onOpen: () => nav({ name: 'album', id: r.id })
              }))}
            />
          ) : failed ? (
            error
          ) : (
            <CoverGridSkeleton four count={4} />
          )}
        </section>
      )}

      {social.signedIn && (publicLists === null || publicLists.length > 0 || publicFailed) && (
        <section className="sec">
          <h2 className="section-title">Playlist publik</h2>
          {publicFailed ? (
            error
          ) : publicLists === null ? (
            <CoverGridSkeleton four count={4} />
          ) : (
            <CoverGrid
              four
              items={publicLists.map((p) => ({
                key: p.id,
                art: <PlaylistCover covers={p.coverUrls} />,
                title: p.name,
                meta: `oleh ${p.ownerName}`,
                onOpen: () => {
                  rememberPlaylist(p)
                  nav({ name: 'friendPlaylist', id: p.id })
                }
              }))}
            />
          )}
        </section>
      )}

      {artists.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Artis favoritmu</h2>
          <ol className="ex-rows">
            {artists.map((a) => (
              <li key={a.artist}>
                <button className="ex-row" onClick={() => nav({ name: 'artist', id: a.artist })} aria-label={`Buka ${a.artist}`}>
                  <span className="ex-thumb round" style={{ backgroundImage: `url("${a.coverUrl}")` }} />
                  <span className="ex-text">
                    <span className="ex-title">{a.artist}</span>
                    <span className="ex-artist">{a.plays} kali diputar</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {shown(feed?.videos.length) && (
        <section className="sec">
          <h2 className="section-title">Video baru</h2>
          {feed ? (
            <RankedRows tracks={feed.videos.slice(0, 6)} onPlay={(i) => player.play(feed.videos, i)} />
          ) : failed ? (
            error
          ) : (
            <RowsSkeleton count={3} />
          )}
        </section>
      )}
    </div>
  )
}
