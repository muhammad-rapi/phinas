import type { PartnerPlaylist } from '../../../shared/types'

const seen = new Map<string, PartnerPlaylist>()

/** Keeps a friend's or public playlist so the playlist screen can open it by id. */
export function rememberPlaylist(p: PartnerPlaylist): void {
  seen.set(p.id, p)
}

export function rememberedPlaylist(id: string): PartnerPlaylist | undefined {
  return seen.get(id)
}
