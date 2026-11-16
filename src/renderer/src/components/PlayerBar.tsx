import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function PlayerBar(): React.JSX.Element {
  const p = usePlayer()
  return (
    <div className="playerbar">
      <div className="pb-track">
        {p.track && (
          <>
            <div className="cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.track.title}
              </div>
              <div className="muted">{p.track.artist}</div>
            </div>
          </>
        )}
      </div>
      <div className="pb-controls">
        <div className="pb-buttons">
          <button className="icon-btn" onClick={p.prev} aria-label="Sebelumnya">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="play-btn" onClick={p.toggle} aria-label="Putar atau jeda">
            {p.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label="Berikutnya">
            <SkipForward size={20} fill="currentColor" />
          </button>
        </div>
        <div className="pb-seek">
          <span>{fmt(p.time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(p.duration, 1)}
            step={1}
            value={Math.min(p.time, p.duration || 0)}
            onChange={(e) => p.seek(Number(e.target.value))}
            aria-label="Posisi lagu"
          />
          <span>{fmt(p.duration)}</span>
        </div>
      </div>
      <div className="pb-volume">
        {p.volume === 0 ? <VolumeX size={18} /> : p.volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.volume}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
