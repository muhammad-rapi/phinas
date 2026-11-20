import type { Library } from '../library/library'
import { mergeChanges, mergeLibrary, type LibrarySnapshot } from '../library/merge'
import type { LikeEntry, PlaylistWithTracks } from '../../shared/types'

export interface Remote {
  upsertPlaylist(p: PlaylistWithTracks): Promise<void>
  deletePlaylist(id: string): Promise<void>
  /** Replaces the account's likes with these, like times included. */
  replaceLikes(likes: LikeEntry[]): Promise<void>
  /** The account's own playlists (with tracks) and likes. */
  pullLibrary(): Promise<LibrarySnapshot>
}

/** The signed-in account, from the stored session. */
export interface SessionSource {
  session(): Promise<{ userId: string } | null>
}

/**
 * The sync engine for `owner`'s library, or null for a library no account owns (signed out, or the
 * pre-account library before a claim): those are never synced. The engine only talks to the server
 * while it is still the active one (`isActive`) and the signed-in account is still `owner`.
 */
export function engineFor(
  lib: Library,
  owner: string | null,
  remote: (Remote & SessionSource) | null,
  isActive: (engine: SyncEngine) => boolean
): SyncEngine | null {
  if (!remote || owner === null) return null
  const engine: SyncEngine = new SyncEngine(lib, remote, async () => isActive(engine) && (await remote.session())?.userId === owner)
  return engine
}

/**
 * Pushes the outbox and pulls the account's library. Flush and pull never overlap: a pull that read
 * the server before a push finished could otherwise delete a playlist that was just uploaded.
 * `allowed` is asked before every push and pull and again before a pulled copy is applied; when it
 * says no (another account signed in, or this library is no longer the open one) nothing is sent
 * and nothing is applied.
 */
export class SyncEngine {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private lib: Library,
    private remote: Remote,
    private allowed: () => Promise<boolean> = async () => true
  ) {}

  /** `skipped` is set when the engine may not sync right now (see `allowed`). */
  flush(): Promise<{ pushed: number; error?: string; skipped?: boolean }> {
    return this.run(() => this.doFlush())
  }

  /**
   * Pushes first, then merges the server copy (see mergeLibrary). Resolves true when the local
   * library changed. Rejects when the server cannot be read; the local library is then untouched.
   */
  pull(): Promise<boolean> {
    return this.run(async () => {
      if ((await this.doFlush()).skipped) return false
      const remote = await this.remote.pullLibrary()
      // The account may have changed while the request was out: then the answer is not this library's.
      if (!(await this.allowed())) return false
      // Read the local side only now: anything changed while the request was out is pending and wins.
      const plan = mergeLibrary({ playlists: this.lib.allPlaylists(), likes: this.lib.likeEntries() }, remote, this.lib.pendingKeys())
      if (mergeChanges(plan) === 0) return false
      this.lib.applyMerge(plan)
      return true
    })
  }

  /** Runs `op` after every earlier operation; one failure does not stop the queue. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const p = this.queue.then(op)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async doFlush(): Promise<{ pushed: number; error?: string; skipped?: boolean }> {
    let pushed = 0
    if (!(await this.allowed())) return { pushed, skipped: true }
    for (const [i, key] of this.lib.pendingKeys().entries()) {
      // Asked again before each later push: the account can change while one is out.
      if (i > 0 && !(await this.allowed())) return { pushed, skipped: true }
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
      await this.remote.replaceLikes(this.lib.likeEntries())
    }
    // unknown kinds are ignored and cleared by the caller
  }
}
