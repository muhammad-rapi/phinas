import { Minimize2 } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'
import { LyricsPanel } from './LyricsPanel'

/** The lyrics at full size over the whole app, on a blurred copy of the cover. */
export function LyricsFull({ cover, onClose }: { cover: string | null; onClose: () => void }): React.JSX.Element | null {
  const { track } = usePlayer()
  if (!track) return null
  return (
    <div className="lyrics-full" role="dialog" aria-label="Lirik layar penuh">
      {cover && <div className="lyrics-full-bg" style={{ backgroundImage: `url("${cover}")` }} />}
      <header className="lyrics-full-head">
        <div className="lyrics-full-title">
          <strong>{track.title}</strong>
          <span className="muted">{track.artist}</span>
        </div>
        <button className="round-btn" onClick={onClose} aria-label="Perkecil lirik" title="Perkecil (Esc)">
          <Minimize2 size={20} />
        </button>
      </header>
      <div className="lyrics-full-body">
        <LyricsPanel track={track} large />
      </div>
    </div>
  )
}
