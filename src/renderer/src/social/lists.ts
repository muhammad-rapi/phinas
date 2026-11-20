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

/** A piece of the online line: plain text, or a person (rendered as a link to their profile). */
export type LinePart = string | { id: string; name: string }

/** "Nadia", "Nadia dan Sari", "Nadia, Sari, dan 1 lainnya": up to `max` names, then a count. */
export function onlineLine(people: readonly { id: string; name: string }[], max = 2): LinePart[] {
  const shown = people.slice(0, max)
  const more = people.length - shown.length
  const parts: LinePart[] = []
  shown.forEach((p, i) => {
    if (i > 0) parts.push(more === 0 && i === shown.length - 1 ? ' dan ' : ', ')
    parts.push({ id: p.id, name: p.name })
  })
  if (more > 0) parts.push(`, dan ${more} lainnya`)
  return parts
}

export const lineText = (parts: readonly LinePart[]): string => parts.map((p) => (typeof p === 'string' ? p : p.name)).join('')

/** Who Beranda's Ajak invites: the partner when online and allowed, else the first online friend who allows it. */
export function inviteTarget(online: readonly Friend[]): Friend | null {
  return online.find((f) => f.isPartner && f.canListen) ?? online.find((f) => f.canListen) ?? null
}
