import { CopyPlus } from 'lucide-react'
import { useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { rememberedPlaylist } from '../social/playlistCache'
import type { Nav } from '../views'

/** A friend's shared playlist or a public one: read-only, with "Salin ke library saya". */
export function FriendPlaylistView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pl = lib.friends.find((p) => p.id === id) ?? rememberedPlaylist(id)

  if (!pl) return <p className="muted">Playlist ini tidak tersedia.</p>

  const copy = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const c = await window.phinas.copyFriendPlaylist(pl)
      await lib.refresh()
      nav({ name: 'playlist', id: c.id })
    } catch (e) {
      setError(friendlyError(e))
      setBusy(false)
    }
  }

  return (
    <>
      <CollectionHeader
        cover={<PlaylistCover covers={pl.coverUrls} />}
        kind={`Playlist dari ${pl.ownerName}`}
        title={pl.name}
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="btn secondary" onClick={() => void copy()} disabled={busy}>
          <CopyPlus size={13} /> {busy ? 'Menyalin…' : 'Salin ke library saya'}
        </button>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
