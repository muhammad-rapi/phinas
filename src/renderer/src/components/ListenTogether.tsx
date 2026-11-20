import { Headphones, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { endedText, liveLabel } from '../sync/status'

/**
 * Player bar button. In a session: its status, click to end. Otherwise one click invites the
 * partner when they can be invited; if not, it opens a list of online friends who allow it.
 */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  const social = useSocial()
  const [open, setOpen] = useState(false)
  if (!social.signedIn) return null
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
  const partnerReady = partner !== null && l.canInvite(partner.userId)
  const title = partner && partnerReady ? `Dengar bareng ${partner.name}` : 'Dengar bareng teman'
  const click = (): void => {
    if (partner && partnerReady) l.invite(partner.userId)
    else setOpen((o) => !o)
  }

  return (
    <div className="menu-wrap">
      <button
        className="icon-btn listen-btn"
        onClick={click}
        disabled={status === 'invited'}
        title={title}
        aria-label={title}
        aria-haspopup={partnerReady ? undefined : 'menu'}
        aria-expanded={partnerReady ? undefined : open}
      >
        <Headphones size={18} />
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu listen-menu" role="menu">
            <div className="label menu-title">Dengar bareng</div>
            {l.invitable.length === 0 && <div className="menu-empty">Belum ada teman online yang bisa diajak.</div>}
            {l.invitable.map((f) => (
              <button
                key={f.userId}
                role="menuitem"
                className="menu-item listen-pick"
                disabled={!l.canInvite(f.userId)}
                onClick={() => {
                  setOpen(false)
                  l.invite(f.userId)
                }}
              >
                <span className="online-dot" aria-hidden="true" />
                {f.isPartner && <Heart className="nav-heart" size={11} fill="currentColor" aria-label="Pasangan" />}
                {f.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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
