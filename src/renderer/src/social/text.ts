import type { InviteCode } from '../../../shared/types'

export type InviteState =
  | { kind: 'active'; daysLeft: number }
  | { kind: 'used'; by: string }
  | { kind: 'expired' }
  | { kind: 'revoked' }

const DAY_MS = 86_400_000

/** Where an invite code stands at `now`. A used code stays "used" whatever happens to it later. */
export function inviteState(i: InviteCode, now: number): InviteState {
  if (i.usedAt) return { kind: 'used', by: i.usedByName ?? 'seseorang' }
  if (i.revoked) return { kind: 'revoked' }
  const left = Date.parse(i.expiresAt) - now
  if (left <= 0) return { kind: 'expired' }
  return { kind: 'active', daysLeft: Math.ceil(left / DAY_MS) }
}

export function inviteText(s: InviteState): string {
  switch (s.kind) {
    case 'active':
      return `aktif · berlaku ${s.daysLeft} hari lagi`
    case 'used':
      return `dipakai oleh ${s.by}`
    case 'expired':
      return 'kedaluwarsa'
    case 'revoked':
      return 'dicabut'
  }
}

/** The status after a friend's name. */
export function friendStatusText(online: boolean, withYou: boolean): string {
  if (withYou) return 'online · bareng kamu'
  return online ? 'online' : 'offline'
}
