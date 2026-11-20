import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PartnerPlaylist, Playlist, Track } from '../../../shared/types'

interface LibraryApi {
  playlists: Playlist[]
  likes: Track[]
  /** Playlists friends share with me (DARI TEMAN), newest first. Empty when signed out. */
  friends: PartnerPlaylist[]
  refresh(): Promise<void>
  refreshFriends(): Promise<void>
}

const Ctx = createContext<LibraryApi | null>(null)

export function useLibrary(): LibraryApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLibrary must be used inside LibraryProvider')
  return v
}

const FRIENDS_REFRESH_MS = 60_000

/** One shared copy of the library so every screen and the sidebar stay in step. */
export function LibraryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likes, setLikes] = useState<Track[]>([])
  const [friends, setFriends] = useState<PartnerPlaylist[]>([])

  const refresh = useCallback(async () => {
    const [p, l] = await Promise.all([window.phinas.listPlaylists(), window.phinas.listLikes()])
    setPlaylists(p)
    setLikes(l)
  }, [])

  const refreshFriends = useCallback(async () => {
    try {
      const status = await window.phinas.syncStatus()
      setFriends(status.signedIn ? await window.phinas.listFriendPlaylists() : [])
    } catch {
      // offline: keep the last list
    }
  }, [])

  useEffect(() => {
    void refresh()
    void refreshFriends()
    const t = setInterval(() => void refreshFriends(), FRIENDS_REFRESH_MS)
    // Another account means another library file and other friends.
    const off = window.phinas.onAccountChanged(() => {
      void refresh()
      void refreshFriends()
    })
    return () => {
      clearInterval(t)
      off()
    }
  }, [refresh, refreshFriends])

  const api = useMemo(() => ({ playlists, likes, friends, refresh, refreshFriends }), [playlists, likes, friends, refresh, refreshFriends])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
