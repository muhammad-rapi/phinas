import { describe, expect, test } from 'vitest'
import { groupByOwner, inviteTarget, lineText, onlineFriends, onlineLine } from '../src/renderer/src/social/lists'
import type { Friend, PartnerPlaylist } from '../src/shared/types'

const friend = (userId: string, o: Partial<Friend> = {}): Friend => ({
  friendshipId: `fs-${userId}`,
  userId,
  name: userId,
  isPartner: false,
  partnerRequest: null,
  canListen: true,
  ...o
})

const pl = (id: string, ownerId: string, ownerName: string): PartnerPlaylist => ({
  id,
  name: id,
  updatedAt: 0,
  coverUrls: [],
  tracks: [],
  visibility: 'friends',
  ownerId,
  ownerName
})

describe('onlineFriends', () => {
  test('only online friends, partner first, then in list order', () => {
    const list = [friend('a'), friend('p', { isPartner: true }), friend('b'), friend('c')]
    expect(onlineFriends(list, new Set(['c', 'p', 'a'])).map((f) => f.userId)).toEqual(['p', 'a', 'c'])
  })
})

describe('groupByOwner', () => {
  test('groups by owner, owners in the order of their newest playlist', () => {
    const groups = groupByOwner([pl('1', 's', 'Sari'), pl('2', 'n', 'Nadia'), pl('3', 's', 'Sari')])
    expect(groups.map((g) => [g.ownerName, g.playlists.map((p) => p.id)])).toEqual([
      ['Sari', ['1', '3']],
      ['Nadia', ['2']]
    ])
  })
})

describe('onlineLine', () => {
  const people = (...names: string[]): { id: string; name: string }[] => names.map((n) => ({ id: n.toLowerCase(), name: n }))

  test('one, two, and more people', () => {
    expect(lineText(onlineLine(people('Nadia')))).toBe('Nadia')
    expect(lineText(onlineLine(people('Nadia', 'Sari')))).toBe('Nadia dan Sari')
    expect(lineText(onlineLine(people('Nadia', 'Sari', 'Dewi')))).toBe('Nadia, Sari, dan 1 lainnya')
    expect(lineText(onlineLine(people('Nadia', 'Sari', 'Dewi', 'Ayu', 'Rina')))).toBe('Nadia, Sari, dan 3 lainnya')
  })

  test('names stay separate parts so they can be links', () => {
    expect(onlineLine(people('Nadia', 'Sari'))).toEqual([{ id: 'nadia', name: 'Nadia' }, ' dan ', { id: 'sari', name: 'Sari' }])
  })

  test('nobody online gives an empty line', () => {
    expect(onlineLine([])).toEqual([])
  })
})

describe('inviteTarget', () => {
  test('the partner when online and allowed', () => {
    expect(inviteTarget([friend('a'), friend('p', { isPartner: true })])?.userId).toBe('p')
  })

  test('otherwise the first online friend who allows it', () => {
    expect(inviteTarget([friend('a', { canListen: false }), friend('p', { isPartner: true, canListen: false }), friend('b')])?.userId).toBe('b')
    expect(inviteTarget([friend('a', { canListen: false })])).toBeNull()
  })
})
