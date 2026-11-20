import { parseMessage, type SyncMessage } from '../../../shared/sync/protocol'
import type { Transport } from '../../../shared/sync/session'

export interface IpcTransport extends Transport {
  dispose(): void
}

/** Talks to the partner through the main process, which owns the Supabase channel. */
export function createIpcTransport(): IpcTransport {
  const msg = new Set<(m: SyncMessage) => void>()
  const pres = new Set<(here: boolean) => void>()
  const conn = new Set<(up: boolean) => void>()
  let here = false
  let up = false

  const setHere = (v: boolean): void => {
    here = v
    pres.forEach((cb) => cb(v))
  }
  const setUp = (v: boolean): void => {
    up = v
    conn.forEach((cb) => cb(v))
  }

  const offs = [
    window.phinas.onListenMessage((raw) => {
      const m = parseMessage(raw)
      if (!m) {
        console.warn('[listen] ignored a malformed message')
        return
      }
      msg.forEach((cb) => cb(m))
    }),
    window.phinas.onListenPresence(setHere),
    window.phinas.onListenConnection(setUp)
  ]

  // Events fired before this transport existed would be lost, so ask for the current values.
  void window.phinas
    .listenStatus()
    .then((s) => {
      if (s.connected !== up) setUp(s.connected)
      if (s.partnerHere !== here) setHere(s.partnerHere)
    })
    .catch(() => {
      /* the next event will bring the state */
    })

  return {
    send: (m) => window.phinas.listenSend(m),
    onMessage: (cb) => {
      msg.add(cb)
      return () => msg.delete(cb)
    },
    onPartnerPresence: (cb) => {
      pres.add(cb)
      cb(here)
      return () => pres.delete(cb)
    },
    onConnection: (cb) => {
      conn.add(cb)
      cb(up)
      return () => conn.delete(cb)
    },
    dispose: () => offs.forEach((off) => off())
  }
}
