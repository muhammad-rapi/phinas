import { Clock, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Playlist, Track } from '../../../shared/types'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'
import { addRecent, loadRecent, removeRecent, saveRecent } from '../search/recent'

const DEBOUNCE_MS = 350

export function Search(): React.JSX.Element {
  const player = usePlayer()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [recent, setRecent] = useState<string[]>(loadRecent)
  // Ignore answers from older requests when the user keeps typing.
  const requestId = useRef(0)

  useEffect(() => {
    window.phinas.listPlaylists().then(setPlaylists)
  }, [])

  useEffect(() => {
    const q = query.trim()
    const id = ++requestId.current
    if (!q) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
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
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const remember = (q: string): void => {
    setRecent((cur) => {
      const next = addRecent(cur, q)
      saveRecent(next)
      return next
    })
  }

  const forget = (q: string): void => {
    setRecent((cur) => {
      const next = removeRecent(cur, q)
      saveRecent(next)
      return next
    })
  }

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    remember(query)
  }

  return (
    <>
      <h2>Search</h2>
      <form className="searchbar" onSubmit={submit}>
        <input
          autoFocus
          placeholder="Cari lagu atau artis"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      {error && <div className="notice">{error}</div>}

      {!query.trim() && (
        <>
          <h3>Pencarian terakhir</h3>
          {recent.length === 0 && <p className="muted">Belum ada pencarian.</p>}
          <div className="recent-list">
            {recent.map((q) => (
              <div key={q} className="recent-item">
                <button className="recent-main" onClick={() => setQuery(q)}>
                  <Clock size={16} />
                  <span>{q}</span>
                </button>
                <button className="icon-btn" onClick={() => forget(q)} aria-label={`Hapus ${q}`}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {query.trim() && loading && results.length === 0 && <p className="muted">Mencari...</p>}
      {query.trim() && !loading && !error && results.length === 0 && (
        <p className="muted">Tidak ada hasil untuk &ldquo;{query.trim()}&rdquo;.</p>
      )}
      {results.map((t, i) => (
        <TrackRow
          key={t.videoId}
          track={t}
          playlists={playlists}
          onPlay={() => {
            remember(query)
            player.play(results, i)
          }}
        />
      ))}
    </>
  )
}
