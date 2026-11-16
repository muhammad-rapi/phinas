import type { Library } from '../library/library'
import type { PartnerPlaylist, PlaylistWithTracks, Track } from '../../shared/types'

export interface Remote {
  upsertPlaylist(p: PlaylistWithTracks): Promise<void>
  deletePlaylist(id: string): Promise<void>
  replaceLikes(tracks: Track[]): Promise<void>
  listPartnerPlaylists(): Promise<PartnerPlaylist[]>
}

export class SyncEngine {
  constructor(
    private lib: Library,
    private remote: Remote
  ) {}

  async flush(): Promise<{ pushed: number; error?: string }> {
    let pushed = 0
    for (const key of this.lib.pendingKeys()) {
      try {
        await this.push(key)
        this.lib.clearKey(key)
        pushed++
      } catch (e) {
        return { pushed, error: e instanceof Error ? e.message : String(e) }
      }
    }
    return { pushed }
  }

  private async push(key: string): Promise<void> {
    const i = key.indexOf(':')
    const kind = i === -1 ? key : key.slice(0, i)
    const id = i === -1 ? '' : key.slice(i + 1)
    if (kind === 'playlist') {
      const p = this.lib.getPlaylist(id)
      if (p) await this.remote.upsertPlaylist(p)
      else await this.remote.deletePlaylist(id)
    } else if (kind === 'likes') {
      await this.remote.replaceLikes(this.lib.listLikes())
    }
    // unknown kinds are ignored and cleared by the caller
  }
}
