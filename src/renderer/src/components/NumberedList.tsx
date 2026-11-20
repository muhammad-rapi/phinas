import type { Track } from '../../../shared/types'
import { ArtistLinks, pressable } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import { formatTime } from './TrackRow'
import { coverStyle } from './cover'

const num = (i: number): string => String(i + 1).padStart(2, '0')

interface Props {
  title: string
  /** Makes the serif title a link (Beranda's lists open Jelajah). */
  onTitle?: () => void
  /** null while loading (placeholder rows); an empty list hides the section. */
  tracks: Track[] | null
  failed: boolean
  errorText: string
  onPlay: (index: number) => void
  rows?: number
}

/** A short numbered list: "01  [cover]  Title — Artist". Clicking a row plays the list from it. */
export function NumberedList({ title, onTitle, tracks, failed, errorText, onPlay, rows = 4 }: Props): React.JSX.Element | null {
  const player = usePlayer()
  if (tracks && tracks.length === 0) return null
  return (
    <section className="nl" aria-label={title}>
      {onTitle ? (
        <h2 className="section-title-wrap">
          <button className="section-title" onClick={onTitle}>
            {title}
          </button>
        </h2>
      ) : (
        <h2 className="section-title">{title}</h2>
      )}
      {failed ? (
        <p className="muted">{errorText}</p>
      ) : tracks === null ? (
        <ol className="nl-rows" aria-busy="true">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="nl-row nl-skel">
              <span className="nl-num">{num(i)}</span>
              <span className="nl-cover skeleton" />
              <span className="nl-bar skeleton" />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="nl-rows">
          {tracks.slice(0, rows).map((t, i) => (
            <li key={`${t.videoId}-${i}`}>
              {/* A div acting as a button: it holds artist links, which a <button> cannot. */}
              <div className={`nl-row press${player.track?.videoId === t.videoId ? ' playing' : ''}`} {...pressable(() => onPlay(i))} aria-label={`Putar ${t.title}`}>
                <span className="nl-num">{num(i)}</span>
                <span className="nl-cover cover-bg" style={coverStyle(t.coverUrl)} />
                <span className="nl-text">
                  <span className="nl-title">{t.title}</span>
                  <ArtistLinks className="nl-artist" artist={t.artist} />
                </span>
                <span className="nl-time">{t.durationSec > 0 ? formatTime(t.durationSec) : ''}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
