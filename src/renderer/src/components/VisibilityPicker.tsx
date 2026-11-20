import { Globe, Lock, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { Visibility } from '../../../shared/types'
import { useMenu } from './useMenu'
import { VISIBILITY_OPTIONS, visibilityOption } from './visibility'

const ICONS: Record<'lock' | 'users' | 'globe', LucideIcon> = { lock: Lock, users: Users, globe: Globe }

/** The playlist header's label line: who can see this playlist, and a menu to change it. */
export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => Promise<void> }): React.JSX.Element {
  const { open, toggle, close, wrapRef, triggerRef, onKeyDown } = useMenu<HTMLSpanElement>()
  const [error, setError] = useState<string | null>(null)
  const current = visibilityOption(value)
  const Icon = ICONS[current.icon]

  return (
    <span className="menu-wrap vis-wrap" ref={wrapRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        className="vis-btn"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Siapa yang bisa melihat playlist ini"
      >
        <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
        {current.label}
      </button>
      {open && (
        <>
          <span className="menu-backdrop" onClick={close} />
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
                    close()
                    if (on) return
                    setError(null)
                    onChange(o.value).catch((err: unknown) => setError(friendlyError(err)))
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
      {error && (
        <span className="notice" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
