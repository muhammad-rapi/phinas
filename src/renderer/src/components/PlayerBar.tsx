import {
  Heart,
  PanelRight,
  PanelTop,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import { usePlayer } from '../player/PlayerProvider'
import { ListenButton } from './ListenTogether'
import { formatTime } from './TrackRow'
import { ArtistLinks, pressable } from '../nav/NavProvider'

const pct = (value: number, max: number): CSSProperties =>
  ({ '--pct': `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }) as CSSProperties

/** The 56 px bar under the content: track, transport and progress, then the side controls. */
export function PlayerBar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }): React.JSX.Element {
  const p = usePlayer()
  const lib = useLibrary()
  const [notch, setNotch] = useNotchEnabled()
  const liked = p.track ? lib.likes.some((x) => x.videoId === p.track!.videoId) : false

  const toggleLike = async (): Promise<void> => {
    if (!p.track) return
    await window.phinas.setLiked(p.track, !liked)
    await lib.refresh()
  }

  const VolumeIcon = p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2

  return (
    <footer className="player" aria-label="Pemutar">
      <div className="player-track">
        {p.track && (
          <>
            <div className="player-open press" {...pressable(onTogglePanel)} aria-pressed={panelOpen} aria-label="Tampilkan panel sedang diputar">
              <span className="player-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
              <span className="player-info">
                <span className="player-title">{p.track.title}</span>
                <ArtistLinks className="player-artist" artist={p.track.artist} />
              </span>
            </div>
            <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
      </div>

      <div className="player-center">
        <div className="player-buttons">
          <button className={`icon-btn${p.shuffle ? ' on' : ''}`} onClick={p.toggleShuffle} aria-label="Acak" aria-pressed={p.shuffle}>
            <Shuffle size={15} />
          </button>
          <button className="icon-btn" onClick={p.prev} aria-label="Sebelumnya">
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button className="player-play" onClick={p.toggle} aria-label="Putar atau jeda">
            {p.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label="Berikutnya">
            <SkipForward size={16} fill="currentColor" />
          </button>
          <button
            className={`icon-btn${p.repeat !== 'off' ? ' on' : ''}`}
            onClick={p.cycleRepeat}
            aria-label={`Ulangi: ${p.repeat}`}
            aria-pressed={p.repeat !== 'off'}
          >
            {p.repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>
        <div className="player-seek">
          <span className="player-time">{formatTime(p.time)}</span>
          <input
            className="slider"
            type="range"
            min={0}
            max={Math.max(p.duration, 1)}
            step={1}
            value={Math.min(p.time, p.duration || 0)}
            style={pct(p.time, p.duration)}
            onChange={(e) => p.seek(Number(e.target.value))}
            aria-label="Posisi lagu"
          />
          <span className="player-time">{formatTime(p.duration)}</span>
        </div>
      </div>

      <div className="player-side">
        <ListenButton />
        {notch !== null && (
          <button
            className={`icon-btn${notch ? ' on' : ''}`}
            onClick={() => setNotch(!notch)}
            aria-pressed={notch}
            aria-label={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
            title={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
          >
            <PanelTop size={15} />
          </button>
        )}
        <button
          className={`icon-btn${panelOpen ? ' on' : ''}`}
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
          aria-label="Tampilkan panel sedang diputar"
          title="Sedang diputar"
        >
          <PanelRight size={15} />
        </button>
        <VolumeIcon size={15} />
        <input
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.volume}
          style={pct(p.volume, 1)}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </footer>
  )
}
