import { useEffect, useRef, useState } from 'react'
import type { Track } from '../../../shared/types'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'

const DEBOUNCE_MS = 350

interface Props {
  query: string
  remember: (q: string) => void
}

export function Search({ query, remember }: Props): React.JSX.Element {
  const player = usePlayer()
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Ignore answers from older requests when the user keeps typing.
  const requestId = useRef(0)

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

  const q = query.trim()

  return (
    <>
      {error && <div className="notice">{error}</div>}

      {q && (
        <>
          <h2 className="page-title">Hasil untuk &ldquo;{q}&rdquo;</h2>
          {loading && results.length === 0 && <p className="muted">Mencari...</p>}
          {!loading && !error && results.length === 0 && <p className="muted">Tidak ada hasil.</p>}
          {results.map((t, i) => (
            <TrackRow
              key={t.videoId}
              track={t}
              showAdd
              onPlay={() => {
                remember(q)
                player.play(results, i)
              }}
            />
          ))}
        </>
      )}
    </>
  )
}
