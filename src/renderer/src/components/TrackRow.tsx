import { Heart, ListPlus, Play, X } from 'lucide-react'
import { useState } from 'react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { ArtistLinks } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import { coverStyle } from './cover'

export const formatTime = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** The labels above a track list: NO · JUDUL · DURASI, over a 1 px ink rule. */
export function TrackListHead(): React.JSX.Element {
  return (
    <div className="tl-head label" aria-hidden="true">
      <span>No</span>
      <span>Judul</span>
      <span />
      <span>Durasi</span>
    </div>
  )
}

interface Props {
  track: Track
  /** Position in the list, shown as the row number. */
  index?: number
  onPlay: () => void
  /** Show a remove button (used inside a playlist). */
  onRemove?: () => void
}

export function TrackRow({ track, index, onPlay, onRemove }: Props): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [menuOpen, setMenuOpen] = useState(false)
  const isCurrent = player.track?.videoId === track.videoId
  const liked = lib.likes.some((x) => x.videoId === track.videoId)

  const toggleLike = async (): Promise<void> => {
    await window.phinas.setLiked(track, !liked)
    await lib.refresh()
  }

  const addTo = async (playlistId: string): Promise<void> => {
    setMenuOpen(false)
    await window.phinas.addTrack(playlistId, track)
    await lib.refresh()
  }

  return (
    // A mouse click anywhere on the row plays it; the action buttons and artist links stop the click
    // from reaching here. The row itself is not a control (it holds buttons): the number cell is
    // the keyboard and screen-reader way to play it.
    <div className={`tl-row${isCurrent ? ' playing' : ''}`} onClick={onPlay}>
      <button
        className="tl-num"
        onClick={(e) => {
          e.stopPropagation()
          onPlay()
        }}
        aria-label={`Putar ${track.title}`}
      >
        {isCurrent ? <Play size={12} fill="currentColor" aria-hidden="true" /> : index !== undefined ? index + 1 : ''}
      </button>
      <div className="tl-main">
        <span className="tl-cover cover-bg" style={coverStyle(track.coverUrl)} aria-hidden="true" />
        <div className="tl-meta">
          <span className="tl-title">{track.title}</span>
          <ArtistLinks className="tl-artist" artist={track.artist} />
        </div>
      </div>
      <div className="tl-actions" onClick={(e) => e.stopPropagation()}>
        <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu lagu" aria-expanded={menuOpen}>
            <ListPlus size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu" role="menu">
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    player.playNext(track)
                  }}
                >
                  Putar berikutnya
                </button>
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    player.addToQueue(track)
                  }}
                >
                  Tambah ke antrean
                </button>
                <div className="label menu-title">Tambah ke playlist</div>
                {lib.playlists.length === 0 && <div className="menu-empty">Belum ada playlist</div>}
                {lib.playlists.map((p) => (
                  <button key={p.id} role="menuitem" className="menu-item" onClick={() => addTo(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {onRemove && (
          <button className="icon-btn" onClick={onRemove} aria-label="Hapus dari playlist">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="tl-time">{track.durationSec > 0 ? formatTime(track.durationSec) : ''}</div>
    </div>
  )
}
