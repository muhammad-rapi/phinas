import type { SessionState } from '../../../shared/sync/session'
import { liveLabel } from '../sync/status'

/** What a Berdua line action does; the component maps each to the provider's call. */
export type BerduaAction = 'end' | 'cancel' | 'accept' | 'decline' | 'invite'

export interface BerduaView {
  /** The status text after the partner's name. */
  text: string
  /** The partner counts as online (connected and on the channel). */
  online: boolean
  actions: { kind: BerduaAction; label: string; disabled?: boolean }[]
}

/** Status text and actions for Beranda's Berdua line, same wording as the listen-together card. */
export function berduaView(
  state: Pick<SessionState, 'status' | 'connected' | 'partnerHere' | 'partnerError'>,
  name: string
): BerduaView {
  const online = state.connected && state.partnerHere
  switch (state.status) {
    case 'invited':
      return {
        text: `${name} mengajak kamu`,
        online,
        actions: [
          { kind: 'accept', label: 'Terima' },
          { kind: 'decline', label: 'Tolak' }
        ]
      }
    case 'inviting':
      return { text: `Menunggu ${name}…`, online, actions: [{ kind: 'cancel', label: 'Batalkan' }] }
    case 'active':
      return { text: liveLabel(state, name), online, actions: [{ kind: 'end', label: 'Akhiri' }] }
    default: {
      const text = !state.connected ? 'tidak terhubung' : state.partnerHere ? 'sedang online' : 'offline'
      return { text, online, actions: [{ kind: 'invite', label: 'Ajak dengar bareng', disabled: !online }] }
    }
  }
}
