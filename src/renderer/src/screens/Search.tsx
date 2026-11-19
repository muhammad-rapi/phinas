import { useEffect, useRef, useState } from 'react'
import type { PublicPlaylist, Track } from '../../../shared/types'
import { CoverArt, MediaCard } from '../components/MediaCard'
import { Shelf } from '../components/Shelf'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'
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

  return (
    <>
      {error && <div className="notice">{error}</div>}

      {q && (
        <>
          <h2 className="page-title">Hasil untuk &ldquo;{q}&rdquo;</h2>
          {loading && results.length === 0 && <p className="muted">Mencari...</p>}
          {!loading && !error && results.length === 0 && <p className="muted">Tidak ada hasil.</p>}
          {playlists.length > 0 && (
            <Shelf title="Playlist">
              {playlists.map((p) => (
                <MediaCard
                  key={p.id}
                  art={<CoverArt url={p.coverUrl} />}
                  title={p.title}
                  subtitle={p.author}
                  onOpen={() => nav({ name: 'public', id: p.id, author: p.author })}
                />
              ))}
            </Shelf>
          )}
          {results.length > 0 && playlists.length > 0 && <h3 className="shelf-title" style={{ margin: '8px 0 8px' }}>Lagu</h3>}
          {results.map((t) => (
            <TrackRow
              key={t.videoId}
              track={t}
              onPlay={() => {
                onPick(t, q)
                // Only the picked song: the other results are mostly versions of the same one.
                // Autoplay fills in what comes next from recommendations.
                player.play([t], 0)
              }}
            />
          ))}
        </>
      )}
    </>
  )
}
