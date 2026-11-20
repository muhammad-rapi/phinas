import { expect, test } from 'vitest'
import { routeInvite } from '../src/renderer/src/sync/route'

test('with nothing going on, an invite starts a new session with that friend', () => {
  expect(routeInvite({ activeFriend: null, status: 'idle' }, 'x')).toBe('new')
})

test('after a finished or idle session with someone else, a new invite still gets through', () => {
  expect(routeInvite({ activeFriend: 'y', status: 'ended' }, 'x')).toBe('new')
  expect(routeInvite({ activeFriend: 'y', status: 'idle' }, 'x')).toBe('new')
})

test('the friend of the current session is handled by that session', () => {
  expect(routeInvite({ activeFriend: 'x', status: 'inviting' }, 'x')).toBe('session')
  expect(routeInvite({ activeFriend: 'x', status: 'invited' }, 'x')).toBe('session')
  expect(routeInvite({ activeFriend: 'x', status: 'active' }, 'x')).toBe('session')
})

test('anyone else is told we are busy while a session or an invite is open', () => {
  expect(routeInvite({ activeFriend: 'y', status: 'active' }, 'x')).toBe('busy')
  expect(routeInvite({ activeFriend: 'y', status: 'invited' }, 'x')).toBe('busy')
  expect(routeInvite({ activeFriend: 'y', status: 'inviting' }, 'x')).toBe('busy')
})
