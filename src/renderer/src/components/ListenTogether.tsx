import { Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'

const ENDED_TEXT: Record<EndReason, string> = {
  ended: 'Sesi diakhiri.',
  declined: 'Ajakan ditolak.',
  expired: 'Ajakan tidak dijawab.',
  timeout: 'Sesi berakhir karena koneksi terputus.',
  version: 'Versi app berbeda. Update app dulu supaya sama.',
  'partner-ended': 'Pasangan mengakhiri sesi.',
  busy: 'Pasangan sedang dengar bareng orang lain.'
}

/** Player bar button: start, cancel or end a session, and show how it is going. */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'

  if (status === 'active') {
    const label = liveLabel(l.state, name)
    return (
      <button className="icon-btn on listen-btn" onClick={l.end} title="Akhiri sesi" aria-label="Akhiri sesi dengarkan bareng">
        <Headphones size={18} />
        <span className="listen-label">
          {name} · {label}
        </span>
      </button>
    )
  }
  if (status === 'inviting') {
    return (
      <button className="icon-btn listen-btn" onClick={l.end} title="Batalkan ajakan" aria-label="Batalkan ajakan">
        <Headphones size={18} />
        <span className="listen-label">Menunggu {name}…</span>
      </button>
    )
  }
  const reason = !connected ? 'Tidak bisa terhubung' : !partnerHere ? `${name} sedang offline` : `Dengarkan bareng ${name}`
  return (
    <button
      className="icon-btn listen-btn"
      onClick={l.invite}
      disabled={!connected || !partnerHere || status === 'invited'}
      title={reason}
      aria-label={reason}
    >
      <Headphones size={18} />
    </button>
  )
}

/** Shown at the top of the page: an incoming invite, or why the last session ended. */
export function ListenBanner(): React.JSX.Element | null {
  const l = useListen()
  const { status, endReason } = l.state
  const [shownEnd, setShownEnd] = useState<EndReason | null>(null)

  useEffect(() => {
    if (status !== 'ended' || !endReason) return
    setShownEnd(endReason)
    const t = setTimeout(() => setShownEnd(null), 4000)
    return () => clearTimeout(t)
  }, [status, endReason])

  if (status === 'invited') {
    return (
      <div className="notice listen-banner" role="alertdialog">
        <span>{l.partnerName ?? 'Pasangan'} mengajak dengarkan bareng.</span>
        <button className="listen-action" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-action" onClick={l.decline}>
          Tolak
        </button>
      </div>
    )
  }
  if (shownEnd) {
    return (
      <div className="notice" role="status" onClick={() => setShownEnd(null)}>
        {ENDED_TEXT[shownEnd]}
      </div>
    )
  }
  return null
}
