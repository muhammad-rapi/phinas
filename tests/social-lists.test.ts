import { describe, expect, test } from 'vitest'
import { groupByOwner, onlineFriends } from '../src/renderer/src/social/lists'
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
