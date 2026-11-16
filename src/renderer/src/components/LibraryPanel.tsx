import { Heart, Library, Plus } from 'lucide-react'
import { useState } from 'react'
import { useLibrary } from '../library/LibraryProvider'
import { sameView, type Nav, type View } from '../views'
import { PlaylistCover } from './PlaylistCover'

type Filter = 'all' | 'mine' | 'partner'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'mine', label: 'Milikku' },
  { id: 'partner', label: 'Pasangan' }
]

interface RowProps {
  thumb: React.ReactNode
  title: string
  sub: string
  active: boolean
  onClick: () => void
}

function LibraryRow({ thumb, title, sub, active, onClick }: RowProps): React.JSX.Element {
  return (
    <button className={`lib-row${active ? ' active' : ''}`} onClick={onClick}>
      {thumb}
      <span className="lib-row-text">
        <span className="lib-row-title">{title}</span>
        <span className="muted lib-row-sub">{sub}</span>
      </span>
    </button>
  )
}

export function LibraryPanel({ view, nav }: { view: View; nav: Nav }): React.JSX.Element {
  const lib = useLibrary()
  const [filter, setFilter] = useState<Filter>('all')

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  const showMine = filter !== 'partner'
  const showPartner = filter !== 'mine'

  return (
    <nav className="panel library" aria-label="Library">
      <div className="library-head">
        <div className="library-title">
          <Library size={22} />
          <span>Library</span>
        </div>
        <button className="pill-btn" onClick={create} aria-label="Buat playlist">
          <Plus size={18} />
          <span>Buat</span>
        </button>
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f.id} className={`chip${filter === f.id ? ' active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="library-list">
        {showMine && (
          <LibraryRow
            thumb={
              <div className="pcover pcover-liked" style={{ width: 48, height: 48 }}>
                <Heart size={20} fill="currentColor" />
              </div>
            }
            title="Lagu yang disukai"
            sub={`Playlist · ${lib.likes.length} lagu`}
            active={sameView(view, { name: 'liked' })}
            onClick={() => nav({ name: 'liked' })}
          />
        )}
        {showMine &&
          lib.playlists.map((p) => (
            <LibraryRow
              key={p.id}
              thumb={<PlaylistCover covers={p.coverUrls} size={48} />}
              title={p.name}
              sub="Playlist"
              active={sameView(view, { name: 'playlist', id: p.id })}
              onClick={() => nav({ name: 'playlist', id: p.id })}
            />
          ))}
        {showPartner &&
          lib.partner.map((p) => (
            <LibraryRow
              key={p.id}
              thumb={<PlaylistCover covers={p.coverUrls} size={48} />}
              title={p.name}
              sub={`Playlist · ${p.ownerName}`}
              active={sameView(view, { name: 'partner', id: p.id })}
              onClick={() => nav({ name: 'partner', id: p.id })}
            />
          ))}
        {showPartner && !showMine && lib.partner.length === 0 && (
          <p className="muted library-empty">
            {lib.partnerUnavailable ? 'Masuk di Pengaturan untuk melihat playlist pasangan.' : 'Pasangan belum membagikan playlist.'}
          </p>
        )}
        {showMine && lib.playlists.length === 0 && (
          <p className="muted library-empty">Buat playlist pertamamu dengan tombol Buat.</p>
        )}
      </div>
    </nav>
  )
}
