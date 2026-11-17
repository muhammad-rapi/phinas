import type { SessionState } from '../../../shared/sync/session'

/** One line describing how an active session is going. Used by the button, the card and the side panel. */
export function liveLabel(state: Pick<SessionState, 'connected' | 'partnerHere' | 'partnerError'>, name: string): string {
  if (!state.connected) return 'Koneksi terputus'
  if (!state.partnerHere) return `${name} terputus`
  if (state.partnerError) return `${name}: gagal memutar`
  return 'Tersambung'
}
