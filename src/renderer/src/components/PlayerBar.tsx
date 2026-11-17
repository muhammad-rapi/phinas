import {
  Heart,
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
import { usePlayer } from '../player/PlayerProvider'
import { ListenButton } from './ListenTogether'
import { formatTime } from './TrackRow'

const pct = (value: number, max: number): CSSProperties =>
  ({ '--pct': `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }) as CSSProperties

export function PlayerBar(): React.JSX.Element {
  const p = usePlayer()
  const lib = useLibrary()
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
            <div className="pb-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
            <div className="pb-info">
              <div className="pb-title">{p.track.title}</div>
              <div className="muted pb-artist">{p.track.artist}</div>
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
