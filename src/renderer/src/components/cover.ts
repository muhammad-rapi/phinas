import type { CSSProperties } from 'react'

/**
 * Style for an element with the `cover-bg` class: the cover sits on top of a music-note
 * placeholder, so a song with no cover (or one that fails to load) still shows something.
 */
export function coverStyle(url: string | null | undefined): CSSProperties {
  return { '--cover': url ? `url("${url.replace(/"/g, '%22')}")` : 'none' } as CSSProperties
}
