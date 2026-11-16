import { useEffect, useRef, useState } from 'react'
import { LibraryPanel } from './components/LibraryPanel'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { TopBar } from './components/TopBar'
import { LibraryProvider } from './library/LibraryProvider'
import { PlayerProvider, usePlayer } from './player/PlayerProvider'
import { Home } from './screens/Home'
import { LikedView } from './screens/LikedView'
import { PartnerView } from './screens/PartnerView'
import { PlaylistView } from './screens/PlaylistView'
import { Search } from './screens/Search'
import { Profile } from './screens/Profile'
import { useProfile } from './profile/useProfile'
import { useRecent } from './search/useRecent'
import { useCover } from './theme/useCover'
import { useTheme } from './theme/useTheme'
import type { Nav, View } from './views'

function Shell(): React.JSX.Element {
  const player = usePlayer()
  const cover = useCover(player.track)
  const { theme, setTheme } = useTheme(cover)
  const recents = useRecent()
  const profile = useProfile()
  const [view, setView] = useState<View>({ name: 'home' })
  const [query, setQuery] = useState('')
  const [submitNonce, setSubmitNonce] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const nav: Nav = (v) => {
    setView(v)
    if (v.name !== 'search') setQuery('')
  }

  const onQuery = (q: string): void => {
    setQuery(q)
    // Emptying the box leaves the results page instead of showing a blank one.
    setView(q.trim() ? { name: 'search' } : (v) => (v.name === 'search' ? { name: 'home' } : v))
  }

  // Keep the fullscreen button in step with the window, whoever changed it (button, F11, the OS).
  useEffect(() => {
    const sync = (): void => void window.phinas.windowControl('state').then(setFullscreen)
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  // Keyboard shortcuts. Cmd on a Mac, Ctrl on Windows. The ref keeps the listener registered once
  // even though `player` changes on every time update.
  const playerRef = useRef(player)
  playerRef.current = player
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]') !== null
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.searchpill input')?.focus()
      } else if (typing) {
        return
      } else if (e.code === 'Space' && !mod) {
        e.preventDefault()
        playerRef.current.toggle()
      } else if (mod && e.key === 'ArrowRight') {
        e.preventDefault()
        playerRef.current.next()
      } else if (mod && e.key === 'ArrowLeft') {
        e.preventDefault()
        playerRef.current.prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Every new screen starts at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [view])

  const body = ((): React.JSX.Element => {
    switch (view.name) {
      case 'home':
        return <Home nav={nav} />
      case 'search':
        return <Search query={query} submitNonce={submitNonce} onPick={recents.rememberTrack} />
      case 'liked':
        return <LikedView />
      case 'playlist':
        return <PlaylistView key={view.id} id={view.id} nav={nav} />
      case 'partner':
        return <PartnerView id={view.id} nav={nav} />
      case 'profile':
        return <Profile name={profile.name} onName={profile.setName} initial={profile.initial} theme={theme} onTheme={setTheme} />
    }
  })()

  return (
    <div className="app">
      {cover && theme !== 'light' && <div key={cover} className="ambient" style={{ backgroundImage: `url("${cover}")` }} />}
      <TopBar
        query={query}
        onQuery={onQuery}
        onSubmit={() => {
          if (!query.trim()) return
          recents.rememberQuery(query)
          setView({ name: 'search' })
          setSubmitNonce((n) => n + 1)
        }}
        recent={recents.recent}
        onForget={recents.forget}
        onPlayTrack={(t) => {
          recents.rememberTrack(t, '')
          player.play([t], 0)
        }}
        onHome={() => nav({ name: 'home' })}
        onProfile={() => nav({ name: 'profile' })}
        homeActive={view.name === 'home'}
        profileActive={view.name === 'profile'}
        initial={profile.initial}
        fullscreen={fullscreen}
        onMinimize={() => void window.phinas.windowControl('minimize')}
        onFullscreen={() => void window.phinas.windowControl('toggleFullscreen').then(setFullscreen)}
      />
      <LibraryPanel view={view} nav={nav} />
      <main ref={mainRef} className="panel main">
        {player.notice && (
          <div className="notice" onClick={player.dismissNotice} role="status">
            {player.notice}
          </div>
        )}
        {body}
      </main>
      <aside className="panel right">
        <NowPlaying />
      </aside>
      <PlayerBar />
    </div>
  )
}

export function App(): React.JSX.Element {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </LibraryProvider>
  )
}
