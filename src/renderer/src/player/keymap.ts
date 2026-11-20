import type { PlayerCommand } from '../../../shared/types'

export interface KeyLike {
  key: string
  code: string
  shiftKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
}

/**
 * Local shortcuts (window focused, not typing in a field).
 * Cmd/Ctrl+Arrow stays as an alias for next and previous.
 */
export function keyToCommand(e: KeyLike): PlayerCommand | null {
  const mod = e.metaKey || e.ctrlKey
  if (e.altKey) return null
  if (mod) {
    if (e.key === 'ArrowRight') return 'next'
    if (e.key === 'ArrowLeft') return 'prev'
    return null
  }
  if (e.code === 'Space') return 'toggle'
  if (e.shiftKey && e.key === 'ArrowRight') return 'next'
  if (e.shiftKey && e.key === 'ArrowLeft') return 'prev'
  switch (e.key) {
    case 'ArrowUp':
      return 'volumeUp'
    case 'ArrowDown':
      return 'volumeDown'
    case 'm':
    case 'M':
      return 'mute'
    case 'l':
    case 'L':
      return 'like'
    case 's':
    case 'S':
      return 'shuffle'
    case 'r':
    case 'R':
      return 'repeat'
    case '/':
      return 'focusSearch'
    default:
      return null
  }
}
