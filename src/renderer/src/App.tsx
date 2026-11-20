import { ChevronLeft, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ListenBanner } from './components/ListenTogether'
import { UpdateBanner } from './components/UpdateBanner'
import { LyricsFull } from './components/LyricsFull'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { SearchBox } from './components/SearchBox'
import { Sidebar } from './components/Sidebar'
import { LibraryProvider, useLibrary } from './library/LibraryProvider'
import { keyToCommand } from './player/keymap'
import { RecentView } from './screens/RecentView'
import { PlayerProvider, usePlayer } from './player/PlayerProvider'
import { Home } from './screens/Home'
import { Explore } from './screens/Explore'
import { LikedView } from './screens/LikedView'
import { FriendPlaylistView } from './screens/FriendPlaylistView'
import { FriendView } from './screens/FriendView'
import { PlaylistView } from './screens/PlaylistView'
import { PublicPlaylistView } from './screens/PublicPlaylistView'
import { Search } from './screens/Search'
import { FriendsView } from './screens/FriendsView'
import { ImportView } from './screens/ImportView'
import { ArtistView } from './screens/ArtistView'
import { GenreView } from './screens/GenreView'
import { NavProvider } from './nav/NavProvider'
import { Profile } from './screens/Profile'
import { Welcome } from './screens/Welcome'
import { useProfile } from './profile/useProfile'
import { useRecent } from './search/useRecent'
import { ListenTogetherProvider, useListen } from './sync/ListenTogetherProvider'
import { SocialProvider, useSocial } from './social/SocialProvider'
import { useCover } from './theme/useCover'
import { useTheme } from './theme/useTheme'
import { sameView, type Nav, type View } from './views'
import { moodColors, type MoodColors } from './theme/moodColors'

