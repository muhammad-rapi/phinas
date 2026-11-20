import { useListen } from '../sync/ListenTogetherProvider'

/**
 * Beranda's partner line: online dot, name (opens Berdua), presence, and the Listen Together
 * action of the current state. Only when signed in with a partner.
 */
export function BerduaLine({ onOpen }: { onOpen: () => void }): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'Pasangan'
  const online = connected && partnerHere
  const presence = !connected ? 'tidak terhubung' : partnerHere ? 'sedang online' : 'offline'

  let action: React.ReactNode
  if (status === 'active') {
    action = (
      <button className="text-link" onClick={l.end}>
        Akhiri
      </button>
    )
  } else if (status === 'inviting') {
    action = (
      <button className="text-link" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    action = (
      <span className="berdua-actions">
        <button className="text-link" onClick={l.accept}>
          Terima
        </button>
        <span aria-hidden="true">·</span>
        <button className="text-link" onClick={l.decline}>
          Tolak
        </button>
      </span>
    )
  } else {
    action = (
      <button className="text-link" onClick={l.invite} disabled={!online}>
        Ajak dengar bareng
      </button>
    )
  }

  return (
    <div className="berdua-line" role="group" aria-label="Berdua">
      <span className={`online-dot${online ? '' : ' off'}`} aria-hidden="true" />
      <button className="berdua-name" onClick={onOpen}>
        {name}
      </button>
      <span className="muted">{presence}</span>
      <span className="berdua-spacer" />
      {action}
    </div>
  )
}
