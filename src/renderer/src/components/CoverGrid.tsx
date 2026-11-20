import type { ReactNode } from 'react'

export interface GridItem {
  key: string
  title: string
  meta?: string
  /** A cover URL, or a node such as a PlaylistCover. */
  art: string | ReactNode
  onOpen: () => void
}

/** Square covers in a grid, title and meta under each (artist releases, search playlists, …). */
/** `strip` keeps a single row: covers that do not fit are left out (Beranda). */
export function CoverGrid({ items, four = false, strip = false }: { items: GridItem[]; four?: boolean; strip?: boolean }): React.JSX.Element {
  return (
    <div className={`grid-covers${four ? ' four' : ''}${strip ? ' strip' : ''}`}>
      {items.map((it) => (
        <button key={it.key} className="grid-item" onClick={it.onOpen} title={it.title}>
          {typeof it.art === 'string' ? <span className="grid-art" style={{ backgroundImage: `url("${it.art}")` }} /> : it.art}
          <span className="grid-title">{it.title}</span>
          {it.meta && <span className="grid-meta">{it.meta}</span>}
        </button>
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
