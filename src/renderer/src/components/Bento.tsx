import { Children, type ReactNode } from 'react'
import type { Track } from '../../../shared/types'

/**
 * One row of the bento grid. Pass tiles conditionally (`{cond && <Tile …/>}`): a tile left out is
 * dropped, and when only one tile is left it takes the whole row.
 */
export function BentoRow({ children }: { children: ReactNode }): React.JSX.Element | null {
  const tiles = Children.toArray(children)
  if (tiles.length === 0) return null
  return <div className={`bento-row${tiles.length === 1 ? ' single' : ''}`}>{tiles}</div>
}

interface TileProps {
  /** Columns out of 12 when the row has two tiles. */
  span: 4 | 6 | 8
  title?: string
  /** Makes the title a link (for example "Putar lagi" opens Riwayat). */
  onTitle?: () => void
  className?: string
  children: ReactNode
}

export function Tile({ span, title, onTitle, className, children }: TileProps): React.JSX.Element {
  return (
    <section className={`tile span-${span}${className ? ` ${className}` : ''}`}>
      {title &&
        (onTitle ? (
          <button className="tile-title" onClick={onTitle}>
            {title}
          </button>
        ) : (
          <h3 className="tile-title">{title}</h3>
        ))}
      {children}
    </section>
  )
}

/** Tracks as rows (cover, title, artist), optionally numbered. Clicking a row plays from it. */
export function TrackRows({
  tracks,
  numbered,
  onPlay
}: {
  tracks: Track[]
  numbered?: boolean
  onPlay: (index: number) => void
}): React.JSX.Element {
  return (
    <ol className="track-rows">
      {tracks.map((t, i) => (
        <li key={`${t.videoId}-${i}`}>
          <button className="track-row" onClick={() => onPlay(i)}>
            {numbered && <span className="track-row-n">{i + 1}</span>}
            <span className="queue-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
            <span className="queue-text">
              <span className="queue-name">{t.title}</span>
              <span className="muted queue-artist">{t.artist}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
