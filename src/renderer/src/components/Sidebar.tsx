import { Download, Plus } from 'lucide-react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
import { SearchBox } from './SearchBox'

interface Props {
  view: View
  nav: Nav
  query: string
  onQuery: (q: string) => void
  onSubmit: () => void
  recent: RecentEntry[]
  onForget: (entry: RecentEntry) => void
  onPlayTrack: (track: Track) => void
  /** The profile name, shown next to the avatar. */
  name: string
  /** First letter of the profile name, shown in the avatar. */
  initial: string
}

/** A text navigation item; the active one is bold with an accent dot before it. */
function NavItem(p: { label: string; active: boolean; online?: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-item${p.active ? ' active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <span>{p.label}</span>
      {p.online && <span className="online-dot" role="img" aria-label="Pasangan online" />}
    </button>
  )
}

function PlaylistItem(p: { name: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <span>{p.name}</span>
    </button>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, name, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const listen = useListen()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <aside className="sidebar" aria-label="Navigasi">
      {/* The wordmark is also the window's drag handle, below the macOS window buttons. */}
      <div className="nav-brand">phinas</div>
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="nav">
        <NavItem label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem label="Jelajah" active={view.name === 'explore'} onClick={() => nav({ name: 'explore' })} />
        <NavItem
          label="Berdua"
          active={view.name === 'together'}
          online={listen.available && listen.state.partnerHere}
          onClick={() => nav({ name: 'together' })}
        />
        <NavItem label="Disukai" active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem label="Riwayat" active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <div className="nav-section">
        <span className="label">Playlist</span>
        <div className="nav-actions">
          <button className="icon-btn" onClick={() => nav({ name: 'import' })} aria-label="Impor dari Spotify" title="Impor dari Spotify">
            <Download size={14} />
          </button>
          <button className="icon-btn" onClick={create} aria-label="Buat playlist" title="Buat playlist">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="nav-list">
        {lib.playlists.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="nav-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {lib.partner.length > 0 && <div className="label nav-group">Dari pasangan</div>}
        {lib.partner.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            active={sameView(view, { name: 'partner', id: p.id })}
            onClick={() => nav({ name: 'partner', id: p.id })}
          />
        ))}
      </div>

      <div className="nav-foot">
        <button className={`nav-me${view.name === 'profile' ? ' active' : ''}`} onClick={() => nav({ name: 'profile' })} aria-label="Profil">
          <span className="nav-avatar">{initial}</span>
          <span className="nav-foot-name">{name}</span>
        </button>
      </div>
    </aside>
  )
}
