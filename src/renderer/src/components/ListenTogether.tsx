import { Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useListen } from '../sync/ListenTogetherProvider'
import { endedText, liveLabel } from '../sync/status'

/** Player bar button: invite the partner, cancel or end a session, and show how it is going. */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  const { status } = l.state
  const name = l.activeName

  if (status === 'active') {
    const label = liveLabel(l.state, name)
    return (
      <button className="icon-btn on listen-btn" onClick={l.end} title="Akhiri sesi" aria-label="Akhiri sesi dengar bareng">
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
  const partner = l.partner
  if (!partner) return null
  const ready = l.canInvite(partner.userId)
  const reason = ready ? `Dengar bareng ${partner.name}` : `${partner.name} sedang offline`
  return (
    <button className="icon-btn listen-btn" onClick={() => l.invite(partner.userId)} disabled={!ready} title={reason} aria-label={reason}>
      <Headphones size={18} />
    </button>
  )
}

/** Shown at the top of the page: an incoming invite, a refusal, or why the last session ended. */
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

  const { notice, dismissNotice } = l
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismissNotice, 4000)
    return () => clearTimeout(t)
    // dismissNotice is a new function on every render; the timer only follows the notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  if (l.pendingInvite) {
    return (
      <div className="notice listen-banner" role="alertdialog">
        <span>{l.pendingInvite.name} mengajak kamu dengar bareng.</span>
        <button className="listen-action" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-action" onClick={l.decline}>
          Tolak
        </button>
      </div>
    )
  }
  if (notice) {
    return (
      <div className="notice" role="status" onClick={dismissNotice}>
        {notice}
      </div>
    )
  }
  if (shownEnd) {
    return (
      <div className="notice" role="status" onClick={() => setShownEnd(null)}>
        {endedText(shownEnd, l.activeName)}
      </div>
    )
  }
  return null
}
