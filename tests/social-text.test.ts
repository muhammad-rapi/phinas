import { expect, test } from 'vitest'
import { friendStatusText, inviteState, inviteText } from '../src/renderer/src/social/text'
import type { InviteCode } from '../src/shared/types'

const inv = (o: Partial<InviteCode> = {}): InviteCode => ({
  code: 'ABCD2345',
  createdAt: '2026-11-20T00:00:00Z',
  expiresAt: '2026-12-04T00:00:00Z',
  usedAt: null,
  usedByName: null,
  revoked: false,
  ...o
})
const NOW = Date.parse('2026-11-20T12:00:00Z')

test('an open code counts the days it has left, rounded up', () => {
  expect(inviteState(inv(), NOW)).toEqual({ kind: 'active', daysLeft: 14 })
  expect(inviteText(inviteState(inv(), NOW))).toBe('aktif · berlaku 14 hari lagi')
})

test('a used code names who used it, even after it would have expired', () => {
  const used = inv({ usedAt: '2026-11-21T00:00:00Z', usedByName: 'Sari' })
  expect(inviteText(inviteState(used, Date.parse('2027-01-01T00:00:00Z')))).toBe('dipakai oleh Sari')
})

test('expired and revoked codes', () => {
  expect(inviteText(inviteState(inv(), Date.parse('2026-12-05T00:00:00Z')))).toBe('kedaluwarsa')
  expect(inviteText(inviteState(inv({ revoked: true }), NOW))).toBe('dicabut')
})

test("a friend's status", () => {
  expect(friendStatusText(true, false)).toBe('online')
  expect(friendStatusText(false, false)).toBe('offline')
  expect(friendStatusText(true, true)).toBe('online · bareng kamu')
})
