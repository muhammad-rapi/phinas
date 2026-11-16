import { Heart } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'

export function LikedView(): React.JSX.Element {
  const player = usePlayer()
  const { likes } = useLibrary()
  return (
    <>
      <CollectionHeader
        cover={
          <div className="pcover pcover-liked">
            <Heart size={64} fill="currentColor" />
          </div>
        }
        kind="Playlist"
        title="Lagu yang disukai"
        meta={`${likes.length} lagu`}
        onPlay={likes.length ? () => player.play(likes, 0) : undefined}
      />
      {likes.length === 0 && <p className="muted">Belum ada lagu yang disukai. Tekan ikon hati di lagu mana pun.</p>}
      {likes.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(likes, i)} />
      ))}
    </>
  )
}
