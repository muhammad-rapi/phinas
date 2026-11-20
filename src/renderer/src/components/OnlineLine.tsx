import { Fragment } from 'react'
import { inviteTarget, lineText, onlineFriends, onlineLine } from '../social/lists'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'
import { berduaView, type BerduaAction } from './berduaView'

/**
 * Beranda's line between the cover story and the lists. During a session (or an invite either way)
 * it shows that session; otherwise who is online, with Ajak for the partner or the first friend who
 * allows it. Hidden when signed out or nobody is online.
 */
export function OnlineLine({ nav }: { nav: Nav }): React.JSX.Element | null {
  const social = useSocial()
  const l = useListen()
  if (!social.signedIn) return null

  if (l.activeFriend && l.busy) {
    const id = l.activeFriend
    const view = berduaView(l.state, l.activeName)
    const run: Record<BerduaAction, () => void> = {
      end: l.end,
      cancel: l.end,
      accept: l.accept,
      decline: l.decline,
      invite: () => l.invite(id)
    }
    return (
      <div className="berdua-line" role="group" aria-label="Dengar bareng">
        <span className={`online-dot${view.online ? '' : ' off'}`} aria-hidden="true" />
        <button className="berdua-name" onClick={() => nav({ name: 'friend', id })}>
          {l.activeName}
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

  const people = onlineFriends(social.friends, social.online)
  if (people.length === 0) return null
  const parts = onlineLine(people.map((f) => ({ id: f.userId, name: f.name })))
  const target = inviteTarget(people)

  return (
    <div className="berdua-line" role="group" aria-label="Sedang online" title={`Sedang online: ${lineText(parts)}`}>
      <span className="online-dot" aria-hidden="true" />
      <span className="muted">Sedang online:</span>
      <span className="online-names">
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <Fragment key={i}>{p}</Fragment>
          ) : (
            <button key={p.id} className="berdua-name" onClick={() => nav({ name: 'friend', id: p.id })}>
              {p.name}
            </button>
          )
        )}
      </span>
      <span className="berdua-spacer" />
      {target && (
        <button className="text-link" onClick={() => l.invite(target.userId)} disabled={!l.canInvite(target.userId)}>
          Ajak {target.name}
        </button>
      )}
    </div>
  )
}
