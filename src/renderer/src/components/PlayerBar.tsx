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
    <div className="playerbar">
      <div className="pb-track">
        {p.track && (
          <>
            <div className="pb-open press" {...pressable(onTogglePanel)} aria-pressed={panelOpen} aria-label="Tampilkan panel sedang diputar">
              <span className="pb-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
              <span className="pb-info">
                <span className="pb-title">{p.track.title}</span>
                <ArtistLinks className="muted pb-artist" artist={p.track.artist} />
              </span>
            </div>
            <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
      </div>

      <div className="pb-controls">
        <div className="pb-buttons">
          <button className={`icon-btn${p.shuffle ? ' on' : ''}`} onClick={p.toggleShuffle} aria-label="Acak" aria-pressed={p.shuffle}>
            <Shuffle size={18} />
          </button>
          <button className="icon-btn" onClick={p.prev} aria-label="Sebelumnya">
            <SkipBack size={22} fill="currentColor" />
          </button>
          <button className="play-btn" onClick={p.toggle} aria-label="Putar atau jeda">
            {p.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label="Berikutnya">
            <SkipForward size={22} fill="currentColor" />
          </button>
          <button
            className={`icon-btn${p.repeat !== 'off' ? ' on' : ''}`}
            onClick={p.cycleRepeat}
            aria-label={`Ulangi: ${p.repeat}`}
            aria-pressed={p.repeat !== 'off'}
          >
            {p.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <div className="pb-seek">
          <span className="pb-time">{formatTime(p.time)}</span>
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
          <span className="pb-time">{formatTime(p.duration)}</span>
        </div>
      </div>

      <div className="pb-volume">
        <ListenButton />
        {notch !== null && (
          <button
            className={`icon-btn${notch ? ' on' : ''}`}
            onClick={() => setNotch(!notch)}
            aria-pressed={notch}
            aria-label={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
            title={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
          >
            <PanelTop size={18} />
          </button>
        )}
        <button
          className={`icon-btn${panelOpen ? ' on' : ''}`}
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
          aria-label="Tampilkan panel sedang diputar"
          title="Sedang diputar"
        >
          <PanelRight size={18} />
        </button>
        <VolumeIcon size={18} />
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
    </div>
  )
}
