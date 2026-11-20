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
  const wrapRef = useRef<HTMLFormElement>(null)

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
    <form className="search" onSubmit={submit} ref={wrapRef}>
      <label className="searchpill">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => {
            onQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Cari…"
          aria-label="Cari lagu atau artis"
        />
        {query && (
          <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
            <X size={14} />
          </button>
        )}
      </label>
      {showRecent && (
        <div className="search-drop">
          <span className="label">Pencarian terakhir</span>
          {recent.length === 0 && <p className="search-empty">Belum ada pencarian.</p>}
          {recent.map((r) => (
            <div key={entryKey(r)} className="search-row">
              <button
                type="button"
                className="search-pick"
                onClick={() => {
                  if (r.kind === 'track') onPlayTrack(r.track)
                  else onQuery(r.text)
                  setOpen(false)
                }}
              >
                {r.kind === 'track' ? (
                  <span className="search-text">
                    <strong>{r.track.title}</strong>
                    <span className="small">Lagu · {r.track.artist}</span>
                  </span>
                ) : (
                  <>
                    <Clock size={14} />
                    <span className="search-text">
                      <span>{r.text}</span>
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onForget(r)}
                aria-label={`Hapus ${r.kind === 'track' ? r.track.title : r.text}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
