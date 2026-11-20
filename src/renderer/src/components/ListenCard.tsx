import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { AccentTitle } from './CollectionHeader'

/** Berdua's listen-together block: invite, waiting, live status. Hidden when not signed in. */
export function ListenCard(): React.JSX.Element | null {
  const l = useListen()
  const partner = l.partner
  if (!partner) return null
  const status = l.activeFriend === partner.userId ? l.state.status : 'idle'
  const connected = true
  const partnerHere = l.canInvite(partner.userId)
  const name = partner.name

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
      <button className="btn" onClick={() => l.invite(partner.userId)} disabled={!connected || !partnerHere}>
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
