import { useEffect, useState } from 'react'
import type { ArtistDetail } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { CoverArt, MediaCard } from '../components/MediaCard'
import { Shelf } from '../components/Shelf'
import { TrackRow } from '../components/TrackRow'
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
        <div className="collection-head">
          <div className="collection-cover artist-skel skeleton" />
          <div className="collection-info">
            <div className="muted collection-kind">Artis</div>
            <h1 className="collection-title">{name}</h1>
          </div>
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="track-row skeleton artist-skel-row" />
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
      {a.songs.length > 0 && <h3 className="shelf-title" style={{ margin: '8px 0' }}>Lagu populer</h3>}
      {shown.map((t, i) => (
        <TrackRow key={`${t.videoId}-${i}`} track={t} index={i} onPlay={() => player.play(a.songs, i)} />
      ))}
      {a.songs.length > SONGS_PREVIEW && (
        <button className="pill-btn artist-more" onClick={() => setAllSongs((v) => !v)}>
          {allSongs ? 'Tampilkan lebih sedikit' : `Lihat semua (${a.songs.length})`}
        </button>
      )}
      {a.releases.length > 0 && (
        <Shelf title="Album & single">
          {a.releases.map((r) => (
            <MediaCard
              key={r.id}
              art={<CoverArt url={r.coverUrl} />}
              title={r.title}
              subtitle={r.author}
              onOpen={() => nav({ name: 'album', id: r.id })}
            />
          ))}
        </Shelf>
      )}
    </>
  )
}
