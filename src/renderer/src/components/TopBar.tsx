import { Clock, Home, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

interface Props {
  query: string
  onQuery: (q: string) => void
  /** Enter pressed. */
  onSubmit: () => void
  recent: string[]
  onForget: (q: string) => void
  onHome: () => void
  onProfile: () => void
  homeActive: boolean
  profileActive: boolean
  initial: string
}

export function TopBar({
  query,
  onQuery,
  onSubmit,
  recent,
  onForget,
  onHome,
  onProfile,
  homeActive,
  profileActive,
  initial
}: Props): React.JSX.Element {
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
    <header className="topbar">
      <div className="topbar-brand">Phinas</div>
      <form className="topbar-center" onSubmit={submit}>
        <button type="button" className={`round-btn${homeActive ? ' active' : ''}`} onClick={onHome} aria-label="Home">
          <Home size={22} />
        </button>
        <div className="searchwrap" ref={wrapRef}>
          <label className="searchpill">
            <Search size={20} />
            <input
              value={query}
              onChange={(e) => {
                onQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              placeholder="Apa yang ingin kamu putar?"
              aria-label="Cari lagu atau artis"
            />
            {query && (
              <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
                <X size={18} />
              </button>
            )}
          </label>
          {showRecent && (
            <div className="searchdrop">
              <h4>Pencarian terakhir</h4>
              {recent.length === 0 && <p className="muted">Belum ada pencarian.</p>}
              {recent.map((r) => (
                <div key={r} className="recent-item">
                  <button
                    type="button"
                    className="recent-main"
                    onClick={() => {
                      onQuery(r)
                      setOpen(false)
                    }}
                  >
                    <Clock size={18} />
                    <span>{r}</span>
                  </button>
                  <button type="button" className="icon-btn" onClick={() => onForget(r)} aria-label={`Hapus ${r}`}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
      <div className="topbar-right">
        <button className={`profile-btn${profileActive ? ' active' : ''}`} onClick={onProfile} aria-label="Profil">
          {initial}
        </button>
      </div>
    </header>
  )
}
