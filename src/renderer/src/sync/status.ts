import type { EndReason, SessionState } from '../../../shared/sync/session'

/** One line describing how an active session is going. Used by the button, the online line and the side panel. */
export function liveLabel(state: Pick<SessionState, 'connected' | 'partnerHere' | 'partnerError'>, name: string): string {
  if (!state.connected) return 'Koneksi terputus'
  if (!state.partnerHere) return `${name} terputus`
  if (state.partnerError) return `${name}: gagal memutar`
  return 'Tersambung'
}

/** Why the last session or invite ended, naming the friend it was with. */
export function endedText(reason: EndReason, name: string): string {
  switch (reason) {
    case 'ended':
      return 'Sesi diakhiri.'
    case 'declined':
      return `${name} menolak ajakan.`
    case 'expired':
      return `${name} tidak menjawab ajakan.`
    case 'timeout':
      return 'Sesi berakhir karena koneksi terputus.'
    case 'version':
      return 'Versi app berbeda. Update app dulu supaya sama.'
    case 'partner-ended':
      return `${name} mengakhiri sesi.`
    case 'busy':
      return `${name} sedang dengar bareng orang lain.`
  }
}
