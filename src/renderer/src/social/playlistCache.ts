import type { PartnerPlaylist } from '../../../shared/types'

const seen = new Map<string, PartnerPlaylist>()

/** Keeps a friend's or public playlist so the playlist screen can open it by id. */
export function rememberPlaylist(p: PartnerPlaylist): void {
  seen.set(p.id, p)
}

/** Forget everything: another account must not see the last one's playlists. */
export function clearPlaylists(): void {
  seen.clear()
}

export function rememberedPlaylist(id: string): PartnerPlaylist | undefined {
  return seen.get(id)
}
