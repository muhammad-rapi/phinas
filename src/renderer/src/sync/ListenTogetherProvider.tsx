import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { INITIAL_STATE, SyncSession, type PlayerPort, type SessionState } from '../../../shared/sync/session'
import type { ListenInfo } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { createIpcTransport } from './ipcTransport'

interface ListenApi {
  /** False until signed in and a partner account exists. */
  available: boolean
  partnerName: string | null
  state: SessionState
  invite(): void
  accept(): void
  decline(): void
  end(): void
}

const Ctx = createContext<ListenApi | null>(null)

export function useListen(): ListenApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useListen must be used inside ListenTogetherProvider')
  return v
}

const RETRY_MS = 15_000

export function ListenTogetherProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const player = usePlayer()
  const playerRef = useRef(player)
  playerRef.current = player
  const [info, setInfo] = useState<ListenInfo | null>(null)
  const [state, setState] = useState<SessionState>(INITIAL_STATE)
  const sessionRef = useRef<SyncSession | null>(null)

  // Join the pair channel. Keep trying until signed in and a partner exists.
  useEffect(() => {
    let alive = true
    let opened = false
    const tryOpen = async (): Promise<void> => {
      const i = await window.phinas.listenOpen().catch(() => null)
      if (!alive || !i) return
      opened = true
      setInfo(i)
    }
    void tryOpen()
    const t = setInterval(() => {
      if (!opened) void tryOpen()
    }, RETRY_MS)
    return () => {
      alive = false
      clearInterval(t)
      void window.phinas.listenClose()
    }
  }, [])

  // One session for as long as the channel is open.
  useEffect(() => {
    if (!info) return
    const transport = createIpcTransport()
    const port: PlayerPort = {
      snapshot: () => playerRef.current.sync.snapshot(),
      apply: (a) => playerRef.current.sync.apply(a),
      setRate: (r) => playerRef.current.sync.setRate(r)
    }
    const session = new SyncSession({ me: info.me, transport, player: port })
    sessionRef.current = session
    const off = session.subscribe(() => setState(session.getState()))
    setState(session.getState())
    playerRef.current.sync.bind({
      action: (a) => session.localAction(a),
      streamError: (id) => session.reportStreamError(id)
    })
    return () => {
      off()
      playerRef.current.sync.bind(null)
      session.dispose()
      transport.dispose()
      sessionRef.current = null
      setState(INITIAL_STATE)
    }
  }, [info])

  // Tell the main process about a new invite so it can notify outside the app.
  const notifiedFor = useRef(false)
  useEffect(() => {
    if (state.status !== 'invited') {
      notifiedFor.current = false
      return
    }
    if (notifiedFor.current) return
    notifiedFor.current = true
    window.phinas.notifyListenInvite(info?.partnerName ?? '')
  }, [state.status, info?.partnerName])

  const api = useMemo<ListenApi>(
    () => ({
      available: info !== null,
      partnerName: info?.partnerName ?? null,
      state,
      invite: () => sessionRef.current?.invite(),
      accept: () => sessionRef.current?.accept(),
      decline: () => sessionRef.current?.decline(),
      end: () => sessionRef.current?.end()
    }),
    [info, state]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
