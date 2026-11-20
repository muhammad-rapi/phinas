import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { AccentTitle } from './CollectionHeader'

/** Berdua's listen-together block: invite, waiting, live status. Hidden when not signed in. */
export function ListenCard(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'

  let line: string
  let title = 'Dengarkan bareng'
  let actions: React.ReactNode
  if (status === 'active') {
    line = liveLabel(l.state, name)
    title = `Lagi bareng ${name}`
    actions = (
      <button className="btn" onClick={l.end}>
        Akhiri sesi
      </button>
    )
  } else if (status === 'inviting') {
    line = 'Ajakan terkirim'
    title = `Menunggu ${name}…`
    actions = (
      <button className="btn secondary" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    line = `${name} mengajak kamu`
    actions = (
      <>
        <button className="btn" onClick={l.accept}>
          Terima
        </button>
        <button className="btn secondary" onClick={l.decline}>
          Tolak
        </button>
      </>
    )
  } else {
    line = !connected ? 'Tidak bisa terhubung' : partnerHere ? `${name} online` : `${name} sedang offline`
    actions = (
      <button className="btn" onClick={l.invite} disabled={!connected || !partnerHere}>
        Ajak
      </button>
    )
  }

  return (
    <section className={`listen-card${status === 'active' ? ' live' : ''}`}>
      <div className="label accent">{line}</div>
      <div className="listen-card-title">
        <AccentTitle text={title} />
      </div>
      <div className="listen-card-actions">{actions}</div>
    </section>
  )
}
