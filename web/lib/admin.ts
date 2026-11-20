/** Shapes returned by the admin RPCs (supabase/migrations/*_0400_admin_rpcs.sql) and pure helpers for the panel. */

export interface AdminUser {
  id: string
  email: string | null
  displayName: string
  role: 'user' | 'admin'
  disabled: boolean
  createdAt: string
  lastSignInAt: string | null
  invitedById: string | null
  invitedByName: string | null
  friendCount: number
}

export interface AdminInvite {
  code: string
  createdByName: string
  createdAt: string
  expiresAt: string
  usedByName: string | null
  usedAt: string | null
  revoked: boolean
}

export interface AppSettings {
  registration_open: boolean
  listen_together_enabled: boolean
  invite_quota: number
}

export type InviteState = 'open' | 'used' | 'expired' | 'revoked'

export function inviteState(i: AdminInvite, now: Date): InviteState {
  if (i.usedAt) return 'used'
  if (i.revoked) return 'revoked'
  if (new Date(i.expiresAt).getTime() <= now.getTime()) return 'expired'
  return 'open'
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "baru saja", "5 menit lalu", "3 jam lalu", "2 hari lalu", then a date. Null → "belum pernah". */
export function relativeTime(iso: string | null, now: Date): string {
  if (!iso) return 'belum pernah'
  const t = new Date(iso)
  const diff = now.getTime() - t.getTime()
  if (diff < MINUTE) return 'baru saja'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} menit lalu`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} jam lalu`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} hari lalu`
  return shortDate(iso)
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface Summary {
  users: number
  activeWeek: number
  disabled: number
  openInvites: number
}

export function summarize(users: AdminUser[], invites: AdminInvite[], now: Date): Summary {
  const weekAgo = now.getTime() - 7 * DAY
  return {
    users: users.length,
    activeWeek: users.filter((u) => u.lastSignInAt && new Date(u.lastSignInAt).getTime() >= weekAgo).length,
    disabled: users.filter((u) => u.disabled).length,
    openInvites: invites.filter((i) => inviteState(i, now) === 'open').length
  }
}

/** Case-insensitive match on name or email. */
export function filterUsers(users: AdminUser[], query: string): AdminUser[] {
  const q = query.trim().toLowerCase()
  if (!q) return users
  return users.filter((u) => u.displayName.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))
}

/** app_config rows → settings, with the database defaults for missing keys. */
export function toSettings(rows: { key: string; value: unknown }[]): AppSettings {
  const get = (k: string): unknown => rows.find((r) => r.key === k)?.value
  const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d)
  const quota = get('invite_quota')
  return {
    registration_open: bool(get('registration_open'), true),
    listen_together_enabled: bool(get('listen_together_enabled'), true),
    invite_quota: typeof quota === 'number' ? quota : 3
  }
}

/** The quota field's text → a valid quota (0-1000 whole number) or null. */
export function parseQuota(text: string): number | null {
  if (!/^\d{1,4}$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n <= 1000 ? n : null
}
