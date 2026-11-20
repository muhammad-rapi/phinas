import { Music } from 'lucide-react'
import type { ReactNode } from 'react'
import { ArtistLinks, pressable } from '../nav/NavProvider'

export interface GridItem {
  key: string
  title: string
  meta?: string
  /** A song's artist line: each name opens the artist page. Shown instead of `meta`. */
  artist?: string
  /** A cover URL, or a node such as a PlaylistCover. */
  art: string | ReactNode
  onOpen: () => void
}

/** Square covers in a grid, title and meta under each (artist releases, search playlists, …). */
/** `strip` keeps a single row: covers that do not fit are left out (Beranda). */
export function CoverGrid({
  items,
  four = false,
  strip = false,
  count
}: {
  items: GridItem[]
  four?: boolean
  strip?: boolean
  /** Covers in a strip on a wide page (default 5). */
  count?: number
}): React.JSX.Element {
  return (
    <div
      className={`grid-covers${four ? ' four' : ''}${strip ? ' strip' : ''}`}
      style={count ? ({ '--n-wide': count } as React.CSSProperties) : undefined}
    >
      {items.map((it) => (
        // A div acting as a button: it may hold artist links, which a <button> cannot.
        <div key={it.key} className="grid-item press" {...pressable(it.onOpen)} title={it.title}>
          {typeof it.art !== 'string' ? (
            it.art
          ) : (
            // The music note sits under the cover: it shows when there is no cover or it fails to load.
            <span className="grid-art grid-art-empty" aria-hidden="true">
              <Music size={28} />
              {it.art && <span className="grid-art-img" style={{ backgroundImage: `url("${it.art}")` }} />}
            </span>
          )}
          <span className="grid-title">{it.title}</span>
          {it.artist ? <ArtistLinks className="grid-meta" artist={it.artist} /> : it.meta && <span className="grid-meta">{it.meta}</span>}
        </div>
      ))}
    </div>
  )
}

/** Placeholder squares while a grid loads. */
export function CoverGridSkeleton({ count, four = false }: { count: number; four?: boolean }): React.JSX.Element {
  return (
    <div className={`grid-covers${four ? ' four' : ''}`} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="grid-art skeleton" />
      ))}
    </div>
  )
}
