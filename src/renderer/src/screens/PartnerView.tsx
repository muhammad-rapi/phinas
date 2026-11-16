import { CopyPlus } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackRow } from '../components/TrackRow'
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
        onPlay={pl.tracks.length ? () => player.play(pl.tracks, 0) : undefined}
      >
        <button className="pill-btn" onClick={copy}>
          <CopyPlus size={18} />
          <span>Salin ke library saya</span>
        </button>
      </CollectionHeader>
      {pl.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
