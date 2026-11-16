import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PartnerPlaylist, Playlist, Track } from '../../../shared/types'

interface LibraryApi {
  playlists: Playlist[]
  likes: Track[]
  partner: PartnerPlaylist[]
  /** True when partner playlists could not be loaded (not signed in, offline, ...). */
  partnerUnavailable: boolean
  refresh(): Promise<void>
  refreshPartner(): Promise<void>
}

const Ctx = createContext<LibraryApi | null>(null)

export function useLibrary(): LibraryApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLibrary must be used inside LibraryProvider')
  return v
}

const PARTNER_REFRESH_MS = 60_000

/** One shared copy of the library so every screen and the sidebar stay in step. */
export function LibraryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likes, setLikes] = useState<Track[]>([])
  const [partner, setPartner] = useState<PartnerPlaylist[]>([])
  const [partnerUnavailable, setPartnerUnavailable] = useState(false)

  const refresh = useCallback(async () => {
    const [p, l] = await Promise.all([window.phinas.listPlaylists(), window.phinas.listLikes()])
    setPlaylists(p)
    setLikes(l)
  }, [])

  const refreshPartner = useCallback(async () => {
    try {
      setPartner(await window.phinas.listPartnerPlaylists())
      setPartnerUnavailable(false)
    } catch {
      setPartner([])
      setPartnerUnavailable(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void refreshPartner()
    const t = setInterval(refreshPartner, PARTNER_REFRESH_MS)
    return () => clearInterval(t)
  }, [refresh, refreshPartner])

  const api = useMemo(
    () => ({ playlists, likes, partner, partnerUnavailable, refresh, refreshPartner }),
    [playlists, likes, partner, partnerUnavailable, refresh, refreshPartner]
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
