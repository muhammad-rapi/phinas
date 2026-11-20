import type { Friend, PartnerPlaylist } from '../../../shared/types'

/** Online friends, partner first, then in list order. */
export function onlineFriends(friends: readonly Friend[], online: ReadonlySet<string>): Friend[] {
  const on = friends.filter((f) => online.has(f.userId))
  return [...on.filter((f) => f.isPartner), ...on.filter((f) => !f.isPartner)]
}

export interface OwnerGroup {
  ownerId: string
  ownerName: string
  playlists: PartnerPlaylist[]
}

/** Friends' playlists grouped by owner; owners keep the order of their newest playlist. */
export function groupByOwner(playlists: readonly PartnerPlaylist[]): OwnerGroup[] {
  const groups = new Map<string, OwnerGroup>()
  for (const p of playlists) {
    const g = groups.get(p.ownerId) ?? { ownerId: p.ownerId, ownerName: p.ownerName, playlists: [] }
    g.playlists.push(p)
    groups.set(p.ownerId, g)
  }
  return [...groups.values()]
}
