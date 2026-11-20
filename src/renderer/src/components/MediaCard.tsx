import { Play } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  /** The artwork (a PlaylistCover or a plain cover). */
  art: ReactNode
  title: string
  subtitle?: string
  onOpen: () => void
  /** Adds the round play button that appears on hover. */
  onPlay?: () => void
  /** Landscape artwork (video thumbnails). */
  wide?: boolean
}

export function MediaCard({ art, title, subtitle, onOpen, onPlay, wide }: Props): React.JSX.Element {
  return (
    <div className={`mcard${wide ? ' mcard-wide' : ''}`}>
      <button className="mcard-main" onClick={onOpen}>
        <div className="mcard-art">{art}</div>
        <strong className="mcard-title">{title}</strong>
        {subtitle && <span className="muted mcard-sub">{subtitle}</span>}
      </button>
      {onPlay && (
        <button className="mcard-play" onClick={onPlay} aria-label={`Putar ${title}`}>
          <Play size={20} fill="currentColor" />
        </button>
      )}
    </div>
  )
}

export function CoverArt({ url }: { url: string }): React.JSX.Element {
  return <div className="pcover" style={{ backgroundImage: `url("${url}")` }} />
}
