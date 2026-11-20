import { Mic, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PublicPlaylist, Track } from '../../../shared/types'
import { CoverGrid } from '../components/CoverGrid'
import { TrackRow } from '../components/TrackRow'
import { ArtistLinks, pressable } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import { searchArtists } from '../search/artists'
import type { Nav } from '../views'

const DEBOUNCE_MS = 350

interface Props {
  query: string
  /** Bumped when Enter is pressed: search right away instead of waiting for typing to pause. */
  submitNonce: number
  /** A song was picked from the results. */
  onPick: (track: Track, typed: string) => void
  nav: Nav
}

export function Search({ query, submitNonce, onPick, nav }: Props): React.JSX.Element {
  const player = usePlayer()
  const [results, setResults] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Ignore answers from older requests when the user keeps typing.
  const requestId = useRef(0)
  const seenNonce = useRef(submitNonce)

  useEffect(() => {
    const q = query.trim()
    const id = ++requestId.current
    if (!q) {
      setResults([])
      setPlaylists([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const immediate = seenNonce.current !== submitNonce
    seenNonce.current = submitNonce
    const timer = setTimeout(async () => {
      // Playlists are a bonus: if they fail to load, the songs still show.
      window.phinas
        .searchPlaylists(q)
        .then((found) => id === requestId.current && setPlaylists(found))
        .catch(() => id === requestId.current && setPlaylists([]))
      try {
        const found = await window.phinas.search(q)
        if (id !== requestId.current) return
        setResults(found)
        setError(null)
      } catch {
        if (id !== requestId.current) return
        setError('Pencarian gagal. Cek koneksi internet kamu.')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, immediate ? 0 : DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, submitNonce])

  const q = query.trim()
  const artists = searchArtists(results)
  const [top, ...rest] = results
  const firstFour = rest.slice(0, 4)
  const more = rest.slice(4)
  // Playlists with a cover first: a row of blank squares says nothing.
  const shownPlaylists = [...playlists].sort((x, y) => Number(Boolean(y.coverUrl)) - Number(Boolean(x.coverUrl)))

  const playTrack = (t: Track): void => {
    onPick(t, q)
    // Only the picked song: the other results are mostly versions of the same one.
    // Autoplay fills in what comes next from recommendations.
    player.play([t], 0)
  }

  return (
    <>
      {error && <div className="notice">{error}</div>}

      {q && (
        <>
          <h1 className="page-title">
            Hasil untuk <em>&ldquo;{q}&rdquo;</em>
          </h1>
          {loading && results.length === 0 && <p className="muted">Mencari...</p>}
          {!loading && !error && results.length === 0 && <p className="muted">Tidak ada hasil.</p>}

          {top && (
            <section className="search-top">
              <div className="search-best">
                <h2 className="section-title">Hasil teratas</h2>
                <div className="best-card press" {...pressable(() => playTrack(top))} aria-label={`Putar ${top.title}`}>
                  <span className="best-cover" style={{ backgroundImage: `url("${top.coverUrl}")` }} />
                  <span className="best-title">{top.title}</span>
                  <span className="best-meta">
                    Lagu · <ArtistLinks artist={top.artist} />
                  </span>
                  <span className="btn best-play" aria-hidden="true">
                    <Play size={14} fill="currentColor" /> Putar
                  </span>
                </div>
              </div>
              {firstFour.length > 0 && (
                <div className="search-songs">
                  <h2 className="section-title">Lagu</h2>
                  {firstFour.map((t, i) => (
                    <TrackRow key={t.videoId} track={t} index={i} onPlay={() => playTrack(t)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {artists.length > 0 && (
            <section className="sec">
              <h2 className="section-title">Artis</h2>
              <div className="ex-pills">
                {artists.map((a) => (
                  <button key={a} className="ex-pill" onClick={() => nav({ name: 'artist', id: a })}>
                    <Mic size={14} aria-hidden="true" />
                    {a}
                  </button>
                ))}
              </div>
            </section>
          )}
          {shownPlaylists.length > 0 && (
            <section className="sec">
              <h2 className="section-title">Playlist</h2>
              <CoverGrid
                strip
                count={6}
                items={shownPlaylists.map((p) => ({
                  key: p.id,
                  art: p.coverUrl,
                  title: p.title,
                  meta: p.author,
                  onOpen: () => nav({ name: 'public', id: p.id, author: p.author })
                }))}
              />
            </section>
          )}
          {more.length > 0 && (
            <section className="sec">
              <h2 className="section-title">Lagu lainnya</h2>
              {more.map((t, i) => (
                <TrackRow key={t.videoId} track={t} index={i + 4} onPlay={() => playTrack(t)} />
              ))}
            </section>
          )}
        </>
      )}
    </>
  )
}
