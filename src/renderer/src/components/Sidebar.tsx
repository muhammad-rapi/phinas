import { Home, Library, Search, Settings, type LucideIcon } from 'lucide-react'

export type Route = 'home' | 'search' | 'library' | 'settings'

const ITEMS: { route: Route; label: string; Icon: LucideIcon }[] = [
  { route: 'home', label: 'Home', Icon: Home },
  { route: 'search', label: 'Search', Icon: Search },
  { route: 'library', label: 'Library', Icon: Library },
  { route: 'settings', label: 'Settings', Icon: Settings }
]

export function Sidebar({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }): React.JSX.Element {
  return (
    <nav className="panel sidebar">
      <h1>Phinas</h1>
      {ITEMS.map((i) => (
        <button
          key={i.route}
          className={`nav-btn${route === i.route ? ' active' : ''}`}
          onClick={() => onNavigate(i.route)}
        >
          <i.Icon size={20} strokeWidth={2} />
          {i.label}
        </button>
      ))}
    </nav>
  )
}
