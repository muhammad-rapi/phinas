import { Clock, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Track } from '../../../shared/types'
import { entryKey, type RecentEntry } from '../search/recent'

interface Props {
  query: string
  onQuery: (q: string) => void
  /** Enter pressed. */
  onSubmit: () => void
  recent: RecentEntry[]
  onForget: (entry: RecentEntry) => void
  onPlayTrack: (track: Track) => void
}

export function SearchBox({ query, onQuery, onSubmit, recent, onForget, onPlayTrack }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking anywhere outside the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    onSubmit()
    setOpen(false)
  }

  const showRecent = open && !query.trim()

  return (
    <form className="searchbox" onSubmit={submit}>
      <div className="searchwrap" ref={wrapRef}>
        <label className="searchpill">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => {
              onQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Cari lagu atau artis"
            aria-label="Cari lagu atau artis"
          />
          {query && (
            <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
              <X size={16} />
            </button>
          )}
        </label>
        {showRecent && (
          <div className="searchdrop">
            <h4>Pencarian terakhir</h4>
            {recent.length === 0 && <p className="muted">Belum ada pencarian.</p>}
            {recent.map((r) => (
              <div key={entryKey(r)} className="recent-item">
                <button
                  type="button"
                  className="recent-main"
                  onClick={() => {
                    if (r.kind === 'track') onPlayTrack(r.track)
                    else onQuery(r.text)
                    setOpen(false)
                  }}
                >
                  {r.kind === 'track' ? (
                    <>
                      <span
                        className="queue-thumb"
                        style={{
                          backgroundImage: `url("${r.track.coverUrl}")`
                        }}
                      />
                      <span className="queue-text">
                        <span className="queue-name">{r.track.title}</span>
                        <span className="muted queue-artist">Lagu · {r.track.artist}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={18} />
                      <span>{r.text}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onForget(r)}
                  aria-label={`Hapus ${r.kind === 'track' ? r.track.title : r.text}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}
