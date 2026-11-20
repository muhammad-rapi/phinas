import { Play, Shuffle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Track } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'

interface Props {
  cover: ReactNode
  kind: string
  /** A plain title, or a node (e.g. an editable name). */
  title: ReactNode
  meta: string
  /** The list Play and Putar acak start. No buttons when empty. */
  tracks: Track[]
  /** Extra buttons next to Play. */
  children?: ReactNode
}

export function CollectionHeader({ cover, kind, title, meta, tracks, children }: Props): React.JSX.Element {
  const player = usePlayer()
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
        {tracks.length > 0 && (
          <>
            <button className="big-play" onClick={() => player.play(tracks, 0)} aria-label="Putar semua">
              <Play size={26} fill="currentColor" />
            </button>
            <button className="icon-btn big-shuffle" onClick={() => player.shufflePlay(tracks)} aria-label="Putar acak" title="Putar acak">
              <Shuffle size={26} />
            </button>
          </>
        )}
        {children}
      </div>
    </>
  )
}
