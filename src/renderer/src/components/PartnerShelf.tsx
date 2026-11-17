import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'
import { MediaCard } from './MediaCard'
import { PlaylistCover } from './PlaylistCover'
import { Shelf } from './Shelf'

/** The partner's playlists as a shelf. Renders nothing when there are none. */
export function PartnerShelf({ nav }: { nav: Nav }): React.JSX.Element | null {
  const lib = useLibrary()
  const player = usePlayer()
  if (lib.partner.length === 0) return null
  return (
    <Shelf title="Dari pasangan">
      {lib.partner.map((p) => (
        <MediaCard
          key={p.id}
          art={<PlaylistCover covers={p.coverUrls} />}
          title={p.name}
          subtitle={p.ownerName}
          onOpen={() => nav({ name: 'partner', id: p.id })}
          onPlay={() => p.tracks.length && player.play(p.tracks, 0)}
        />
      ))}
    </Shelf>
  )
}
