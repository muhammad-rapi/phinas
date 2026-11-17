import { Download, Heart, History, Home, Plus, Users, type LucideIcon } from 'lucide-react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
import { PlaylistCover } from './PlaylistCover'
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
  /** First letter of the profile name, shown on the profile button. */
  initial: string
}

function NavItem(p: { icon: LucideIcon; label: string; active: boolean; online?: boolean; onClick: () => void }): React.JSX.Element {
  const Icon = p.icon
  return (
    <button className={`sb-item${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <Icon size={20} />
      <span>{p.label}</span>
      {p.online && <span className="sb-dot" role="img" aria-label="Pasangan online" />}
    </button>
  )
}

function PlaylistRow(p: { covers: string[]; title: string; sub: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`lib-row${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <PlaylistCover covers={p.covers} size={40} />
      <span className="lib-row-text">
        <span className="lib-row-title">{p.title}</span>
        <span className="muted lib-row-sub">{p.sub}</span>
      </span>
    </button>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const listen = useListen()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <aside className="sidebar" aria-label="Navigasi">
      {/* Empty: the window's drag handle, with room for the macOS window buttons. */}
      <div className="sb-brand" />
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="sb-nav">
        <NavItem icon={Home} label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem
          icon={Users}
          label="Berdua"
          active={view.name === 'together'}
          online={listen.available && listen.state.partnerHere}
          onClick={() => nav({ name: 'together' })}
        />
        <NavItem icon={Heart} label="Disukai" active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem icon={History} label="Riwayat" active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <div className="sb-sep" />
      <div className="sb-section">
        <span>Playlist</span>
        <div className="library-actions">
          <button className="icon-btn" onClick={() => nav({ name: 'import' })} aria-label="Impor dari Spotify" title="Impor dari Spotify">
            <Download size={18} />
          </button>
          <button className="icon-btn" onClick={create} aria-label="Buat playlist" title="Buat playlist">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="sb-list">
        {lib.playlists.map((p) => (
          <PlaylistRow
            key={p.id}
            covers={p.coverUrls}
            title={p.name}
            sub="Playlist"
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="muted library-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {lib.partner.length > 0 && <div className="sb-group">Dari {lib.partner[0].ownerName}</div>}
        {lib.partner.map((p) => (
          <PlaylistRow
            key={p.id}
            covers={p.coverUrls}
            title={p.name}
            sub={`Playlist · ${p.ownerName}`}
            active={sameView(view, { name: 'partner', id: p.id })}
            onClick={() => nav({ name: 'partner', id: p.id })}
          />
        ))}
      </div>

      <div className="sb-foot">
        <button
          className={`profile-btn${view.name === 'profile' ? ' active' : ''}`}
          onClick={() => nav({ name: 'profile' })}
          aria-label="Profil"
        >
          {initial}
        </button>
      </div>
    </aside>
  )
}
