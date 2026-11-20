import { Fragment } from 'react'
import { useListen } from '../sync/ListenTogetherProvider'
import { berduaView, type BerduaAction } from './berduaView'

/**
 * Beranda's partner line: online dot, name (opens Berdua), session status or presence, and the
 * Listen Together actions of the current state. Only when signed in with a partner.
 */
export function BerduaLine({ onOpen }: { onOpen: () => void }): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const name = l.partnerName ?? 'Pasangan'
  const view = berduaView(l.state, name)
  const run: Record<BerduaAction, () => void> = {
    end: l.end,
    cancel: l.end,
    accept: l.accept,
    decline: l.decline,
    invite: l.invite
  }

  return (
    <div className="berdua-line" role="group" aria-label="Berdua">
      <span className={`online-dot${view.online ? '' : ' off'}`} aria-hidden="true" />
      <button className="berdua-name" onClick={onOpen}>
        {name}
      </button>
      <span className="muted">{view.text}</span>
      <span className="berdua-spacer" />
      <span className="berdua-actions">
        {view.actions.map((a, i) => (
          <Fragment key={a.kind}>
            {i > 0 && <span aria-hidden="true">·</span>}
            <button className="text-link" onClick={run[a.kind]} disabled={a.disabled}>
              {a.label}
            </button>
          </Fragment>
        ))}
      </span>
    </div>
  )
}
