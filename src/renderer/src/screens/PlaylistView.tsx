import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlaylistWithTracks } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

export function PlaylistView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [pl, setPl] = useState<PlaylistWithTracks | null>(null)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Reload whenever the library changes (track added or removed elsewhere, renamed, ...).
  useEffect(() => {
    let alive = true
    window.phinas.getPlaylist(id).then((p) => {
      if (!alive) return
      setPl(p)
      setMissing(p === null)
    })
    return () => {
      alive = false
    }
  }, [id, lib.playlists])

  if (missing) return <p className="muted">Playlist ini sudah tidak ada.</p>
  if (!pl) return <p className="muted">Memuat...</p>

  const commitName = async (): Promise<void> => {
    setEditing(false)
    const name = draft.trim()
    if (name && name !== pl.name) {
      await window.phinas.renamePlaylist(pl.id, name)
      await lib.refresh()
    }
  }

  const remove = async (): Promise<void> => {
    if (!confirm(`Hapus playlist "${pl.name}"?`)) return
    await window.phinas.deletePlaylist(pl.id)
    await lib.refresh()
    nav({ name: 'home' })
  }

  return (
    <>
      <CollectionHeader
        cover={<PlaylistCover covers={pl.coverUrls} />}
        kind="Playlist"
        title={
          editing ? (
            <input
              className="title-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitName()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <button
              className="title-button"
              title="Klik untuk mengganti nama"
              onClick={() => {
                setDraft(pl.name)
                setEditing(true)
              }}
            >
              {pl.name}
            </button>
          )
        }
        meta={`${pl.tracks.length} lagu`}
        onPlay={pl.tracks.length ? () => player.play(pl.tracks, 0) : undefined}
      >
        <button className="icon-btn" onClick={remove} aria-label="Hapus playlist" title="Hapus playlist">
          <Trash2 size={22} />
        </button>
      </CollectionHeader>

      {pl.tracks.length === 0 && <p className="muted">Playlist ini masih kosong. Cari lagu lalu tambahkan dari menu di barisnya.</p>}
      {pl.tracks.map((t, i) => (
        <TrackRow
          key={t.videoId}
          track={t}
          index={i}
          onPlay={() => player.play(pl.tracks, i)}
          onRemove={async () => {
            await window.phinas.removeTrack(pl.id, t.videoId)
            await lib.refresh()
          }}
        />
      ))}
    </>
  )
}
