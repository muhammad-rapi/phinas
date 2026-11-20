import { CopyPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PublicPlaylistDetail } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'
import { coverStyle } from '../components/cover'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; playlist: PublicPlaylistDetail }

interface Props {
  id: string
  author?: string
  /** An album or single (opened from an artist page) instead of a playlist. */
  album?: boolean
  nav: Nav
}

/** A playlist or album from YouTube Music's public catalogue: play it, or save a copy to the library. */
export function PublicPlaylistView({ id, author, album = false, nav }: Props): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    ;(album ? window.phinas.getAlbum(id) : window.phinas.getPublicPlaylist(id))
      .then((playlist) => !cancelled && setState({ status: 'ready', playlist }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [id, album])

  const noun = album ? 'album' : 'playlist'
  if (state.status === 'loading') return <p className="muted">Memuat {noun}...</p>
  if (state.status === 'error') return <div className="notice">{album ? 'Album' : 'Playlist'} ini tidak bisa dibuka. Cek koneksi internet kamu.</div>

  const pl = state.playlist
  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const copy = await window.phinas.createPlaylist(pl.title)
      for (const t of pl.tracks) await window.phinas.addTrack(copy.id, t)
      await lib.refresh()
      nav({ name: 'playlist', id: copy.id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CollectionHeader
        cover={<div className="pcover cover-bg" style={coverStyle(pl.coverUrl)} />}
        kind={album ? `Album · ${pl.author}` : `Playlist dari ${author ?? pl.author}`}
        title={pl.title}
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="btn secondary" onClick={() => void save()} disabled={saving || pl.tracks.length === 0}>
          <CopyPlus size={13} /> {saving ? 'Menyimpan...' : 'Simpan ke library saya'}
        </button>
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={`${t.videoId}-${i}`} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
