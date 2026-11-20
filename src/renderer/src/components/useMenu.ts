import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

export type MenuKeyAction = 'close' | 'next' | 'prev' | 'first' | 'last' | null

/** What a key does inside an open menu. Pure so it can be tested. */
export function menuKey(key: string): MenuKeyAction {
  switch (key) {
    case 'Escape':
      return 'close'
    case 'ArrowDown':
      return 'next'
    case 'ArrowUp':
      return 'prev'
    case 'Home':
      return 'first'
    case 'End':
      return 'last'
    default:
      return null
  }
}

/** The item to focus after `action`, wrapping around; -1 when there is nothing to focus. */
export function menuTarget(action: MenuKeyAction, current: number, count: number): number {
  if (count <= 0) return -1
  if (action === 'first') return 0
  if (action === 'last') return count - 1
  if (action === 'next') return current < 0 ? 0 : (current + 1) % count
  if (action === 'prev') return current < 0 ? count - 1 : (current - 1 + count) % count
  return current
}

const ITEMS = '[role^="menuitem"]:not(:disabled)'

export interface MenuApi<W extends HTMLElement> {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  close: () => void
  /** Put on the element wrapping the trigger and the menu. */
  wrapRef: RefObject<W | null>
  /** Put on the trigger button; focus returns here when the menu closes. */
  triggerRef: RefObject<HTMLButtonElement | null>
  /** Spread on the wrapper: Escape closes, arrows move between items. */
  onKeyDown: (e: KeyboardEvent) => void
}

/** Open/close state plus keyboard handling for a small popup menu. Outside clicks are the caller's backdrop. */
export function useMenu<W extends HTMLElement = HTMLDivElement>(): MenuApi<W> {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<W | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) {
      wrapRef.current?.querySelector<HTMLElement>(ITEMS)?.focus()
    } else if (wasOpen.current) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  const close = useCallback(() => setOpen(false), [])
  const toggle = useCallback(() => setOpen((o) => !o), [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (!open) return
      const action = menuKey(e.key)
      if (!action) return
      e.stopPropagation()
      if (action === 'close') {
        e.preventDefault()
        setOpen(false)
        return
      }
      const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])
      if (items.length === 0) return
      e.preventDefault()
      const at = menuTarget(action, items.indexOf(document.activeElement as HTMLElement), items.length)
      items[at]?.focus()
    },
    [open]
  )

  return { open, setOpen, toggle, close, wrapRef, triggerRef, onKeyDown }
}
