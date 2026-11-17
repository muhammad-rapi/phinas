import { ListenCard } from '../components/ListenCard'
import { PartnerShelf } from '../components/PartnerShelf'
import { useLibrary } from '../library/LibraryProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  return (
    <>
      <h2 className="page-title">Berdua</h2>
      {listen.available ? (
        <ListenCard />
      ) : (
        <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>
      )}
      <PartnerShelf nav={nav} />
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
