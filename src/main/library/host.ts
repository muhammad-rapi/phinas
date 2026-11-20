import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { SettingsStore } from '../settings'
import { openDb } from './db'
import { Library } from './library'

/** What signing in as an account does with the library files. */
export type AccountPlan = 'open' | 'claim' | 'create'

/**
 * The account's own file when it has one; otherwise the pre-account library (`phinas.db`) when no
 * account has taken it yet; otherwise a new empty file.
 */
export function planAccount(o: { accountDbExists: boolean; legacyDbExists: boolean; claimedBy: string | null }): AccountPlan {
  if (o.accountDbExists) return 'open'
  if (o.claimedBy === null && o.legacyDbExists) return 'claim'
  return 'create'
}

/** Signed out: the pre-account library while no account has claimed it, otherwise the guest library. */
export function planGuest(claimedBy: string | null): 'legacy' | 'guest' {
  return claimedBy === null ? 'legacy' : 'guest'
}

/** SQLite in WAL mode keeps two side files next to the database. */
const DB_SUFFIXES = ['', '-wal', '-shm']

/** Moves the database with its side files; on failure moves back what already moved, then throws. */
function moveDb(from: string, to: string): void {
  const moved: string[] = []
  try {
    for (const s of DB_SUFFIXES) {
      if (!existsSync(from + s)) continue
      renameSync(from + s, to + s)
      moved.push(s)
    }
  } catch (e) {
    for (const s of moved) {
      try {
        renameSync(to + s, from + s)
      } catch (back) {
        console.error('[library] could not move a file back:', back)
      }
    }
    throw e
  }
}

function removeDb(path: string): void {
  for (const s of DB_SUFFIXES) rmSync(path + s, { force: true })
}

interface Opened {
  lib: Library
  path: string
  owner: string | null
}

export interface LibraryHostOptions<S> {
  /** The user data folder. */
  dir: string
  settings: SettingsStore
  /** The signed-in user at start (from the stored session), or null. */
  userId: string | null
  /**
   * Builds what depends on the library (sync engine, recommender); called again after every switch.
   * `owner` is the account the library belongs to, or null for a signed-out library (never synced).
   */
  build: (lib: Library, owner: string | null) => S
  /** Opens a library file. Tests pass one that fails on purpose. */
  open?: (path: string) => Library
}

/**
 * Owns the active local library. Each account has `libraries/<userId>.db`; signed out uses
 * `phinas.db` until an account claims it, then `libraries/guest.db` (emptied on every sign-out).
 * A switch that fails keeps the previous library and records the error; nothing is deleted.
 */
export class LibraryHost<S> {
  /** Why the last switch failed; null after a successful one. */
  error: string | null = null
  private lib: Library
  private path: string
  private owner: string | null
  private svc: S
  private readonly dir: string
  private readonly settings: SettingsStore
  private readonly build: (lib: Library, owner: string | null) => S
  private readonly open: (path: string) => Library

  constructor(o: LibraryHostOptions<S>) {
    this.dir = o.dir
    this.settings = o.settings
    this.build = o.build
    this.open = o.open ?? ((p) => new Library(openDb(p)))
    let first: Opened
    try {
      first = o.userId ? this.openAccount(o.userId) : this.openGuest(false)
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      console.error('[library] could not open the account library, using the signed-out one:', e)
      first = this.openGuest(false)
    }
    this.lib = first.lib
    this.path = first.path
    this.owner = first.owner
    this.svc = this.build(this.lib, this.owner)
  }

  get library(): Library {
    return this.lib
  }

  get services(): S {
    return this.svc
  }

  /** The account whose library is open, or null for the signed-out one. */
  get userId(): string | null {
    return this.owner
  }

  /** After sign-in or sign-up. True when that account's library is now open. */
  useAccount(uid: string): boolean {
    if (this.owner === uid) return true
    return this.switchTo(() => this.openAccount(uid))
  }

  /** After sign-out or account deletion. */
  useGuest(): boolean {
    return this.switchTo(() => this.openGuest(true))
  }

  close(): void {
    this.lib.close()
  }

  private get legacyPath(): string {
    return join(this.dir, 'phinas.db')
  }

  private get librariesDir(): string {
    return join(this.dir, 'libraries')
  }

  private switchTo(next: () => Opened): boolean {
    const prev = { path: this.path, owner: this.owner }
    this.lib.close()
    let ok = true
    try {
      this.use(next())
      this.error = null
    } catch (e) {
      ok = false
      this.error = e instanceof Error ? e.message : String(e)
      console.error('[library] switch failed, keeping the previous library:', e)
      this.use(this.reopen(prev))
    }
    this.svc = this.build(this.lib, this.owner)
    return ok
  }

  private use(o: Opened): void {
    this.lib = o.lib
    this.path = o.path
    this.owner = o.owner
  }

  /**
   * The previous library again after a failed switch. If even that fails, the signed-out library,
   * and as a last resort an in-memory one, so the handlers keep working.
   */
  private reopen(prev: { path: string; owner: string | null }): Opened {
    try {
      return { lib: this.open(prev.path), path: prev.path, owner: prev.owner }
    } catch (e) {
      console.error('[library] could not reopen the previous library, using the signed-out one:', e)
    }
    try {
      return this.openGuest(false)
    } catch (e) {
      console.error('[library] could not open the signed-out library, using an in-memory one:', e)
    }
    return { lib: new Library(openDb(':memory:')), path: ':memory:', owner: null }
  }

  private openAccount(uid: string): Opened {
    // The id becomes a file name: anything but a plain id could point outside the folder.
    if (!/^[A-Za-z0-9-]+$/.test(uid) || uid === 'guest') throw new Error(`not a user id: ${uid}`)
    mkdirSync(this.librariesDir, { recursive: true })
    const path = join(this.librariesDir, `${uid}.db`)
    const plan = planAccount({
      accountDbExists: existsSync(path),
      legacyDbExists: existsSync(this.legacyPath),
      claimedBy: this.settings.get('claimedBy')
    })
    if (plan !== 'claim') return { lib: this.open(path), path, owner: uid }
    // Recorded before the move: a crash after the move must not leave phinas.db unclaimed (another
    // account could then claim this account's library). Rolled back when the claim fails.
    this.settings.set('claimedBy', uid)
    let lib: Library
    try {
      moveDb(this.legacyPath, path)
      try {
        lib = this.open(path)
      } catch (e) {
        moveDb(path, this.legacyPath)
        throw e
      }
    } catch (e) {
      this.settings.set('claimedBy', null)
      throw e
    }
    return { lib, path, owner: uid }
  }

  private openGuest(fresh: boolean): Opened {
    if (planGuest(this.settings.get('claimedBy')) === 'legacy') {
      return { lib: this.open(this.legacyPath), path: this.legacyPath, owner: null }
    }
    mkdirSync(this.librariesDir, { recursive: true })
    const path = join(this.librariesDir, 'guest.db')
    if (fresh) removeDb(path)
    return { lib: this.open(path), path, owner: null }
  }
}
