import { usePlayer } from '../player/PlayerProvider'

export function NowPlaying(): React.JSX.Element {
  const p = usePlayer()
  if (!p.track) {
    return (
      <div className="nowplaying">
        <p className="muted">Belum ada lagu yang diputar. Cari lagu di menu Search.</p>
      </div>
    )
  }
  const upcoming = p.queue.tracks.slice(p.queue.index + 1)
  return (
    <div className="nowplaying">
      <div className="big" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
      <div>
        <h4>{p.track.title}</h4>
        <div className="muted">{p.track.artist}</div>
      </div>
      <div className="queue-title">Berikutnya</div>
      {upcoming.length === 0 && <div className="muted">Antrean kosong</div>}
      {upcoming.map((t, i) => (
        <button
          key={`${t.videoId}-${i}`}
          className="list-item"
          onClick={() => p.jump(p.queue.index + 1 + i)}
        >
          {t.title} <span className="muted">· {t.artist}</span>
        </button>
      ))}
    </div>
  )
}
