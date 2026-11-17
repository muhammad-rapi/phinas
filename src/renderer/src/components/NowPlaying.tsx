import { Disc3, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { LyricsPanel } from './LyricsPanel'

type Tab = 'queue' | 'lyrics'

/** Shown at the top of the panel while a listen-together session is active. */
function SessionBlock(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available || l.state.status !== 'active') return null
  const name = l.partnerName ?? 'pasangan'
  return (
    <div className="np-session">
      <span>
        ● Bareng {name} · {liveLabel(l.state, name)}
      </span>
      <button className="pill-btn" onClick={l.end}>
        Akhiri
      </button>
    </div>
  )
}

export function NowPlaying({ onExpandLyrics }: { onExpandLyrics: () => void }): React.JSX.Element {
  const p = usePlayer()
  const [tab, setTab] = useState<Tab>('queue')
  if (!p.track) {
    return (
      <div className="nowplaying nowplaying-empty">
        <SessionBlock />
        <Disc3 size={48} strokeWidth={1.4} />
        <p className="muted">Pilih lagu untuk mulai. Sampulnya akan tampil di sini.</p>
      </div>
    )
  }
  const upcoming = p.queue.tracks.slice(p.queue.index + 1)
  return (
    <div className="nowplaying">
      <SessionBlock />
      <div className="np-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>
          Sedang diputar
        </button>
        <button role="tab" aria-selected={tab === 'lyrics'} className={tab === 'lyrics' ? 'active' : ''} onClick={() => setTab('lyrics')}>
          Lirik
        </button>
        {tab === 'lyrics' && (
          <button className="icon-btn np-expand" onClick={onExpandLyrics} aria-label="Perbesar lirik" title="Perbesar lirik">
            <Maximize2 size={18} />
          </button>
        )}
      </div>

      {tab === 'queue' ? (
        <>
          <div className="np-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
          <div>
            <h4 className="np-title">{p.track.title}</h4>
            <div className="muted">{p.track.artist}</div>
          </div>
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <input type="checkbox" checked={p.autoplay} onChange={p.toggleAutoplay} />
            Autoplay: lanjut ke lagu serupa saat antrean habis
          </label>
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
        </>
      ) : (
        <>
          <div className="np-mini">
            <span className="queue-thumb" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
            <span className="queue-text">
              <span className="queue-name">{p.track.title}</span>
              <span className="muted queue-artist">{p.track.artist}</span>
            </span>
          </div>
          <LyricsPanel track={p.track} />
        </>
      )}
    </div>
  )
}
