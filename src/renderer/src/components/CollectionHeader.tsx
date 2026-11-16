import { Play } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  cover: ReactNode
  kind: string
  /** A plain title, or a node (e.g. an editable name). */
  title: ReactNode
  meta: string
  onPlay?: () => void
  /** Extra buttons next to Play. */
  children?: ReactNode
}

export function CollectionHeader({ cover, kind, title, meta, onPlay, children }: Props): React.JSX.Element {
  return (
    <>
      <div className="collection-head">
        <div className="collection-cover">{cover}</div>
        <div className="collection-info">
          <div className="muted collection-kind">{kind}</div>
          <h1 className="collection-title">{title}</h1>
          <div className="muted">{meta}</div>
        </div>
      </div>
      <div className="collection-actions">
        {onPlay && (
          <button className="big-play" onClick={onPlay} aria-label="Putar semua">
            <Play size={26} fill="currentColor" />
          </button>
        )}
        {children}
      </div>
    </>
  )
}
