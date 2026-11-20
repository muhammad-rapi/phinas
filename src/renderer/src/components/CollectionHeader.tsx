import { Play, Shuffle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Track } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { splitLastWord } from './titleParts'

/** A title whose last word is set in italic accent ("Lagu yang *disukai*"). */
export function AccentTitle({ text }: { text: string }): React.JSX.Element {
  const [head, last] = splitLastWord(text)
  return (
    <>
      {head && `${head} `}
      <em>{last}</em>
    </>
  )
}

interface Props {
  /** 130 px square: a PlaylistCover (2×2 mosaic), a cover, an icon tile or an artist photo. */
  cover: ReactNode
  /** The label line, e.g. "Playlist", "Album · Hindia", "Artis" (shown in capitals). */
  kind: string
  /** A plain title (its last word becomes italic accent), or a node (e.g. an editable name). */
  title: ReactNode
  meta: string
  /** The list Putar and Acak start. No buttons when empty. */
  tracks: Track[]
  /** Secondary buttons after Putar and Acak. */
  children?: ReactNode
}

export function CollectionHeader({ cover, kind, title, meta, tracks, children }: Props): React.JSX.Element {
  const player = usePlayer()
  return (
    <header className="ch">
      <div className="ch-cover">{cover}</div>
      <div className="ch-info">
        <div className="label accent">{kind}</div>
        <h1 className="ch-title">{typeof title === 'string' ? <AccentTitle text={title} /> : title}</h1>
        {meta && <div className="ch-meta">{meta}</div>}
        <div className="ch-actions">
          {tracks.length > 0 && (
            <>
              <button className="btn" onClick={() => player.play(tracks, 0)}>
                <Play size={13} fill="currentColor" /> Putar
              </button>
              <button className="btn secondary" onClick={() => player.shufflePlay(tracks)}>
                <Shuffle size={13} /> Acak
              </button>
            </>
          )}
          {children}
        </div>
      </div>
    </header>
  )
}
