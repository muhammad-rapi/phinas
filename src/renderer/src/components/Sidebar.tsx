import { Compass, Download, Globe, Heart, History, Home, Lock, Plus, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { Track, Visibility } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { groupByOwner, onlineFriends } from '../social/lists'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
import { PlaylistCover } from './PlaylistCover'
import { SearchBox } from './SearchBox'
import { sidebarIcon } from './visibility'

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

/** At most this many names in the ONLINE group; the rest become "+k lainnya". */
const MAX_ONLINE = 5

/** A text navigation item; the active one is bold with its icon in the accent. `alert` adds the red dot. */
function NavItem(p: { label: string; icon: LucideIcon; active: boolean; alert?: string; onClick: () => void }): React.JSX.Element {
  const Icon = p.icon
  return (
    <button className={`nav-item${p.active ? ' active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <Icon className="nav-icon" size={17} strokeWidth={p.active ? 2.2 : 1.8} aria-hidden="true" />
      <span>{p.label}</span>
      {p.alert && <span className="nav-alert" role="img" aria-label={p.alert} />}
    </button>
  )
}

function PlaylistItem(p: { name: string; covers: string[]; active: boolean; visibility?: Visibility; onClick: () => void }): React.JSX.Element {
  const icon = p.visibility ? sidebarIcon(p.visibility) : null
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <PlaylistCover covers={p.covers} size={30} />
      <span>{p.name}</span>
      {icon === 'lock' && <Lock className="nav-vis" size={11} aria-label="Pribadi" />}
      {icon === 'globe' && <Globe className="nav-vis" size={11} aria-label="Publik" />}
    </button>
  )
}

/** ONLINE · n: friends who have Phinas open, partner first. A name opens a small menu. */
function OnlineGroup({ nav }: { nav: Nav }): React.JSX.Element | null {
  const social = useSocial()
  const listen = useListen()
  const [menu, setMenu] = useState<string | null>(null)
  if (!social.signedIn) return null
  const people = onlineFriends(social.friends, social.online)
  if (people.length === 0) return null
  const shown = people.slice(0, MAX_ONLINE)
  const more = people.length - shown.length

  return (
    <div className="nav-online">
      <div className="label nav-group">Online · {people.length}</div>
      {shown.map((f) => {
        const withYou = listen.activeFriend === f.userId && listen.state.status === 'active'
        const open = menu === f.userId
        return (
          <div key={f.userId} className="menu-wrap">
            <button className="nav-person" onClick={() => setMenu(open ? null : f.userId)} aria-haspopup="menu" aria-expanded={open}>
              <span className="online-dot" aria-hidden="true" />
              {f.isPartner && <Heart className="nav-heart" size={11} fill="currentColor" aria-label="Pasangan" />}
              <span className="nav-person-name">{f.name}</span>
              {withYou && <span className="nav-person-note">· bareng kamu</span>}
            </button>
            {open && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <div className="menu nav-person-menu" role="menu">
                  {f.canListen && !withYou && (
                    <button
                      role="menuitem"
                      className="menu-item"
                      disabled={!listen.canInvite(f.userId)}
                      onClick={() => {
                        setMenu(null)
                        listen.invite(f.userId)
                      }}
                    >
                      Ajak dengar bareng
                    </button>
                  )}
                  <button
                    role="menuitem"
                    className="menu-item"
                    onClick={() => {
                      setMenu(null)
                      nav({ name: 'friend', id: f.userId })
                    }}
                  >
                    Lihat profil
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
      {more > 0 && (
        <button className="nav-more" onClick={() => nav({ name: 'friends' })}>
          +{more} lainnya
        </button>
      )}
    </div>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, name, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const social = useSocial()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  const groups = groupByOwner(lib.friends)

  return (
    <aside className="sidebar" aria-label="Navigasi">
      {/* An empty strip: the window's drag handle, and room for the macOS window buttons. */}
      <div className="nav-brand" aria-hidden="true" />
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="nav">
        <NavItem label="Beranda" icon={Home} active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem label="Jelajah" icon={Compass} active={view.name === 'explore'} onClick={() => nav({ name: 'explore' })} />
        <NavItem
          label="Teman"
          icon={Users}
          active={view.name === 'friends' || view.name === 'friend'}
          alert={social.incoming > 0 ? `${social.incoming} permintaan baru` : undefined}
          onClick={() => nav({ name: 'friends' })}
        />
        <NavItem label="Disukai" icon={Heart} active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem label="Riwayat" icon={History} active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <OnlineGroup nav={nav} />

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
            covers={p.coverUrls}
            active={sameView(view, { name: 'playlist', id: p.id })}
            visibility={p.visibility}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="nav-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {groups.length > 0 && <div className="label nav-group">Dari teman</div>}
        {groups.map((g) => (
          <Fragment key={g.ownerId}>
            <div className="nav-owner">{g.ownerName}</div>
            {g.playlists.map((p) => (
              <PlaylistItem
                key={p.id}
                name={p.name}
                covers={p.coverUrls}
                active={sameView(view, { name: 'friendPlaylist', id: p.id })}
                onClick={() => nav({ name: 'friendPlaylist', id: p.id })}
              />
            ))}
          </Fragment>
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
