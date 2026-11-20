import type { SyncMessage } from '../../../shared/sync/protocol'
import type { Transport } from '../../../shared/sync/session'

/** One friend's pair channel as the renderer sees it. */
export interface Link {
  /** Our own connection to the channel is up. */
  up: boolean
  /** The friend is on the channel. */
  here: boolean
}

export const DOWN: Link = { up: false, here: false }

/** A session transport for one friend. The provider feeds it; it never touches IPC itself. */
export interface FriendTransport extends Transport {
  /** A message from this friend, already validated. */
  deliver(m: SyncMessage): void
  /** The channel's state changed; subscribers hear only what changed. */
  setLink(link: Link): void
}

export function createFriendTransport(send: (m: SyncMessage) => void, initial: Link = DOWN): FriendTransport {
  const msg = new Set<(m: SyncMessage) => void>()
  const pres = new Set<(here: boolean) => void>()
  const conn = new Set<(up: boolean) => void>()
  let link = initial
  return {
    send,
    onMessage: (cb) => {
      msg.add(cb)
      return () => msg.delete(cb)
    },
    onPartnerPresence: (cb) => {
      pres.add(cb)
      cb(link.here)
      return () => pres.delete(cb)
    },
    onConnection: (cb) => {
      conn.add(cb)
      cb(link.up)
      return () => conn.delete(cb)
    },
    deliver: (m) => msg.forEach((cb) => cb(m)),
    setLink: (next) => {
      const prev = link
      link = next
      if (next.up !== prev.up) conn.forEach((cb) => cb(next.up))
      if (next.here !== prev.here) pres.forEach((cb) => cb(next.here))
    }
  }
}
