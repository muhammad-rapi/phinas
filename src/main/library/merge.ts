import type { LikeEntry, PlaylistWithTracks } from '../../shared/types'

/** Own playlists (with tracks) and likes, as one side of a pull sees them. */
export interface LibrarySnapshot {
  playlists: PlaylistWithTracks[]
  likes: LikeEntry[]
}

/** What a pull changes locally. Nothing in it is queued for upload. */
export interface MergePlan {
  /** Playlists to store as the server has them: new there, or newer there. */
  upsert: PlaylistWithTracks[]
  /** Local playlists that were deleted on another computer. */
  remove: string[]
  /** The server's likes, or null to keep the local ones. */
  likes: LikeEntry[] | null
}

const sameLikes = (a: LikeEntry[], b: LikeEntry[]): boolean => {
  if (a.length !== b.length) return false
  const ids = new Set(a.map((l) => l.videoId))
  return b.every((l) => ids.has(l.videoId))
}

/**
 * Merges the account's server copy into the local library. A key still in the outbox means this
 * computer changed it since the last push: the local side wins and will be pushed.
 * - Playlists by id: both sides → the newer `updatedAt` wins; server only → added; local only → removed.
 * - Likes: the server's set wins.
 * - Guard: an entirely empty server answer (no playlists, no likes) while the local library has synced data
 *   deletes nothing.
 */
export function mergeLibrary(local: LibrarySnapshot, remote: LibrarySnapshot, pendingKeys: readonly string[]): MergePlan {
  const pending = new Set(pendingKeys)
  const isPending = (id: string): boolean => pending.has(`playlist:${id}`)
  const localById = new Map(local.playlists.map((p) => [p.id, p]))
  const remoteIds = new Set(remote.playlists.map((p) => p.id))
  const upsert = remote.playlists.filter((r) => {
    if (isPending(r.id)) return false
    const l = localById.get(r.id)
    return !l || r.updatedAt > l.updatedAt
  })
  // Safety guard: an empty answer while the local library holds synced data is more likely a wrong
  // answer (RLS, wrong account, glitch) than a real wipe; delete nothing locally for this pull.
  const localSynced = local.playlists.some((p) => !isPending(p.id)) || (local.likes.length > 0 && !pending.has('likes'))
  const emptyAnswer = remote.playlists.length === 0 && remote.likes.length === 0 && localSynced
  const remove = emptyAnswer ? [] : local.playlists.filter((p) => !remoteIds.has(p.id) && !isPending(p.id)).map((p) => p.id)
  const likes = emptyAnswer || pending.has('likes') || sameLikes(local.likes, remote.likes) ? null : remote.likes
  return { upsert, remove, likes }
}

/** How many things the plan changes (0 = the local library already matches the server). */
export const mergeChanges = (plan: MergePlan): number => plan.upsert.length + plan.remove.length + (plan.likes ? 1 : 0)
