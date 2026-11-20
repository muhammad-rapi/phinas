import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Friend, FriendRequest, MyProfile } from '../../../shared/types'

export interface SocialApi {
  /** Supabase is configured (.env). */
  configured: boolean
  signedIn: boolean
  /** The signed-in email, from the stored session. */
  email: string | null
  /** False until the first refresh has finished. */
  loaded: boolean
  me: MyProfile | null
  /** Accepted friends, partner first. */
  friends: Friend[]
  /** Pending friend requests, both directions. */
  requests: FriendRequest[]
  /** Ids of friends who have Phinas open right now. */
  online: ReadonlySet<string>
  /** The server could not be reached: lists come from the cache and actions are disabled. */
  offline: boolean
  partner: Friend | null
  /** Incoming friend and partner requests (the dot on Teman). */
  incoming: number
  refresh(): Promise<void>
  /** A friend's name, or "Teman" when they are not in the list. */
  nameOf(userId: string): string
}

const Ctx = createContext<SocialApi | null>(null)

export function useSocial(): SocialApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSocial must be used inside SocialProvider')
  return v
}

const REFRESH_MS = 60_000
const NOBODY: ReadonlySet<string> = new Set()

/** Own profile, friends, requests and who is online, shared by every social screen. */
export function SocialProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [configured, setConfigured] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [me, setMe] = useState<MyProfile | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [online, setOnline] = useState<ReadonlySet<string>>(NOBODY)
  const [offline, setOffline] = useState(false)
  // A slow answer from before a sign-out must not bring the old account back.
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    const s = await window.phinas.syncStatus().catch(() => null)
    if (mine !== seq.current) return
    setConfigured(s?.configured ?? false)
    if (!s?.signedIn) {
      setSignedIn(false)
      setEmail(null)
      setMe(null)
      setFriends([])
      setRequests([])
      setOnline(NOBODY)
      setOffline(false)
      setLoaded(true)
      return
    }
    const [p, f, r, o] = await Promise.allSettled([
      window.phinas.myProfile(),
      window.phinas.listFriends(),
      window.phinas.listFriendRequests(),
      window.phinas.onlineFriends()
    ])
    if (mine !== seq.current) return
    setSignedIn(true)
    setEmail(s.email ?? null)
    if (p.status === 'fulfilled') setMe(p.value)
    if (f.status === 'fulfilled') setFriends(f.value)
    if (r.status === 'fulfilled') setRequests(r.value)
    if (o.status === 'fulfilled') setOnline(new Set(o.value))
    // Requests are never cached, so their failure is how an offline start shows.
    setOffline(r.status === 'rejected')
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), REFRESH_MS)
    const offs = [
      window.phinas.onAccountChanged(() => void refresh()),
      window.phinas.onFriendsOnline((ids) => setOnline(new Set(ids)))
    ]
    return () => {
      clearInterval(t)
      offs.forEach((off) => off())
    }
  }, [refresh])

  const api = useMemo<SocialApi>(() => {
    const partner = friends.find((f) => f.isPartner) ?? null
    const incoming = requests.filter((r) => r.incoming).length + friends.filter((f) => f.partnerRequest === 'incoming').length
    return {
      configured,
      signedIn,
      email,
      loaded,
      me,
      friends,
      requests,
      online,
      offline,
      partner,
      incoming,
      refresh,
      nameOf: (userId) => friends.find((f) => f.userId === userId)?.name ?? 'Teman'
    }
  }, [configured, signedIn, email, loaded, me, friends, requests, online, offline, refresh])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
