import { ArrowLeft, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { PartnerPlaylist, Playlist, PlaylistWithTracks, Track } from '../../../shared/types'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'

type Tab = 'mine' | 'liked' | 'partner'

export function Library({ initialPlaylistId }: { initialPlaylistId?: string }): React.JSX.Element {
  const player = usePlayer()
  const [tab, setTab] = useState<Tab>('mine')
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selected, setSelected] = useState<PlaylistWithTracks | null>(null)
  const [likes, setLikes] = useState<Track[]>([])
  const [partner, setPartner] = useState<PartnerPlaylist[]>([])
  const [partnerError, setPartnerError] = useState<string | null>(null)
  const [openPartner, setOpenPartner] = useState<PartnerPlaylist | null>(null)
  const [name, setName] = useState('')

  const refresh = useCallback(async (selectId?: string) => {
    const list = await window.phinas.listPlaylists()
    setPlaylists(list)
    const id = selectId ?? selected?.id ?? list[0]?.id
    setSelected(id ? await window.phinas.getPlaylist(id) : null)
  }, [selected?.id])

  useEffect(() => {
    void refresh(initialPlaylistId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'liked') window.phinas.listLikes().then(setLikes)
    if (tab === 'partner') {
      setPartnerError(null)
      window.phinas
        .listPartnerPlaylists()
        .then(setPartner)
        .catch(() => setPartnerError('Belum bisa mengambil playlist pasangan. Cek login di Settings.'))
    }
  }, [tab])

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    const p = await window.phinas.createPlaylist(name.trim())
    setName('')
    await refresh(p.id)
  }

  const remove = async (id: string): Promise<void> => {
    if (!confirm('Hapus playlist ini?')) return
    await window.phinas.deletePlaylist(id)
    setSelected(null)
    await refresh(undefined)
  }

  const copy = async (p: PartnerPlaylist): Promise<void> => {
    const c = await window.phinas.copyPartnerPlaylist(p)
    setTab('mine')
    await refresh(c.id)
  }

  return (
    <>
      <h2>Library</h2>
      <div className="tabs">
        {(['mine', 'liked', 'partner'] as Tab[]).map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'mine' ? 'Playlist saya' : t === 'liked' ? 'Disukai' : 'Pasangan'}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <div className="split">
          <div>
            <div className="searchbar">
              <input
                placeholder="Playlist baru"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              <button className="btn" onClick={create} aria-label="Buat playlist">
                <Plus size={18} />
              </button>
            </div>
            {playlists.map((p) => (
              <button
                key={p.id}
                className={`list-item${selected?.id === p.id ? ' active' : ''}`}
                onClick={async () => setSelected(await window.phinas.getPlaylist(p.id))}
              >
                {p.name}
              </button>
            ))}
            {playlists.length === 0 && <p className="muted">Belum ada playlist.</p>}
          </div>
          <div>
            {selected ? (
              <>
                <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
                <div className="tabs">
                  <button
                    className="btn"
                    disabled={!selected.tracks.length}
                    onClick={() => player.play(selected.tracks, 0)}
                  >
                    Putar semua
                  </button>
                  <button className="btn secondary" onClick={() => remove(selected.id)}>Hapus playlist</button>
                </div>
                {selected.tracks.length === 0 && (
                  <p className="muted">Kosong. Tambahkan lagu dari menu Search.</p>
                )}
                {selected.tracks.map((t, i) => (
                  <TrackRow
                    key={t.videoId}
                    track={t}
                    onPlay={() => player.play(selected.tracks, i)}
                    onRemove={async () => {
                      await window.phinas.removeTrack(selected.id, t.videoId)
                      await refresh(selected.id)
                    }}
                  />
                ))}
              </>
            ) : (
              <p className="muted">Pilih atau buat playlist.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'liked' && (
        <>
          {likes.length === 0 && <p className="muted">Belum ada lagu yang disukai.</p>}
          {likes.map((t, i) => (
            <TrackRow key={t.videoId} track={t} onPlay={() => player.play(likes, i)} />
          ))}
        </>
      )}

      {tab === 'partner' && (
        <>
          {partnerError && <div className="notice">{partnerError}</div>}
          {!openPartner && partner.length === 0 && !partnerError && (
            <p className="muted">Pasangan belum membagikan playlist.</p>
          )}
          {!openPartner && (
            <div className="grid">
              {partner.map((p) => (
                <button key={p.id} className="card" onClick={() => setOpenPartner(p)}>
                  <div className="art" style={p.tracks[0] ? { backgroundImage: `url("${p.tracks[0].coverUrl}")` } : undefined} />
                  <strong>{p.name}</strong>
                  <span className="muted">{p.ownerName} · {p.tracks.length} lagu</span>
                </button>
              ))}
            </div>
          )}
          {openPartner && (
            <>
              <div className="tabs">
                <button className="btn secondary" onClick={() => setOpenPartner(null)}>
                  <ArrowLeft size={16} /> Kembali
                </button>
                <button className="btn" onClick={() => copy(openPartner)}>Salin ke library saya</button>
                <button className="btn secondary" disabled={!openPartner.tracks.length} onClick={() => player.play(openPartner.tracks, 0)}>
                  Putar semua
                </button>
              </div>
              <h3 style={{ marginTop: 0 }}>{openPartner.name}</h3>
              {openPartner.tracks.map((t, i) => (
                <TrackRow key={t.videoId} track={t} onPlay={() => player.play(openPartner.tracks, i)} />
              ))}
            </>
          )}
        </>
      )}
    </>
  )
}
