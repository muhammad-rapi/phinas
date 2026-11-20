import { Globe, Lock, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { Visibility } from '../../../shared/types'
import { VISIBILITY_OPTIONS, visibilityOption } from './visibility'

const ICONS: Record<'lock' | 'users' | 'globe', LucideIcon> = { lock: Lock, users: Users, globe: Globe }

/** The playlist header's label line: who can see this playlist, and a menu to change it. */
export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const current = visibilityOption(value)
  const Icon = ICONS[current.icon]

  return (
    <span className="menu-wrap vis-wrap">
      <button
        className="vis-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Siapa yang bisa melihat playlist ini"
      >
        <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
        {current.label}
      </button>
      {open && (
        <>
          <span className="menu-backdrop" onClick={() => setOpen(false)} />
          <span className="menu vis-menu" role="menu">
            {VISIBILITY_OPTIONS.map((o) => {
              const ItemIcon = ICONS[o.icon]
              const on = o.value === value
              return (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={on}
                  className={`menu-item vis-item${on ? ' active' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    if (!on) onChange(o.value)
                  }}
                >
                  <ItemIcon size={14} aria-hidden="true" />
                  <span className="vis-text">
                    <strong>{o.label}</strong>
                    <span className="small">{o.hint}</span>
                  </span>
                </button>
              )
            })}
          </span>
        </>
      )}
    </span>
  )
}
