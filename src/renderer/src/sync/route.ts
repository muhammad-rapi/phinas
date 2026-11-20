import type { SessionStatus } from '../../../shared/sync/session'

/** Where an incoming invite goes. */
export type InviteRoute =
  /** From the friend of the current session: that session handles it (both inviting at once, a repeat). */
  | 'session'
  /** Nothing going on: start a session with this friend and show the invite. */
  | 'new'
  /** A session or another invite is open: answer "busy" on this friend's channel. */
  | 'busy'

export interface RouteState {
  /** The friend of the current (or last) session, or null. */
  activeFriend: string | null
  status: SessionStatus
}

/** One session at a time: decides what an invite from `from` does. */
export function routeInvite(cur: RouteState, from: string): InviteRoute {
  if (cur.activeFriend === null || cur.status === 'idle' || cur.status === 'ended') return 'new'
  return cur.activeFriend === from ? 'session' : 'busy'
}
