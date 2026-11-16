import { Disc3 } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'

export function NowPlaying(): React.JSX.Element {
  const p = usePlayer()
  if (!p.track) {
    return (
      <div className="nowplaying nowplaying-empty">
        <Disc3 size={48} strokeWidth={1.4} />
        <p className="muted">Pilih lagu untuk mulai. Sampulnya akan tampil di sini.</p>
      </div>
    )
  }
  const upcoming = p.queue.tracks.slice(p.queue.index + 1)
  return (
    <div className="nowplaying">
      <div className="np-heading">Sedang diputar</div>
      <div className="np-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
      <div>
        <h4 className="np-title">{p.track.title}</h4>
        <div className="muted">{p.track.artist}</div>
      </div>
      <div className="queue-title">Berikutnya</div>
      {upcoming.length === 0 && <div className="muted">Antrean kosong</div>}
      {upcoming.map((t, i) => (
        <button key={`${t.videoId}-${i}`} className="queue-item" onClick={() => p.jump(p.queue.index + 1 + i)}>
          <span className="queue-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
          <span className="queue-text">
            <span className="queue-name">{t.title}</span>
            <span className="muted queue-artist">{t.artist}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
