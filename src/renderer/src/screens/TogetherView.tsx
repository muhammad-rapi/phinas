import { CoverGrid } from '../components/CoverGrid'
import { ListenCard } from '../components/ListenCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  return (
    <>
      <h1 className="page-title">
        <em>Berdua</em>
      </h1>
      {listen.available ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
      {lib.partner.length > 0 && (
        <section className="sec" aria-label="Playlist pasangan">
          <h2 className="section-title">Playlist pasangan</h2>
          <CoverGrid
            items={lib.partner.map((p) => ({
              key: p.id,
              art: <PlaylistCover covers={p.coverUrls} />,
              title: p.name,
              meta: p.ownerName,
              onOpen: () => nav({ name: 'partner', id: p.id })
            }))}
          />
        </section>
      )}
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
