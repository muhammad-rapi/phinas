export type Route = 'home' | 'search' | 'library' | 'settings'

const ITEMS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'search', label: 'Search' },
  { route: 'library', label: 'Library' },
  { route: 'settings', label: 'Settings' }
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
          {i.label}
        </button>
      ))}
    </nav>
  )
}
