import { useEffect, useState } from 'react'
import type { ArtistDetail } from '../../../shared/types'
import { AccentTitle, CollectionHeader } from '../components/CollectionHeader'
import { CoverGrid } from '../components/CoverGrid'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; artist: ArtistDetail }

/** How many songs show before "Lihat semua". */
const SONGS_PREVIEW = 10

/** An artist from YouTube Music: their songs, albums and singles. */
export function ArtistView({ name, nav }: { name: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [allSongs, setAllSongs] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setAllSongs(false)
    window.phinas
      .getArtist(name)
      .then((artist) => {
        if (cancelled) return
        setState({ status: 'ready', artist })
        // The page shows with the top songs; the full list replaces them when it arrives.
        window.phinas
          .getArtistSongs(artist.id)
          .then((songs) => {
            if (cancelled || songs.length <= artist.songs.length) return
            setState({ status: 'ready', artist: { ...artist, songs } })
          })
          .catch(() => {
            /* keep the top songs */
          })
      })
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [name])

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label={`Memuat ${name}`}>
        <header className="ch">
          <div className="ch-cover artist-hero skeleton" />
          <div className="ch-info">
            <div className="label accent">Artis</div>
            <h1 className="ch-title">
              <AccentTitle text={name} />
            </h1>
          </div>
        </header>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="tl-skel skeleton" />
        ))}
      </div>
    )
  }
  if (state.status === 'error') return <div className="notice">Halaman {name} tidak bisa dibuka. Cek koneksi internet kamu.</div>

  const a = state.artist
  const shown = allSongs ? a.songs : a.songs.slice(0, SONGS_PREVIEW)
  return (
    <>
      <CollectionHeader
        cover={<div className="artist-hero" style={{ backgroundImage: `url("${a.photoUrl}")` }} />}
        kind="Artis"
        title={a.name}
        meta={a.releases.length ? `${a.releases.length} album & single` : ''}
        tracks={a.songs}
      />
      {a.songs.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Lagu populer</h2>
          <TrackListHead />
          {shown.map((t, i) => (
            <TrackRow key={`${t.videoId}-${i}`} track={t} index={i} onPlay={() => player.play(a.songs, i)} />
          ))}
          {a.songs.length > SONGS_PREVIEW && (
            <button className="btn secondary artist-more" onClick={() => setAllSongs((v) => !v)}>
              {allSongs ? 'Tampilkan lebih sedikit' : `Lihat semua (${a.songs.length})`}
            </button>
          )}
        </section>
      )}
      {a.releases.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Album &amp; single</h2>
          <CoverGrid
            items={a.releases.map((r) => ({
              key: r.id,
              art: r.coverUrl,
              title: r.title,
              meta: r.author,
              onOpen: () => nav({ name: 'album', id: r.id })
            }))}
          />
        </section>
      )}
    </>
  )
}
