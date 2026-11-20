import { Minimize2 } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'
import { LyricsPanel } from './LyricsPanel'

/** The lyrics at full size over the whole app, on the page wash. */
export function LyricsFull({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const { track } = usePlayer()
  if (!track) return null
  return (
    <div className="lyrics-full" role="dialog" aria-label="Lirik layar penuh">
      <header className="lyrics-full-head">
        <div className="lyrics-full-title">
          <strong>{track.title}</strong>
          <span className="muted">{track.artist}</span>
        </div>
        <button className="lyrics-full-close" onClick={onClose} aria-label="Perkecil lirik" title="Perkecil (Esc)">
          <Minimize2 size={18} />
        </button>
      </header>
      <div className="lyrics-full-body">
        <LyricsPanel track={track} large />
      </div>
    </div>
  )
}
