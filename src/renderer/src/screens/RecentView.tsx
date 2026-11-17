import { History } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Track } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'

export function RecentView(): React.JSX.Element {
  const player = usePlayer()
  const [tracks, setTracks] = useState<Track[] | null>(null)

  useEffect(() => {
    window.phinas.listRecentPlays(50).then(setTracks).catch(() => setTracks([]))
  }, [])

  const list = tracks ?? []
  return (
    <>
      <CollectionHeader
        cover={
          <div className="pcover pcover-liked">
            <History size={64} />
          </div>
        }
        kind="Riwayat"
        title="Baru diputar"
        meta={`${list.length} lagu`}
        onPlay={list.length ? () => player.play(list, 0) : undefined}
      />
      {tracks && list.length === 0 && (
        <p className="muted">Belum ada riwayat. Lagu yang kamu dengarkan lebih dari 30 detik akan muncul di sini.</p>
      )}
      {list.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(list, i)} />
      ))}
    </>
  )
}
