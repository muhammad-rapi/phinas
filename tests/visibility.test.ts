import { expect, test } from 'vitest'
import { sidebarIcon, VISIBILITY_OPTIONS, visibilityOption } from '../src/renderer/src/components/visibility'

test('three options in order, each with a one-line explanation and an icon', () => {
  expect(VISIBILITY_OPTIONS.map((o) => [o.value, o.label, o.hint, o.icon])).toEqual([
    ['private', 'Pribadi', 'Hanya kamu', 'lock'],
    ['friends', 'Teman', 'Semua temanmu', 'users'],
    ['public', 'Publik', 'Semua pengguna Phinas', 'globe']
  ])
})

test('visibilityOption finds each value', () => {
  expect(visibilityOption('private').label).toBe('Pribadi')
  expect(visibilityOption('friends').label).toBe('Teman')
  expect(visibilityOption('public').label).toBe('Publik')
})

test('the sidebar marks private and public playlists, not friends ones', () => {
  expect(sidebarIcon('private')).toBe('lock')
  expect(sidebarIcon('public')).toBe('globe')
  expect(sidebarIcon('friends')).toBeNull()
})
