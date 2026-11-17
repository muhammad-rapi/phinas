import { useEffect, useRef, useState } from 'react'
import { LibraryPanel } from './components/LibraryPanel'
import { ListenBanner } from './components/ListenTogether'
import { LyricsFull } from './components/LyricsFull'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { TopBar } from './components/TopBar'
import { LibraryProvider, useLibrary } from './library/LibraryProvider'
import { keyToCommand } from './player/keymap'
import { RecentView } from './screens/RecentView'
import { PlayerProvider, usePlayer } from './player/PlayerProvider'
import { Home } from './screens/Home'
import { LikedView } from './screens/LikedView'
import { PartnerView } from './screens/PartnerView'
import { PlaylistView } from './screens/PlaylistView'
import { PublicPlaylistView } from './screens/PublicPlaylistView'
import { Search } from './screens/Search'
import { ImportView } from './screens/ImportView'
import { Profile } from './screens/Profile'
import { useProfile } from './profile/useProfile'
import { useRecent } from './search/useRecent'
import { ListenTogetherProvider } from './sync/ListenTogetherProvider'
import { useCover } from './theme/useCover'
import { useTheme } from './theme/useTheme'
import type { Nav, View } from './views'

function Shell(): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const cover = useCover(player.track)
  const { theme, setTheme } = useTheme(cover)
  const recents = useRecent()
  const profile = useProfile()
  const [view, setView] = useState<View>({ name: 'home' })
  const [query, setQuery] = useState('')
  const [submitNonce, setSubmitNonce] = useState(0)
  const [lyricsFull, setLyricsFull] = useState(false)
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

  // Keyboard shortcuts (window focused). The ref keeps the listener registered once even though
  // `player` changes on every time update. Commands run in PlayerProvider, same as the notch's.
  const playerRef = useRef(player)
  playerRef.current = player
  const libRef = useRef(lib)
  libRef.current = lib
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]') !== null
      if (e.key === 'Escape') {
        setLyricsFull(false)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        playerRef.current.run('focusSearch')
        return
      }
      if (typing) return
      const cmd = keyToCommand(e)
      if (!cmd) return
      e.preventDefault()
      playerRef.current.run(cmd)
    }
    window.addEventListener('keydown', onKey)
    // Global shortcuts and the notch's buttons arrive from the main process.
    const offCmd = window.phinas.onPlayerCommand((cmd) => playerRef.current.run(cmd))
    const offSeek = window.phinas.onPlayerSeek((sec) => playerRef.current.seek(sec))
    const offLib = window.phinas.onLibraryChanged(() => void libRef.current.refresh())
    return () => {
      window.removeEventListener('keydown', onKey)
      offCmd()
      offSeek()
      offLib()
    }
  }, [])

  // Keep the notch overlay in step with the player and the app's theme.
  const [colors, setColors] = useState({ accent: '#8b5cf6', accentText: '#b79cff', gradTop: '#2b2150' })
  useEffect(() => {
    // The theme hook sets the accent variables a moment after the cover or theme changes.
    const t = setTimeout(() => {
      const cs = getComputedStyle(document.documentElement)
      const get = (v: string, fallback: string): string => cs.getPropertyValue(v).trim() || fallback
      setColors({
        accent: get('--accent', '#8b5cf6'),
        accentText: get('--accent-text', '#b79cff'),
        gradTop: get('--grad-top', '#2b2150')
      })
    }, 400)
    return () => clearTimeout(t)
  }, [cover, theme])
  const liked = player.track ? lib.likes.some((l) => l.videoId === player.track!.videoId) : false
  useEffect(() => {
    window.phinas.pushNotchState({
      track: player.track,
      playing: player.playing,
      time: player.time,
      duration: player.duration,
      liked,
      theme,
      ...colors
    })
  }, [player.track, player.playing, player.time, player.duration, liked, theme, colors])

  // Every new screen starts at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [view])

  const body = ((): React.JSX.Element => {
    switch (view.name) {
      case 'home':
        return <Home nav={nav} />
      case 'search':
        return <Search query={query} submitNonce={submitNonce} onPick={recents.rememberTrack} nav={nav} />
      case 'liked':
        return <LikedView />
      case 'recent':
        return <RecentView />
      case 'playlist':
        return <PlaylistView key={view.id} id={view.id} nav={nav} />
      case 'public':
        return <PublicPlaylistView key={view.id} id={view.id} author={view.author} nav={nav} />
      case 'partner':
        return <PartnerView id={view.id} nav={nav} />
      case 'import':
        return <ImportView nav={nav} />
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
      />
      <LibraryPanel view={view} nav={nav} />
      <main ref={mainRef} className="panel main">
        <ListenBanner />
        {player.notice && (
          <div className="notice" onClick={player.dismissNotice} role="status">
            {player.notice}
          </div>
        )}
        {body}
      </main>
      <aside className="panel right">
        <NowPlaying onExpandLyrics={() => setLyricsFull(true)} />
      </aside>
      <PlayerBar />
      {lyricsFull && <LyricsFull cover={cover} onClose={() => setLyricsFull(false)} />}
    </div>
  )
}

export function App(): React.JSX.Element {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <ListenTogetherProvider>
          <Shell />
        </ListenTogetherProvider>
      </PlayerProvider>
    </LibraryProvider>
  )
}
