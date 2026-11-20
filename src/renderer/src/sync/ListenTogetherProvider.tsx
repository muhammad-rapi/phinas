import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { friendlyError } from '../../../shared/errors'
import { parseMessage } from '../../../shared/sync/protocol'
import { INITIAL_STATE, SyncSession, type PlayerPort, type SessionState, type SessionStatus } from '../../../shared/sync/session'
import type { Friend, PairClosedReason } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { useSocial } from '../social/SocialProvider'
import { createFriendTransport, DOWN, type FriendTransport, type Link } from './friendTransport'
import { routeInvite } from './route'

export interface ListenApi {
  state: SessionState
  /** The friend of the current (or last) session, or null. */
  activeFriend: string | null
  /** That friend's name, for status texts ("Teman" when there is none). */
  activeName: string
  /** An invite waiting for Terima / Tolak. */
  pendingInvite: { friendId: string; name: string } | null
  /** The partner, online or not. */
  partner: Friend | null
  /** Online friends who allow Listen Together, partner first. */
  invitable: Friend[]
  /** A session or an invite (either way) is going on. */
  busy: boolean
  /** A refusal to show once ("not allowed"). */
  notice: string | null
  /** An invite to this friend can go out now: allowed, online, both on the channel, nothing else going on. */
  canInvite(friendId: string): boolean
  invite(friendId: string): void
  accept(): void
  decline(): void
  /** Ends an active session, or cancels an invite we sent. */
  end(): void
  dismissNotice(): void
}

const Ctx = createContext<ListenApi | null>(null)

export function useListen(): ListenApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useListen must be used inside ListenTogetherProvider')
  return v
}

interface Live {
  friendId: string
  session: SyncSession
  transport: FriendTransport
}

const isBusy = (s: SessionStatus): boolean => s === 'inviting' || s === 'invited' || s === 'active'

/**
 * Listen Together with any online friend, one session at a time. The main process keeps a pair
 * channel per eligible friend; this routes their events to the one live session and answers other
 * invites with "busy".
 */
