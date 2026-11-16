import { useEffect, useState } from 'react'
import type { PartnerPlaylist, Playlist } from '../../../shared/types'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

interface Props {
  onOpenPlaylist: (id: string) => void
  onOpenPartner: () => void
}

export function Home({ onOpenPlaylist, onOpenPartner }: Props): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [partner, setPartner] = useState<PartnerPlaylist[]>([])

  useEffect(() => {
    window.phinas.listPlaylists().then(setPlaylists)
    window.phinas.listPartnerPlaylists().then(setPartner).catch(() => setPartner([]))
  }, [])

  return (
    <>
      <h2>{greeting()}</h2>
      <h3>Playlist kamu</h3>
      {playlists.length === 0 && <p className="muted">Belum ada playlist. Buat satu di Library.</p>}
      <div className="grid">
        {playlists.map((p) => (
          <button key={p.id} className="card" onClick={() => onOpenPlaylist(p.id)}>
            <div className="art" />
            <strong>{p.name}</strong>
          </button>
        ))}
      </div>
      {partner.length > 0 && (
        <>
          <h3>Dari pasangan</h3>
          <div className="grid">
            {partner.map((p) => (
              <button key={p.id} className="card" onClick={onOpenPartner}>
                <div className="art" style={p.tracks[0] ? { backgroundImage: `url("${p.tracks[0].coverUrl}")` } : undefined} />
                <strong>{p.name}</strong>
                <span className="muted">{p.ownerName}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
