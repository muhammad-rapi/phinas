import { CopyPlus } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

export function PartnerView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const pl = lib.partner.find((p) => p.id === id)

  if (!pl) return <p className="muted">Playlist pasangan ini tidak tersedia.</p>

  const copy = async (): Promise<void> => {
    const c = await window.phinas.copyPartnerPlaylist(pl)
    await lib.refresh()
    nav({ name: 'playlist', id: c.id })
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
        <button className="btn secondary" onClick={copy}>
          <CopyPlus size={13} /> Salin ke library saya
        </button>
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