export function ListenTogetherProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const player = usePlayer()
  const playerRef = useRef(player)
  playerRef.current = player
  const social = useSocial()
  const meRef = useRef<string | null>(null)
  meRef.current = social.me?.id ?? null
  const [links, setLinks] = useState<Record<string, Link>>({})
  const linksRef = useRef<Record<string, Link>>({})
  const [active, setActive] = useState<string | null>(null)
  const [state, setState] = useState<SessionState>(INITIAL_STATE)
  const [notice, setNotice] = useState<string | null>(null)
  const liveRef = useRef<Live | null>(null)

  // Built once: everything here reads refs, so it never goes stale.
  const ops = useMemo(() => {
    const port: PlayerPort = {
      snapshot: () => playerRef.current.sync.snapshot(),
      apply: (a) => playerRef.current.sync.apply(a),
      setRate: (r) => playerRef.current.sync.setRate(r)
    }

    const stop = (): void => {
      const live = liveRef.current
      if (!live) return
      liveRef.current = null
      playerRef.current.sync.bind(null)
      live.session.dispose()
    }

    /** A fresh session with this friend, replacing any earlier (finished) one. */
    const start = (friendId: string): Live | null => {
      const me = meRef.current
      if (!me) return null
      stop()
      const transport = createFriendTransport((m) => window.phinas.listenSend(friendId, m), linksRef.current[friendId] ?? DOWN)
      const session = new SyncSession({ me, transport, player: port })
      session.subscribe(() => setState(session.getState()))
      playerRef.current.sync.bind({
        action: (a) => session.localAction(a),
        streamError: (id) => session.reportStreamError(id)
      })
      const live = { friendId, session, transport }
      liveRef.current = live
      setActive(friendId)
      setState(session.getState())
      return live
    }

    const setLink = (friendId: string, patch: Partial<Link>): void => {
      const next = { ...(linksRef.current[friendId] ?? DOWN), ...patch }
      linksRef.current = { ...linksRef.current, [friendId]: next }
      setLinks(linksRef.current)
      if (liveRef.current?.friendId === friendId) liveRef.current.transport.setLink(next)
    }

    const onMessage = (friendId: string, raw: unknown): void => {
      const msg = parseMessage(raw)
      if (!msg) {
        console.warn('[listen] ignored a malformed message')
        return
      }
      const live = liveRef.current
      if (msg.type !== 'invite') {
        if (live?.friendId === friendId) live.transport.deliver(msg)
        return
      }
      const me = meRef.current
      if (!me) return
      const route = routeInvite({ activeFriend: live?.friendId ?? null, status: live?.session.getState().status ?? 'idle' }, friendId)
      if (route === 'session') live?.transport.deliver(msg)
      else if (route === 'new') start(friendId)?.transport.deliver(msg)
      else window.phinas.listenSend(friendId, { type: 'decline', reason: 'busy', from: me, ts: Date.now() })
    }

    const onClosed = (friendId: string, reason: PairClosedReason): void => {
      setLink(friendId, DOWN)
      const live = liveRef.current
      // A friend who went offline gets the session's grace period; a refusal ends it now.
      if (reason !== 'not-allowed' || live?.friendId !== friendId) return
      if (live.session.getState().status === 'invited') live.session.decline()
      else live.session.end()
    }

    /** Events fired before we subscribed (or reset) are lost, so ask for the state of every open channel. */
    const catchUp = (): void => {
      void window.phinas
        .listenStatus()
        .then((all) => {
          for (const [id, s] of Object.entries(all)) setLink(id, { up: s.connected, here: s.partnerHere })
        })
        .catch(() => undefined)
    }

    /** Another account (or none): forget every session and channel, then catch up on the new account's. */
    const reset = (): void => {
      stop()
      linksRef.current = {}
      setLinks({})
      setActive(null)
      setState(INITIAL_STATE)
      catchUp()
    }

    return { start, stop, setLink, onMessage, onClosed, reset, catchUp }
  }, [])

  useEffect(() => {
    const offs = [
      window.phinas.onListenMessage((e) => ops.onMessage(e.friendId, e.msg)),
      window.phinas.onListenPresence((e) => ops.setLink(e.friendId, { here: e.here })),
      window.phinas.onListenConnection((e) => ops.setLink(e.friendId, { up: e.up })),
      window.phinas.onListenClosed((e) => ops.onClosed(e.friendId, e.reason)),
      window.phinas.onAccountChanged(() => ops.reset())
    ]
    ops.catchUp()
    return () => {
      offs.forEach((off) => off())
      ops.stop()
    }
  }, [ops])

  const activeName = active ? social.nameOf(active) : 'Teman'

  // Tell the main process about a new invite so it can notify outside the app.
  const notified = useRef(false)
  useEffect(() => {
    if (state.status !== 'invited') {
      notified.current = false
      return
    }
    if (notified.current) return
    notified.current = true
    window.phinas.notifyListenInvite(activeName)
  }, [state.status, activeName])

  const invite = (friendId: string): void => {
    const live = liveRef.current
    if (live && isBusy(live.session.getState().status)) return
    setNotice(null)
    // The global switch or a scope may have changed since the last fetch: ask the server first.
    void window.phinas
      .listFriends()
      .then((friends) => friends.find((f) => f.userId === friendId)?.canListen ?? false)
      .catch(() => true) // offline: the channel itself refuses when it is not allowed
      .then((allowed) => {
        if (!allowed) {
          setNotice(friendlyError(new Error('phinas:listen_not_allowed')))
          return
        }
        const cur = liveRef.current
        if (cur && isBusy(cur.session.getState().status)) return
        ops.start(friendId)?.session.invite()
      })
  }

  const api = useMemo<ListenApi>(() => {
    const busy = isBusy(state.status)
    const allowed = (f: Friend): boolean => f.canListen && social.online.has(f.userId)
    return {
      state,
      activeFriend: active,
      activeName,
      pendingInvite: state.status === 'invited' && active ? { friendId: active, name: activeName } : null,
      partner: social.partner,
      invitable: social.friends.filter(allowed),
      busy,
      notice,
      canInvite: (id) => {
        const f = social.friends.find((x) => x.userId === id)
        const l = links[id]
        return !busy && f !== undefined && allowed(f) && l !== undefined && l.up && l.here
      },
      invite,
      accept: () => liveRef.current?.session.accept(),
      decline: () => liveRef.current?.session.decline(),
      end: () => liveRef.current?.session.end(),
      dismissNotice: () => setNotice(null)
    }
    // `invite` only reads refs and stable setters, so it may be from any render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, active, activeName, social.partner, social.friends, social.online, links, notice])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
