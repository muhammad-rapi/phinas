import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lyrics, Track } from '../../../shared/types'
import { activeLine } from '../lyrics/active'
import { usePlayer } from '../player/PlayerProvider'

type State = { status: 'loading' } | { status: 'none' } | { status: 'error' } | { status: 'ready'; lyrics: Lyrics }

function useLyrics(track: Track): { state: State; retry: () => void } {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    window.phinas
      .getLyrics(track)
      .then((lyrics) => {
        if (!cancelled) setState(lyrics ? { status: 'ready', lyrics } : { status: 'none' })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [track, attempt])

  return { state, retry: useCallback(() => setAttempt((n) => n + 1), []) }
}

export function LyricsPanel({ track, large = false }: { track: Track; large?: boolean }): React.JSX.Element {
  const { time, seek } = usePlayer()
  const { state, retry } = useLyrics(track)
  const activeRef = useRef<HTMLButtonElement>(null)

  const lines = state.status === 'ready' ? state.lyrics.synced : null
  const active = lines ? activeLine(lines, time) : -1

  // Keep the sung line in view as the song plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active])

  if (state.status === 'loading') return <p className="muted lyrics-note">Mencari lirik...</p>
  if (state.status === 'none') return <p className="muted lyrics-note">Lirik untuk lagu ini belum tersedia.</p>
  if (state.status === 'error') {
    return (
      <div className="lyrics-note">
        <p className="muted">Gagal memuat lirik. Cek koneksi internet kamu.</p>
        <button className="btn secondary" onClick={retry}>
          Coba lagi
        </button>
      </div>
    )
  }
  if (lines) {
    return (
      <div className={`lyrics${large ? ' lyrics-large' : ''}`}>
        {lines.map((l, i) => (
          <button
            key={i}
            ref={i === active ? activeRef : undefined}
            className={`lyric-line${i === active ? ' active' : i < active ? ' past' : ''}`}
            onClick={() => seek(l.timeSec)}
          >
            {l.text || '♪'}
          </button>
        ))}
      </div>
    )
  }
  return <div className={`lyrics lyrics-plain${large ? ' lyrics-large' : ''}`}>{state.lyrics.plain}</div>
}
