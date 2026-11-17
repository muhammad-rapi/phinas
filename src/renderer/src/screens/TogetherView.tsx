import { ListenCard } from '../components/ListenCard'
import { MediaCard } from '../components/MediaCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  const player = usePlayer()
  return (
    <>
      <h2 className="page-title">Berdua</h2>
      {listen.available ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
      {lib.partner.length > 0 && (
        <section className="bento-cards" aria-label="Playlist pasangan">
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
        </section>
      )}
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
