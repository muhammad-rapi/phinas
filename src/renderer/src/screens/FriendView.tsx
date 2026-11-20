import { useEffect, useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { PartnerPlaylist } from '../../../shared/types'
import { Avatar } from '../components/Avatar'
import { CollectionHeader } from '../components/CollectionHeader'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import { PlaylistCover } from '../components/PlaylistCover'
import { rememberPlaylist } from '../social/playlistCache'
import { useSocial } from '../social/SocialProvider'
import { friendStatusText } from '../social/text'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

/** A friend: online state, Listen Together, partner actions, remove, and their shared playlists. */
export function FriendView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const social = useSocial()
  const listen = useListen()
  const [lists, setLists] = useState<PartnerPlaylist[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let alive = true
    window.phinas
      .listFriendPlaylists(id)
      .then((p) => {
        if (!alive) return
        p.forEach(rememberPlaylist)
        setLists(p)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [id])

  const friend = social.friends.find((f) => f.userId === id)
  if (!friend) return <p className="muted">{social.loaded ? 'Orang ini tidak ada di daftar temanmu.' : 'Memuat…'}</p>

  const online = social.online.has(id)
  const withYou = listen.activeFriend === id && listen.state.status === 'active'
  const disabled = social.offline || working

  /** Runs an action and reloads the lists; the error shows under the header. */
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setError(null)
    setWorking(true)
    try {
      await action()
      await social.refresh()
      return true
    } catch (e) {
      setError(friendlyError(e))
      return false
    } finally {
      setWorking(false)
    }
  }

  const removeFriend = async (): Promise<void> => {
    if (!window.confirm(`Hapus ${friend.name} dari temanmu? Kalian tidak bisa melihat playlist satu sama lain lagi.`)) return
    if (await run(() => window.phinas.removeFriend(friend.friendshipId))) nav({ name: 'friends' })
  }

  const endPartner = async (): Promise<void> => {
    if (!window.confirm(`Akhiri pasangan dengan ${friend.name}? Kalian tetap berteman.`)) return
    await run(() => window.phinas.endPartner(friend.friendshipId))
  }

  let partnerButtons: React.ReactNode = null
  if (friend.isPartner) {
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void endPartner()}>
        Akhiri pasangan
      </button>
    )
  } else if (friend.partnerRequest === 'incoming') {
    partnerButtons = (
      <>
        <button className="btn" disabled={disabled} onClick={() => void run(() => window.phinas.respondPartner(friend.friendshipId, true))}>
          Terima jadi pasangan
        </button>
        <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.respondPartner(friend.friendshipId, false))}>
          Tolak
        </button>
      </>
    )
  } else if (friend.partnerRequest === 'outgoing') {
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.endPartner(friend.friendshipId))}>
        Menunggu jawaban · Batalkan
      </button>
    )
  } else if (!social.partner) {
    // With a partner already, asking would only fail with "partner_taken".
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.requestPartner(friend.friendshipId))}>
        Jadikan pasangan
      </button>
    )
  }

  return (
    <>
      <CollectionHeader
        cover={
          <Avatar className="fr-avatar" name={friend.name} src={friend.avatar} />
        }
        kind={friend.isPartner ? 'Pasangan' : 'Teman'}
        title={friend.name}
        meta={friendStatusText(online, withYou)}
        tracks={[]}
      >
        {online && friend.canListen && !withYou && (
          <button className="btn" disabled={!listen.canInvite(id)} onClick={() => listen.invite(id)}>
            Ajak dengar bareng
          </button>
        )}
        {partnerButtons}
        <button className="btn secondary" disabled={disabled} onClick={() => void removeFriend()}>
          Hapus teman
        </button>
      </CollectionHeader>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <section className="sec">
        <h2 className="section-title">Playlist</h2>
        {failed ? (
          <p className="muted">Tidak bisa memuat playlist. Cek koneksi internetmu.</p>
        ) : lists === null ? (
          <CoverGridSkeleton count={4} />
        ) : lists.length === 0 ? (
          <p className="muted">Belum membagikan playlist.</p>
        ) : (
          <CoverGrid
            items={lists.map((p) => ({
              key: p.id,
              art: <PlaylistCover covers={p.coverUrls} />,
              title: p.name,
              meta: `${p.tracks.length} lagu`,
              onOpen: () => nav({ name: 'friendPlaylist', id: p.id })
            }))}
          />
        )}
      </section>
    </>
  )
}