function Shell(): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const cover = useCover(player.track)
  // A mood picked on Home tints the app while you listen from it.
  const [mood, setMood] = useState<{ title: string; colors: MoodColors } | null>(null)
  const theme = useTheme(cover, mood?.colors.accent ?? null)
  const recents = useRecent()
  const profile = useProfile()
  const social = useSocial()
  // Signed in, the name lives on the server (friends see it); signed out it stays on this computer.
  const shownName = social.me?.displayName || profile.name
  const shownInitial = (shownName.trim()[0] ?? 'K').toUpperCase()
  const listen = useListen()
  const [panelOpen, setPanelOpen] = useState(false)
  // A session brings the side panel up; the user can still close it afterwards.
  useEffect(() => {
    if (listen.state.status === 'active') setPanelOpen(true)
  }, [listen.state.status])
  const [view, setView] = useState<View>({ name: 'home' })
  // Screens visited before this one, newest last, for the back button.
  const [history, setHistory] = useState<View[]>([])
  const [query, setQuery] = useState('')
  const [submitNonce, setSubmitNonce] = useState(0)
  const [lyricsFull, setLyricsFull] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  // First launch: the welcome screen until the user signs in or goes on without an account.
  const [welcome, setWelcome] = useState(false)
  const welcomeRef = useRef(false)
  welcomeRef.current = welcome
  useEffect(() => {
    window.phinas
      .syncStatus()
      .then((s) => setWelcome(s.configured && !s.welcomeDone))
      .catch(() => undefined)
  }, [])

  // Screens that belong to the active mood: its page, and playlists/albums opened from there.
  const [moodViews, setMoodViews] = useState<View[]>([])
  const inMood = (v: View): boolean => moodViews.some((m) => sameView(m, v))

  const nav: Nav = (v) => {
    if (sameView(v, view)) return
    const colors = v.name === 'genre' ? moodColors(v.title) : null
    if (colors && v.name === 'genre') {
      setMood({ title: v.title, colors })
      setMoodViews([v])
    } else if (mood && inMood(view) && (v.name === 'public' || v.name === 'album')) {
      setMoodViews((m) => [...m, v])
    }
    setHistory((h) => [...h, view].slice(-50))
    setView(v)
    if (v.name !== 'search') setQuery('')
  }

  const back = (): void => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setView(prev)
    if (prev.name !== 'search') setQuery('')
  }
  const backRef = useRef(back)
  backRef.current = back

  const onQuery = (q: string): void => {
    setQuery(q)
    // Emptying the box leaves the results page instead of showing a blank one.
    // Typing opens results; back from there returns to the screen you searched from.
    if (q.trim() && view.name !== 'search') setHistory((h) => [...h, view].slice(-50))
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
      // The welcome overlay covers the window: no shortcuts behind it.
      if (welcomeRef.current) return
      const typing = (e.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]') !== null
      if (e.key === 'Escape') {
        setLyricsFull(false)
        return
      }
      // A control already handled this key (a row's own Enter/Space, a menu): don't run a shortcut too.
      if (e.defaultPrevented) return
      // Space/Enter on a focused button or link presses it; don't also toggle playback.
      const activating = e.key === ' ' || e.key === 'Enter'
      if (activating && (e.target as HTMLElement | null)?.closest('button, a, [role="button"]')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        playerRef.current.run('focusSearch')
        return
      }
      // Back: Cmd+[ (mac) or Alt+Left.
      if ((e.metaKey && e.key === '[') || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault()
        backRef.current()
        return
      }
      if (typing) return
      const cmd = keyToCommand(e)
      if (!cmd) return
      e.preventDefault()
      playerRef.current.run(cmd)
    }
    window.addEventListener('keydown', onKey)
    // The mouse's back button.
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) {
        e.preventDefault()
        backRef.current()
      }
    }
    window.addEventListener('mouseup', onMouse)
    // Global shortcuts and the notch's buttons arrive from the main process.
    const offCmd = window.phinas.onPlayerCommand((cmd) => playerRef.current.run(cmd))
    const offSeek = window.phinas.onPlayerSeek((sec) => playerRef.current.seek(sec))
    const offLib = window.phinas.onLibraryChanged(() => void libRef.current.refresh())
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
      offCmd()
      offSeek()
      offLib()
    }
  }, [])

  // Keep the notch overlay in step with the player and the app's mode.
  const liked = player.track ? lib.likes.some((l) => l.videoId === player.track!.videoId) : false
  useEffect(() => {
    window.phinas.pushNotchState({
      track: player.track,
      playing: player.playing,
      time: player.time,
      duration: player.duration,
      liked,
      theme: theme.resolved,
      accent: theme.notch.accent,
      onAccent: theme.notch.onAccent
    })
  }, [player.track, player.playing, player.time, player.duration, liked, theme.resolved, theme.notch.accent, theme.notch.onAccent])

  // Playing something started outside the mood's screens ends the mood.
  const queueHead = player.queue.tracks[0]?.videoId
  const lastHead = useRef(queueHead)
  useEffect(() => {
    if (queueHead === lastHead.current) return
    lastHead.current = queueHead
    if (mood && !inMood(view)) {
      setMood(null)
      setMoodViews([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueHead])

  // Every new screen starts at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [view])

  const body = ((): React.JSX.Element => {
    switch (view.name) {
      case 'home':
        return <Home nav={nav} name={shownName} />
      case 'explore':
        return <Explore nav={nav} />
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
      case 'album':
        return <PublicPlaylistView key={view.id} id={view.id} album nav={nav} />
      case 'artist':
        return <ArtistView key={view.id} name={view.id} nav={nav} />
      case 'genre':
        return <GenreView key={view.id} params={view.id} title={view.title} nav={nav} />
      case 'friendPlaylist':
        return <FriendPlaylistView key={view.id} id={view.id} nav={nav} />
      case 'friend':
        return <FriendView key={view.id} id={view.id} nav={nav} />
      case 'friends':
        return <FriendsView nav={nav} />
      case 'import':
        return <ImportView nav={nav} />
      case 'profile':
        return <Profile nav={nav} name={profile.name} onName={profile.setName} theme={theme.mode} onTheme={theme.setMode} />
    }
  })()

  return (
    <NavProvider nav={nav}>
    <div className={`app${panelOpen ? ' with-panel' : ''}`}>
      {/* The cover, blurred, behind everything; the paper on top is translucent so its colours show. */}
      {cover && <div key={cover} className="ambient" style={{ backgroundImage: `url("${cover}")` }} />}
      <div className="drag-strip" />
      <Sidebar view={view} nav={nav} name={shownName} initial={shownInitial} />
      <main ref={mainRef} className="main">
        {/* Back on the left, search in the middle, the mood on the right; stays on top while scrolling. */}
        <div className="topbar">
          <div className="topbar-side">
            {history.length > 0 && (
              <button className="icon-btn back-btn" onClick={back} aria-label="Kembali" title="Kembali">
                <ChevronLeft size={20} />
              </button>
            )}
          </div>
          <SearchBox
            query={query}
            onQuery={onQuery}
            onSubmit={() => {
              if (!query.trim()) return
              recents.rememberQuery(query)
              if (view.name !== 'search') setHistory((h) => [...h, view].slice(-50))
              setView({ name: 'search' })
              setSubmitNonce((n) => n + 1)
            }}
            recent={recents.recent}
            onForget={recents.forget}
            onPlayTrack={(t) => {
              recents.rememberTrack(t, '')
              player.play([t], 0)
            }}
          />
          <div className="topbar-side end">
            {mood && (
              <div className="mood-badge" role="status">
                <span>Mood: {mood.title}</span>
                <button
                  className="icon-btn"
                  onClick={() => {
                    setMood(null)
                    setMoodViews([])
                  }}
                  aria-label="Kembali ke tema biasa"
                  title="Kembali ke tema biasa"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <ListenBanner />
        <UpdateBanner />
        {player.notice && (
          <div className="notice" onClick={player.dismissNotice} role="status">
            {player.notice}
          </div>
        )}
        {body}
      </main>
      {panelOpen && (
        <aside className="right">
          <NowPlaying onExpandLyrics={() => setLyricsFull(true)} />
        </aside>
      )}
      <PlayerBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
      {lyricsFull && <LyricsFull onClose={() => setLyricsFull(false)} />}
      {welcome && <Welcome onDone={() => setWelcome(false)} />}
    </div>
    </NavProvider>
  )
}

export function App(): React.JSX.Element {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <SocialProvider>
          <ListenTogetherProvider>
            <Shell />
          </ListenTogetherProvider>
        </SocialProvider>
      </PlayerProvider>
    </LibraryProvider>
  )
}
