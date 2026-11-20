import type { Tone } from './color'

/** What the user picked in Profil. */
export type ThemeMode = 'system' | 'day' | 'night'
/** What is actually shown. */
export type ResolvedTheme = Tone

export const THEME_KEY = 'phinas.theme'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Values written by versions before the editorial redesign. */
const LEGACY: Record<string, ThemeMode> = { light: 'day', dark: 'night', dynamic: 'system' }

export function parseMode(value: string | null): ThemeMode {
  if (value === 'system' || value === 'day' || value === 'night') return value
  if (value !== null && Object.hasOwn(LEGACY, value)) return LEGACY[value]
  return 'system'
}

/** The stored mode; an old value is migrated and written back. */
export function readMode(store: Store | null): ThemeMode {
  if (!store) return 'system'
  try {
    const raw = store.getItem(THEME_KEY)
    const mode = parseMode(raw)
    if (raw !== null && raw !== mode) store.setItem(THEME_KEY, mode)
    return mode
  } catch {
    return 'system'
  }
}

export function writeMode(store: Store | null, mode: ThemeMode): void {
  try {
    store?.setItem(THEME_KEY, mode)
  } catch {
    /* storage unavailable */
  }
}

export function resolveMode(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'night' : 'day'
  return mode
}

export function browserStorage(): Store | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const DARK_QUERY = '(prefers-color-scheme: dark)'
