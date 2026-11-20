import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { BerduaLine } from '../components/BerduaLine'
import { CoverGrid } from '../components/CoverGrid'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { NumberedList } from '../components/NumberedList'
import { ArtistLinks } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'
import { continueTrack } from './home/continue'
import { homeLabel } from './home/dayPart'
import { forYouList, trendingList } from './home/lists'

/** The big top block: continue the loaded or last-played track, or a way to start. */
function CoverStory({ recent, nav }: { recent: Track[] | null; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  if (!player.track && recent === null) {
    return (
      <div className="story" aria-busy="true">
        <div className="story-cover skeleton" />
      </div>
    )
  }
  const pick = continueTrack(player.track, recent ?? [])
  if (!pick) {
    return (
      <div className="story">
        <div className="story-text">
          <h1 className="story-title">
            Mulai dari <em>sini.</em>
          </h1>
          <p className="muted">Cari lagu atau buka Jelajah</p>
          <div className="story-actions">
            <button className="btn" onClick={() => player.run('focusSearch')}>
              Cari
            </button>
            <button className="btn secondary" onClick={() => nav({ name: 'explore' })}>
              Jelajah
            </button>
          </div>
        </div>
      </div>
    )
  }
  const { track, isCurrent } = pick
  const playing = isCurrent && player.playing
  return (
    <div className="story">
      <div className="story-cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
      <div className="story-text">
        <h1 className="story-title">
          Lanjutkan
          <em>{track.title}.</em>
        </h1>
        <ArtistLinks className="story-artist" artist={track.artist} />
        <div className="story-actions">
          {/* The loaded track pauses and resumes; otherwise the history plays from that track. */}
          <button className="btn" onClick={() => (isCurrent ? player.toggle() : player.play(recent ?? [track], 0))}>
            {playing ? (
              <>
                <Pause size={13} fill="currentColor" /> Jeda
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Putar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/** One row of covers from the history; a cover plays the history from that track. */
function PlayAgain({ recent, nav }: { recent: Track[] | null; nav: Nav }): React.JSX.Element | null {
  const player = usePlayer()
  if (!recent || recent.length === 0) return null
  const tracks = recent.slice(0, 10)
  return (
    <section className="home-sec" aria-label="Putar lagi">
      <h2 className="section-title-wrap">
        <button className="section-title" onClick={() => nav({ name: 'recent' })}>
          Putar lagi
        </button>
      </h2>
      <CoverGrid
        strip
        items={tracks.map((t, i) => ({
          key: `${t.videoId}-${i}`,
          title: t.title,
          meta: t.artist,
          art: t.coverUrl,
          onOpen: () => player.play(tracks, i)
        }))}
      />
    </section>
  )
}

/** Own playlists first, then the partner's, in one row of covers. */
function YourPlaylists({ nav }: { nav: Nav }): React.JSX.Element | null {
  const lib = useLibrary()
  const items = [
    ...lib.playlists.map((p) => ({
      key: p.id,
      title: p.name,
      meta: 'Playlist',
      art: <PlaylistCover covers={p.coverUrls} />,
      onOpen: () => nav({ name: 'playlist', id: p.id })
    })),
    ...lib.partner.map((p) => ({
      key: `partner-${p.id}`,
      title: p.name,
      meta: `Dari ${p.ownerName}`,
      art: <PlaylistCover covers={p.coverUrls} />,
      onOpen: () => nav({ name: 'partner', id: p.id })
    }))
  ]
  if (items.length === 0) return null
  return (
    <section className="home-sec" aria-label="Playlist kamu">
      <h2 className="section-title">Playlist kamu</h2>
      <CoverGrid strip items={items} />
    </section>
  )
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[] | null>(null)
  const [recs, setRecs] = useState<Track[] | null>(null)

  useEffect(() => {
    window.phinas.listRecentPlays(20).then(setRecent).catch(() => setRecent([]))
    // With no history yet, or when the request fails, the feed's picks are the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setRecs(r.personalized ? r.tracks : []))
      .catch(() => setRecs([]))
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const forYou = forYouList(recs, feed, feedFailed)
  const trending = trendingList(feed, feedFailed)
  const explore = (): void => nav({ name: 'explore' })

  return (
    <div className="home">
      <div className="label accent">{homeLabel(new Date(), name)}</div>
      <CoverStory recent={recent} nav={nav} />
      <BerduaLine onOpen={() => nav({ name: 'friends' })} />
      <div className="home-lists">
        <NumberedList
          title="Untukmu"
          onTitle={explore}
          tracks={forYou.tracks}
          failed={forYou.failed}
          errorText="Tidak bisa memuat rekomendasi. Cek koneksi internetmu."
          onPlay={(i) => forYou.tracks && player.play(forYou.tracks, i)}
          rows={8}
        />
        <NumberedList
          title="Lagi ramai"
          onTitle={explore}
          tracks={trending.tracks}
          failed={trending.failed}
          errorText="Tidak bisa memuat yang lagi tren. Cek koneksi internetmu."
          onPlay={(i) => trending.tracks && player.play(trending.tracks, i)}
          rows={8}
        />
      </div>
      <PlayAgain recent={recent} nav={nav} />
      <YourPlaylists nav={nav} />
    </div>
  )
}
