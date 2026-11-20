import { Disc3, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { LyricsPanel } from './LyricsPanel'
import { ArtistLinks, pressable } from '../nav/NavProvider'

type Tab = 'lyrics' | 'queue'

/** Shown at the top of the panel while a listen-together session is active. */
function SessionBlock(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available || l.state.status !== 'active') return null
  const name = l.partnerName ?? 'pasangan'
  return (
    <div className="panel-session">
      <span>
        Bareng <em>{name}</em> · {liveLabel(l.state, name)}
      </span>
      <button className="text-link" onClick={l.end}>
        Akhiri
      </button>
    </div>
  )
}

export function NowPlaying({ onExpandLyrics }: { onExpandLyrics: () => void }): React.JSX.Element {
  const p = usePlayer()
  const [tab, setTab] = useState<Tab>('lyrics')
  if (!p.track) {
    return (
      <div className="panel panel-empty">
        <SessionBlock />
        <Disc3 size={40} strokeWidth={1.2} />
        <p>Pilih lagu untuk mulai. Lirik dan antreannya tampil di sini.</p>
      </div>
    )
  }
  const upcoming = p.queue.tracks.slice(p.queue.index + 1)
  return (
    <div className="panel">
      <SessionBlock />
      <div className="panel-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'lyrics'} className="panel-tab" onClick={() => setTab('lyrics')}>
          Lirik
        </button>
        <button role="tab" aria-selected={tab === 'queue'} className="panel-tab" onClick={() => setTab('queue')}>
          Antrean
        </button>
        {tab === 'lyrics' && (
          <button className="icon-btn" onClick={onExpandLyrics} aria-label="Perbesar lirik" title="Perbesar lirik">
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      <div className="panel-now">
        <span className="panel-thumb" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
        <span className="panel-text">
          <strong>{p.track.title}</strong>
          <ArtistLinks artist={p.track.artist} />
        </span>
      </div>

      {tab === 'lyrics' ? (
        <LyricsPanel track={p.track} />
      ) : (
        <>
          <label className="panel-autoplay">
            <input type="checkbox" checked={p.autoplay} onChange={p.toggleAutoplay} />
            Autoplay: lanjut ke lagu serupa saat antrean habis
          </label>
          <div className="panel-queue">
            <span className="label">Berikutnya</span>
            {upcoming.length === 0 && <p className="muted small">Antrean kosong</p>}
            {upcoming.map((t, i) => (
              <div key={`${t.videoId}-${i}`} className="panel-row press" {...pressable(() => p.jump(p.queue.index + 1 + i))}>
                <span className="panel-thumb small" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
                <span className="panel-text">
                  <strong>{t.title}</strong>
                  <ArtistLinks artist={t.artist} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
