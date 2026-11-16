import { useEffect, useState, type FormEvent } from 'react'
import type { Playlist, Track } from '../../../shared/types'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'

export function Search(): React.JSX.Element {
  const player = usePlayer()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  useEffect(() => {
    window.phinas.listPlaylists().then(setPlaylists)
  }, [])

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      setResults(await window.phinas.search(query.trim()))
    } catch {
      setError('Pencarian gagal. Cek koneksi internet kamu.')
    } finally {
      setLoading(false)
    }
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
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>
      {error && <div className="notice">{error}</div>}
      {results.map((t, i) => (
        <TrackRow key={t.videoId} track={t} playlists={playlists} onPlay={() => player.play(results, i)} />
      ))}
    </>
  )
}
