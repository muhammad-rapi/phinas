import { Home, Search, Settings, X } from 'lucide-react'
import type { FormEvent } from 'react'

interface Props {
  query: string
  onQuery: (q: string) => void
  /** Enter pressed or the field focused. */
  onSubmit: () => void
  onFocusSearch: () => void
  onHome: () => void
  onSettings: () => void
  homeActive: boolean
}

export function TopBar({ query, onQuery, onSubmit, onFocusSearch, onHome, onSettings, homeActive }: Props): React.JSX.Element {
  const submit = (e: FormEvent): void => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <header className="topbar">
      <div className="topbar-brand">Phinas</div>
      <form className="topbar-center" onSubmit={submit}>
        <button type="button" className={`round-btn${homeActive ? ' active' : ''}`} onClick={onHome} aria-label="Home">
          <Home size={22} />
        </button>
        <label className="searchpill">
          <Search size={20} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={onFocusSearch}
            placeholder="Apa yang ingin kamu putar?"
            aria-label="Cari lagu atau artis"
          />
          {query && (
            <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
              <X size={18} />
            </button>
          )}
        </label>
      </form>
      <div className="topbar-right">
        <button className="round-btn" onClick={onSettings} aria-label="Pengaturan">
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}
