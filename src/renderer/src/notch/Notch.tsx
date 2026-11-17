import { Check, Heart, ListPlus, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { NotchLayout } from '../../../shared/ipc'
import type { LyricLine, NotchState, Playlist } from '../../../shared/types'
import { activeLine } from '../lyrics/active'
import { seekFromPointer } from './seek'

/** Used for the first frame, before the main process sends the real layout. */
const FALLBACK_LAYOUT: NotchLayout = {
  hasNotch: false,
  notchWidth: 0,
  barHeight: 38,
  compact: { w: 300, h: 38 },
  expanded: { w: 440, h: 252 },
  pad: 20
}
/** How long the pill takes to shrink; the window is resized only after that. */
const COLLAPSE_MS = 360

const fmt = (s: number): string => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** Timed lyrics of the current track, or null (none, still loading, or plain text only). */
function useSyncedLyrics(state: NotchState | null): LyricLine[] | null {
  const [lines, setLines] = useState<LyricLine[] | null>(null)
  const track = state?.track ?? null
  useEffect(() => {
    setLines(null)
    if (!track) return
    let cancelled = false
    window.phinas
      .getLyrics(track)
      .then((l) => {
        if (!cancelled) setLines(l?.synced?.length ? l.synced : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [track?.videoId])
  return lines
}

export function Notch(): React.JSX.Element | null {
  const [state, setState] = useState<NotchState | null>(null)
  const [layout, setLayout] = useState<NotchLayout>(FALLBACK_LAYOUT)
  const [open, setOpen] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lyrics = useSyncedLyrics(state)
  // While the user drags the progress bar, show the dragged position instead of the playing one.
  const [scrub, setScrub] = useState<number | null>(null)
  // "Tambah ke playlist": the picker, the playlists, and what was already added for this track.
  const [picker, setPicker] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [added, setAdded] = useState<Record<string, 'added' | 'dup'>>({})
  const trackId = state?.track?.videoId
  useEffect(() => setAdded({}), [trackId])

  useEffect(() => {
    const offState = window.phinas.onNotchState(setState)
    const offLayout = window.phinas.onNotchLayout(setLayout)
    return () => {
      offState()
      offLayout()
    }
  }, [])

  const enter = (): void => {
    clearTimeout(collapseTimer.current)
    setOpen(true)
    window.phinas.setNotchExpanded(true)
  }
  const leave = (): void => {
    setOpen(false)
    setPicker(false)
    clearTimeout(collapseTimer.current)
    // Shrink the window only once the pill has finished shrinking.
    collapseTimer.current = setTimeout(() => window.phinas.setNotchExpanded(false), COLLAPSE_MS)
  }

  if (!state?.track) return null
  const { track } = state
  const idx = lyrics ? activeLine(lyrics, state.time + 0.15) : -1
  const line = lyrics && idx >= 0 ? lyrics[idx].text.trim() : ''
  const next = lyrics && idx + 1 < lyrics.length ? lyrics[idx + 1].text.trim() : ''
  const shownTime = scrub ?? state.time
  const pct = state.duration > 0 ? Math.min(100, (shownTime / state.duration) * 100) : 0
  const scrubAt = (e: React.PointerEvent<HTMLDivElement>): number => {
    const r = e.currentTarget.getBoundingClientRect()
    return seekFromPointer(e.clientX, r.left, r.width, state.duration)
  }
  const cmd = window.phinas.sendPlayerCommand
  const togglePicker = (): void => {
    const next = !picker
    setPicker(next)
    if (next) window.phinas.listPlaylists().then(setPlaylists).catch(() => setPlaylists([]))
  }
  const addTo = (p: Playlist): void => {
    window.phinas
      .addTrack(p.id, track)
      .then((ok) => {
        setAdded((a) => ({ ...a, [p.id]: ok ? 'added' : 'dup' }))
        if (ok) window.phinas.notifyLibraryChanged()
      })
      .catch(() => {})
  }
  const paddingTop = layout.hasNotch ? layout.barHeight + 6 : 18

  // The camera notch is black, so the pill must be too when it merges with it.
  const tone = state.theme === 'light' && !layout.hasNotch ? 'light' : 'dark'
  const size = open ? layout.expanded : layout.compact
  const style = {
    '--accent': state.accent,
    '--accent-text': state.accentText,
    '--grad-top': state.gradTop,
    '--w': `${size.w}px`,
    '--h': `${size.h}px`,
    '--pad': `${layout.pad}px`,
    '--bar': `${layout.barHeight}px`
  } as React.CSSProperties
  // What the compact pill says: the line being sung, otherwise the title.
  const compactText = line || track.title

  return (
    <div className="stage" style={style} onMouseLeave={leave}>
      <div
        className={`pill ${layout.hasNotch ? 'attached' : 'floating'} ${tone}${open ? ' open' : ''}`}
        onMouseEnter={enter}
      >
        {state.theme === 'dynamic' && tone === 'dark' && track.coverUrl && (
          <div key={track.coverUrl} className="ambient" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
        )}
        <div className="tint" />

        {/* Idle: cover, what is being sung, and a live equalizer. */}
        <div className="compact" aria-hidden={open}>
          <div className="side left">
            <div className="cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
            {!layout.hasNotch && (
              <div className="marquee">
                <span key={compactText} className={line ? 'lyric-in' : 'scroll'}>
                  {compactText}
                </span>
              </div>
            )}
          </div>
          {layout.hasNotch && <div style={{ width: layout.notchWidth, flexShrink: 0 }} />}
          <div className="side right">
            <div className={`bars${state.playing ? ' on' : ''}`}>
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="hair">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Hover: full controls and lyrics. Laid out at full size so the pill can grow around it. */}
        <div
          className="full"
          aria-hidden={!open}
          style={{ width: layout.expanded.w, paddingTop }}
        >
          <div className="info">
            <div className="cover big" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
            <div className="meta">
              <div className="title">{track.title}</div>
              <div className="artist">{track.artist}</div>
            </div>
            <button
              className={`ico${picker ? ' on' : ''}`}
              onClick={togglePicker}
              aria-label="Tambah ke playlist"
              title="Tambah ke playlist"
              tabIndex={open ? 0 : -1}
            >
              <ListPlus size={20} />
            </button>
            <button className={`ico like${state.liked ? ' on' : ''}`} onClick={() => cmd('like')} aria-label="Suka" tabIndex={open ? 0 : -1}>
              <Heart size={19} fill={state.liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="lyrics">
            {lyrics ? (
              <>
                <div key={idx} className="now lyric-in">
                  {line || '♪'}
                </div>
                <div className="next">{next}</div>
              </>
            ) : (
              <div className="none">Lirik tersinkron tidak tersedia</div>
            )}
          </div>

          <div className="progress">
            <span>{fmt(shownTime)}</span>
            <div
              className={`bar${scrub !== null ? ' scrubbing' : ''}`}
              role="slider"
              aria-label="Posisi lagu"
              aria-valuemin={0}
              aria-valuemax={Math.round(state.duration)}
              aria-valuenow={Math.round(shownTime)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setScrub(scrubAt(e))
              }}
              onPointerMove={(e) => {
                if (scrub !== null) setScrub(scrubAt(e))
              }}
              onPointerUp={(e) => {
                window.phinas.sendSeek(scrubAt(e))
                setScrub(null)
              }}
              onPointerCancel={() => setScrub(null)}
            >
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
            <span>{fmt(state.duration)}</span>
          </div>

          {picker && (
            <div className="picker" style={{ top: paddingTop + 64 + 8 }}>
              <div className="picker-head">
                <span>Tambah ke playlist</span>
                <button className="ico" onClick={() => setPicker(false)} aria-label="Tutup">
                  <X size={16} />
                </button>
              </div>
              <div className="picker-list">
                {playlists.length === 0 && <div className="picker-empty">Belum ada playlist. Buat dulu di app.</div>}
                {playlists.map((p) => (
                  <button key={p.id} className="picker-row" onClick={() => addTo(p)} disabled={added[p.id] !== undefined}>
                    <span className="picker-name">{p.name}</span>
                    {added[p.id] === 'added' && (
                      <span className="picker-state">
                        <Check size={14} /> Ditambahkan
                      </span>
                    )}
                    {added[p.id] === 'dup' && <span className="picker-state">Sudah ada</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="controls">
            <button className="ico" onClick={() => cmd('prev')} aria-label="Sebelumnya" tabIndex={open ? 0 : -1}>
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              className="ico main"
              onClick={() => cmd('toggle')}
              aria-label={state.playing ? 'Jeda' : 'Putar'}
              tabIndex={open ? 0 : -1}
            >
              {state.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />}
            </button>
            <button className="ico" onClick={() => cmd('next')} aria-label="Berikutnya" tabIndex={open ? 0 : -1}>
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
