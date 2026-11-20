import { createContext, useContext, type ReactNode } from 'react'
import { splitArtists, type Nav } from '../views'

const Ctx = createContext<Nav | null>(null)

/** Lets deep components (track rows, the side panel) open screens without passing `nav` down. */
export function NavProvider({ nav, children }: { nav: Nav; children: ReactNode }): React.JSX.Element {
  return <Ctx.Provider value={nav}>{children}</Ctx.Provider>
}

export const useNav = (): Nav | null => useContext(Ctx)

/** The artist line of a track, each name opening that artist's page. Plain text outside a NavProvider. */
export function ArtistLinks({ artist, className }: { artist: string; className?: string }): React.JSX.Element {
  const nav = useNav()
  const names = splitArtists(artist)
  if (!nav || names.length === 0) return <span className={className}>{artist}</span>
  return (
    <span className={className}>
      {names.map((name, i) => (
        <span key={`${name}-${i}`}>
          {i > 0 && ', '}
          <button
            className="artist-link"
            onClick={(e) => {
              // Rows play on click: opening the artist must not also start the song.
              e.stopPropagation()
              nav({ name: 'artist', id: name })
            }}
          >
            {name}
          </button>
        </span>
      ))}
    </span>
  )
}

/**
 * Props for a clickable card or row that contains artist links. A <button> cannot hold other
 * buttons, so these are divs that act like one (Enter and Space work too).
 */
export function pressable(onPress: () => void): {
  role: 'button'
  tabIndex: 0
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
} {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onPress,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPress()
      }
    }
  }
}
