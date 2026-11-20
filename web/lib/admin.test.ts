import { describe, expect, it } from 'vitest'
import { filterUsers, inviteState, parseQuota, relativeTime, summarize, toSettings, type AdminInvite, type AdminUser } from './admin'

const now = new Date('2026-11-20T12:00:00Z')
const invite = (p: Partial<AdminInvite>): AdminInvite => ({
  code: 'ABCD1234',
  createdByName: 'a',
  createdAt: '2026-11-19T00:00:00Z',
  expiresAt: '2026-12-03T00:00:00Z',
  usedByName: null,
  usedAt: null,
  revoked: false,
  ...p
})
const user = (p: Partial<AdminUser>): AdminUser => ({
  id: 'u',
  email: 'x@test',
  displayName: 'x',
  role: 'user',
  disabled: false,
  createdAt: '2026-11-01T00:00:00Z',
  lastSignInAt: null,
  invitedById: null,
  invitedByName: null,
  friendCount: 0,
  ...p
})

describe('inviteState', () => {
  it('used wins over revoked and expired', () => {
    expect(inviteState(invite({ usedAt: '2026-11-19T01:00:00Z', revoked: true, expiresAt: '2026-11-01T00:00:00Z' }), now)).toBe('used')
  })
  it('revoked, expired, open', () => {
    expect(inviteState(invite({ revoked: true }), now)).toBe('revoked')
    expect(inviteState(invite({ expiresAt: '2026-11-20T12:00:00Z' }), now)).toBe('expired')
    expect(inviteState(invite({}), now)).toBe('open')
  })
})

describe('relativeTime', () => {
  it('reads in Indonesian', () => {
    expect(relativeTime(null, now)).toBe('belum pernah')
    expect(relativeTime('2026-11-20T11:59:30Z', now)).toBe('baru saja')
    expect(relativeTime('2026-11-20T11:55:00Z', now)).toBe('5 menit lalu')
    expect(relativeTime('2026-11-20T09:00:00Z', now)).toBe('3 jam lalu')
    expect(relativeTime('2026-11-18T12:00:00Z', now)).toBe('2 hari lalu')
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toMatch(/2026/)
  })
})

describe('summarize', () => {
  it('counts users, weekly active, disabled and open invites', () => {
    const s = summarize(
      [user({ lastSignInAt: '2026-11-19T00:00:00Z' }), user({ lastSignInAt: '2026-11-01T00:00:00Z', disabled: true }), user({})],
      [invite({}), invite({ revoked: true })],
      now
    )
    expect(s).toEqual({ users: 3, activeWeek: 1, disabled: 1, openInvites: 1 })
  })
})

describe('filterUsers', () => {
  it('matches name or email, ignoring case', () => {
    const list = [user({ id: '1', displayName: 'Nadia' }), user({ id: '2', displayName: 'b', email: 'BUDI@x.test' })]
    expect(filterUsers(list, 'nad').map((u) => u.id)).toEqual(['1'])
    expect(filterUsers(list, 'budi').map((u) => u.id)).toEqual(['2'])
    expect(filterUsers(list, '  ')).toHaveLength(2)
  })
})

describe('settings', () => {
  it('reads app_config rows with defaults', () => {
    expect(toSettings([{ key: 'registration_open', value: false }, { key: 'invite_quota', value: 5 }])).toEqual({
      registration_open: false,
      listen_together_enabled: true,
      invite_quota: 5
    })
  })
  it('accepts whole numbers 0-1000 only', () => {
    expect(parseQuota('0')).toBe(0)
    expect(parseQuota(' 12 ')).toBe(12)
    expect(parseQuota('1001')).toBeNull()
    expect(parseQuota('2.5')).toBeNull()
    expect(parseQuota('')).toBeNull()
  })
})
