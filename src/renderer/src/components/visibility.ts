import type { Visibility } from '../../../shared/types'

export interface VisibilityOption {
  value: Visibility
  /** Shown in capitals by the label style: PRIBADI, TEMAN, PUBLIK. */
  label: string
  hint: string
  icon: 'lock' | 'users' | 'globe'
}

export const VISIBILITY_OPTIONS: readonly VisibilityOption[] = [
  { value: 'private', label: 'Pribadi', hint: 'Hanya kamu', icon: 'lock' },
  { value: 'friends', label: 'Teman', hint: 'Semua temanmu', icon: 'users' },
  { value: 'public', label: 'Publik', hint: 'Semua pengguna Phinas', icon: 'globe' }
]

export function visibilityOption(v: Visibility): VisibilityOption {
  return VISIBILITY_OPTIONS.find((o) => o.value === v) ?? VISIBILITY_OPTIONS[1]
}

/** The small icon after an own playlist in the sidebar; friends (the default) gets none. */
export function sidebarIcon(v: Visibility): 'lock' | 'globe' | null {
  if (v === 'private') return 'lock'
  if (v === 'public') return 'globe'
  return null
}
