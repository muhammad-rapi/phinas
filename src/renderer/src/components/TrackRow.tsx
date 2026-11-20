import { Heart, ListPlus, Play, X } from 'lucide-react'
import { useState } from 'react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { ArtistLinks } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'

export const formatTime = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

interface Props {
  track: Track
  /** Shown instead of the cover's play icon until hovered (e.g. the position in a playlist). */
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
    // Clicking anywhere on the row plays it; the action buttons stop the click from reaching here.
    <div className={`row${isCurrent ? ' playing' : ''}`} onClick={onPlay}>
      <button className="row-cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} aria-label={`Putar ${track.title}`}>
        <span className="row-cover-overlay">
          {index !== undefined && <span className="row-index">{index + 1}</span>}
          <Play size={18} fill="currentColor" className="row-play" />
        </span>
      </button>
      <div className="meta">
        <div className="title">{track.title}</div>
        <ArtistLinks className="muted row-artist" artist={track.artist} />
      </div>
      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu lagu" aria-expanded={menuOpen}>
            <ListPlus size={18} />
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
                <div className="menu-title">Tambah ke playlist</div>
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
            <X size={18} />
          </button>
        )}
      </div>
      <div className="row-time muted">{track.durationSec > 0 ? formatTime(track.durationSec) : ''}</div>
    </div>
  )
}
