import { Headphones } from 'lucide-react'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'

/** The listen-together call to action: invite, waiting, live status. Hidden when not signed in. */
interface Props {
  /** The Home tile: stacked, smaller, and sized as a 4-column bento tile. */
  compact?: boolean
  /** Makes the title a link (Home opens the Berdua screen). */
  onOpen?: () => void
}

export function ListenCard({ compact = false, onOpen }: Props = {}): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'

  let line: string
  let title = 'Dengarkan bareng'
  let actions: React.ReactNode
  if (status === 'active') {
    line = `● ${liveLabel(l.state, name)}`
    title = `Lagi bareng ${name}`
    actions = (
      <button className="listen-card-btn" onClick={l.end}>
        Akhiri sesi
      </button>
    )
  } else if (status === 'inviting') {
    line = 'Ajakan terkirim'
    title = `Menunggu ${name}…`
    actions = (
      <button className="listen-card-btn ghost" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    line = `${name} mengajak kamu`
    actions = (
      <>
        <button className="listen-card-btn" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-card-btn ghost" onClick={l.decline}>
          Tolak
        </button>
      </>
    )
  } else {
    line = !connected ? '● Tidak bisa terhubung' : partnerHere ? `● ${name} online` : `● ${name} sedang offline`
    actions = (
      <button className="listen-card-btn" onClick={l.invite} disabled={!connected || !partnerHere}>
        Ajak
      </button>
    )
  }

  return (
    <section className={`listen-card${compact ? ' compact span-4' : ''}${status === 'active' ? ' live' : ''}`}>
      <Headphones size={compact ? 22 : 28} className="listen-card-icon" />
      <div className="listen-card-text">
        <div className="listen-card-line">{line}</div>
        {onOpen ? (
          <button className="listen-card-title link" onClick={onOpen}>
            {title}
          </button>
        ) : (
          <div className="listen-card-title">{title}</div>
        )}
      </div>
      <div className="listen-card-actions">{actions}</div>
    </section>
  )
}
