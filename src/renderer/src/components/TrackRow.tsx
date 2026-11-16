import { Heart, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Playlist, Track } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'

const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

interface Props {
  track: Track
  onPlay: () => void
  /** Show a remove button (used inside a playlist). */
  onRemove?: () => void
  /** Show the add-to-playlist picker. */
  playlists?: Playlist[]
}

export function TrackRow({ track, onPlay, onRemove, playlists }: Props): React.JSX.Element {
  const { track: playing } = usePlayer()
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    let alive = true
    window.phinas.listLikes().then((l) => alive && setLiked(l.some((x) => x.videoId === track.videoId)))
    return () => {
      alive = false
    }
  }, [track.videoId])

  const toggleLike = async (): Promise<void> => {
    await window.phinas.setLiked(track, !liked)
    setLiked(!liked)
  }

  const addTo = async (playlistId: string): Promise<void> => {
    if (playlistId) await window.phinas.addTrack(playlistId, track)
  }

  return (
    <div className={`row${playing?.videoId === track.videoId ? ' playing' : ''}`}>
      <button className="cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} onClick={onPlay} aria-label="Putar" />
      <div className="meta">
        <div className="title">{track.title}</div>
        <div className="muted">
          {track.artist} · {fmt(track.durationSec)}
        </div>
      </div>
      <div>
        <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label="Suka">
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        </button>
        {onRemove && (
          <button className="icon-btn" onClick={onRemove} aria-label="Hapus dari playlist">
            <X size={18} />
          </button>
        )}
      </div>
      {playlists ? (
        <select
          value=""
          onChange={(e) => addTo(e.target.value)}
          aria-label="Tambah ke playlist"
          disabled={playlists.length === 0}
        >
          <option value="">{playlists.length ? '+ Playlist' : 'Belum ada playlist'}</option>
          {playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <span />
      )}
    </div>
  )
}
