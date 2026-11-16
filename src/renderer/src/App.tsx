import { useState } from 'react'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { Sidebar, type Route } from './components/Sidebar'
import { PlayerProvider, usePlayer } from './player/PlayerProvider'
import { Home } from './screens/Home'
import { Library } from './screens/Library'
import { Search } from './screens/Search'
import { Settings } from './screens/Settings'
import { useTheme } from './theme/useTheme'

function Shell(): React.JSX.Element {
  const player = usePlayer()
  const { theme, setTheme } = useTheme(player.track)
  const [route, setRoute] = useState<Route>('home')
  const [playlistId, setPlaylistId] = useState<string | undefined>()
  // Remount Library when jumping to a specific playlist.
  const [libraryKey, setLibraryKey] = useState(0)

  const openPlaylist = (id: string): void => {
    setPlaylistId(id)
    setLibraryKey((k) => k + 1)
    setRoute('library')
  }

  return (
    <div className="app">
      <Sidebar route={route} onNavigate={setRoute} />
      <main className="panel main">
        {player.notice && (
          <div className="notice" onClick={player.dismissNotice} role="status">
            {player.notice}
          </div>
        )}
        {route === 'home' && <Home onOpenPlaylist={openPlaylist} onOpenPartner={() => setRoute('library')} />}
        {route === 'search' && <Search />}
        {route === 'library' && <Library key={libraryKey} initialPlaylistId={playlistId} />}
        {route === 'settings' && <Settings theme={theme} onTheme={setTheme} />}
      </main>
      <aside className="panel">
        <NowPlaying />
      </aside>
      <PlayerBar />
    </div>
  )
}

export function App(): React.JSX.Element {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  )
}
