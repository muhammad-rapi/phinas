import { useState, type FormEvent } from 'react'
import type { ImportResult } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { Nav } from '../views'

type State =
  | { step: 'idle' }
  | { step: 'working' }
  | { step: 'error'; message: string }
  | { step: 'done'; result: ImportResult }

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '\w+': Error: /, '') : 'Impor gagal.'

export function ImportView({ nav }: { nav: Nav }): React.JSX.Element {
  const lib = useLibrary()
  const [link, setLink] = useState('')
  const [state, setState] = useState<State>({ step: 'idle' })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!link.trim()) return
    setState({ step: 'working' })
    try {
      const result = await window.phinas.importSpotify(link.trim())
      setName(`${result.name} (dari Spotify)`)
      setState({ step: 'done', result })
    } catch (err) {
      setState({ step: 'error', message: cleanError(err) })
    }
  }

  const save = async (result: ImportResult): Promise<void> => {
    setSaving(true)
    try {
      const playlist = await window.phinas.createPlaylist(name.trim() || result.name)
      for (const t of result.matched) await window.phinas.addTrack(playlist.id, t)
      await lib.refresh()
      nav({ name: 'playlist', id: playlist.id })
    } catch (err) {
      setState({ step: 'error', message: cleanError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="page-title">Impor dari Spotify</h2>
      <p className="muted import-hint">
        Tempel link playlist atau album Spotify. Statusnya harus <strong>publik</strong>: di Spotify, buka playlist, pilih
        Bagikan, lalu Salin link. Lagunya dicari di YouTube Music, dan tidak perlu login atau akun Spotify di sini. Spotify
        hanya menampilkan sekitar 50-100 lagu pertama dari link publik.
      </p>

      <form className="import-form" onSubmit={run}>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          aria-label="Link Spotify"
          disabled={state.step === 'working'}
        />
        <button className="btn" type="submit" disabled={state.step === 'working' || !link.trim()}>
          {state.step === 'working' ? 'Mencari...' : 'Impor'}
        </button>
      </form>

      {state.step === 'error' && <div className="notice">{state.message}</div>}

      {state.step === 'done' && (
        <>
          <p className="import-summary">
            <strong>
              {state.result.matched.length} dari {state.result.total} lagu
            </strong>
            <span className="muted">ditemukan di YouTube Music.</span>
          </p>
          {state.result.matched.length === 0 ? (
            <div className="notice">Tidak ada lagu yang cocok, jadi tidak ada playlist yang dibuat.</div>
          ) : (
            <div className="import-summary">
              <input className="import-name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama playlist" />
              <button className="btn" disabled={saving} onClick={() => void save(state.result)}>
                {saving ? 'Menyimpan...' : `Buat playlist (${state.result.matched.length} lagu)`}
              </button>
            </div>
          )}
          {state.result.missing.length > 0 && (
            <details className="import-missing">
              <summary>{state.result.missing.length} lagu tidak ditemukan</summary>
              <ul>
                {state.result.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  )
}
