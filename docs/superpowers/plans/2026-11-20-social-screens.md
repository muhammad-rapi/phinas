# Social Screens (C2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the multi-user backend of sub-project A its screens in the C1 editorial language (spec `docs/superpowers/specs/2026-11-20-social-screens-design.md`): a welcome screen with sign-up and sign-in, a Teman page (friend code, requests, partner, friends, invites), friend profiles, playlist visibility, public playlists in Jelajah, online awareness in the sidebar and on Beranda, Listen Together with any online friend (one session at a time, a second invite answered "busy"), and a local library that belongs to one account.

**Architecture:** Main process: a `LibraryHost` owns the active SQLite library (`libraries/<userId>.db`, or `phinas.db` / `libraries/guest.db` when signed out) and rebuilds the `SyncEngine` and `Recommender` on every switch; the engine gains `pull()` (push, then merge the server copy with the pure `mergeLibrary`). A `PairHub` replaces the single `PairChannel`: one private `pair:<a>:<b>` channel per online friend who allows Listen Together (pure `channelPlan` decides), and every Listen Together IPC event now carries `friendId`. Renderer: a new `SocialProvider` holds own profile, friends, requests and the online set; `ListenTogetherProvider` keeps one `SyncSession` routed to one friend (pure `routeInvite` decides where an incoming invite goes). Screens are built from the C1 pieces (`CollectionHeader`, `CoverGrid`, `.sec`, `.section-title`, `.label`, `.btn` / `.btn.secondary`, `.text-link`, `.menu`, `.notice`, `.online-dot`) plus a new `styles/social.css`. The session protocol stays at version 1 (`decline` only gains the reason `busy`). Player, lyrics, notch, moods, A's cache/presence/auth and the C1 visuals keep working. All paths are relative to `/Users/mac/Dev/phinas-desktop`; renderer files live under `src/renderer/src/`.

**Tech Stack:** Electron 45 + electron-vite, React 19, TypeScript (`npm run typecheck` = `tsc --noEmit`), `node:sqlite`, `@supabase/supabase-js` 2, lucide-react, plain CSS with the C1 tokens (`--paper`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--online`, `--accent`, `--on-accent`, `--wash`, `--serif`, `--sans`), Vitest (`npm test`, node environment, `tests/**/*.test.ts`). House rules: single quotes, no semicolons, 2-space indent, lines up to 140 columns (except `src/main/sync/supabase-remote.ts`, which keeps its own double-quote/semicolon style); every UI string is Indonesian; use the C1 classes and tokens, no new colours except the request dot; every commit stages **only the files its task names** (never `git add -A` or `git add .`) and ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. There is no UI test framework: UI tasks are checked with typecheck, tests and `npm run build`; the last task is a manual two-account run against the local Supabase stack.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/main/library/merge.ts` | create (Task 1) | `LibrarySnapshot`, `MergePlan`, pure `mergeLibrary`, `mergeChanges` |
| `src/main/library/library.ts` | modify (Task 1) | `allPlaylists()`, `applyMerge(plan)` (no outbox), `close()` |
| `src/main/sync/engine.ts` | modify (Task 1) | `Remote.pullLibrary`, likes pushed with their times, `pull()`, flush and pull serialised |
| `src/main/sync/supabase-remote.ts` | modify (Tasks 1, 6, 9) | `pullLibrary()` (paged table selects under RLS), `replaceLikes` with `liked_at`; drop `pairInfo` and `listPartnerPlaylists` |
| `tests/library-merge.test.ts` | create (Task 1) | merge rules, `applyMerge` |
| `tests/sync-engine.test.ts` | modify (Task 1) | fake remote with a server copy; pull tests |
| `src/main/library/host.ts` | create (Task 2) | `planAccount`, `planGuest`, `LibraryHost` |
| `tests/library-host.test.ts` | create (Task 2) | claim rules, switching with temp folders |
| `src/main/settings.ts` | modify (Task 2) | `claimedBy`, `welcomeDone` |
| `src/main/ipc.ts` | rewrite (Task 2), modify (Tasks 6, 9) | handlers read `host.library`; account switch on sign-in/out; `finishWelcome`; pair hub; `copyFriendPlaylist` |
| `src/main/index.ts` | modify (Tasks 2, 3, 6) | host, start-up pull, 5-minute pull, `PHINAS_PROFILE`, pair hub wiring |
| `src/shared/types.ts` | modify (Tasks 2, 6) | `SyncStatus` flags; Listen Together event types; `ListenInfo` removed |
| `src/shared/ipc.ts` | modify (Tasks 2, 6, 9) | `finishWelcome`; per-friend listen events; `listenOpen`/`listenClose` removed; `copyFriendPlaylist` |
| `src/preload/index.ts` | modify (Task 6) | `listenSend(friendId, msg)` |
| `src/main/sync/realtime.ts` | modify (Task 6) | `close(reason)` |
| `src/main/sync/pair-hub.ts` | create (Task 6) | `channelPlan`, `eligibleFriends`, `PairHub` |
| `tests/pair-hub.test.ts` | create (Task 6) | plan and hub behaviour |
| `src/shared/sync/protocol.ts`, `src/shared/sync/session.ts` | modify (Task 5) | `decline` reason `busy`, end reason `busy` |
| `tests/sync-session.test.ts` | modify (Task 5) | busy decline |
| `src/renderer/src/sync/route.ts` | create (Task 5) | pure `routeInvite` |
| `src/renderer/src/sync/friendTransport.ts` | create (Task 5) | `Transport` for one friend, fed by the provider |
| `tests/listen-route.test.ts`, `tests/friend-transport.test.ts` | create (Task 5) | routing and transport |
| `src/renderer/src/sync/ipcTransport.ts` | delete (Task 6) | replaced by `friendTransport.ts` |
| `src/renderer/src/sync/ListenTogetherProvider.tsx` | rewrite (Task 6) | one session, any friend, busy answers |
| `src/renderer/src/sync/status.ts` | modify (Task 6) | `endedText(reason, name)` |
| `tests/listen-text.test.ts` | create (Task 6) | `endedText` |
| `src/renderer/src/components/ListenTogether.tsx` | rewrite (Tasks 5, 6, 12) | banner (invite from any friend), player-bar button with friend picker |
| `src/renderer/src/components/NowPlaying.tsx` | modify (Task 6) | session block names the active friend |
| `src/renderer/src/social/SocialProvider.tsx` | create (Task 4) | profile, friends, requests, online set, offline flag |
| `src/renderer/src/App.tsx` | modify (Tasks 4, 7, 8, 9, 15) | providers, welcome overlay, routes, server display name |
| `src/renderer/src/components/AuthForm.tsx` | create (Task 7) | shared sign-in / sign-up form, `LegalLinks` |
| `src/renderer/src/screens/Welcome.tsx` | create (Task 7) | first-launch screen |
| `src/renderer/src/styles/social.css` | create (Task 7), append (Tasks 8–14) | welcome, form, Teman, friend profile, sidebar groups, online line, pickers |
| `src/renderer/src/main.tsx` | modify (Task 7) | imports `social.css` |
| `src/renderer/src/social/text.ts` | create (Task 8) | `inviteState`, `inviteText`, `friendStatusText` |
| `tests/social-text.test.ts` | create (Task 8) | invite and status texts |
| `src/renderer/src/screens/FriendsView.tsx` | create (Task 8), modify (Task 9) | Teman page |
| `src/renderer/src/views.ts` | modify (Tasks 8, 9) | `friends`, `friend`, `friendPlaylist` (replaces `together`, `partner`) |
| `src/renderer/src/screens/TogetherView.tsx`, `components/ListenCard.tsx` | modify (Task 6), delete (Task 8) | old Berdua page |
| `src/renderer/src/components/BerduaLine.tsx` | modify (Task 6), delete (Task 11) | replaced by `OnlineLine` |
| `src/renderer/src/social/playlistCache.ts` | create (Task 9) | remembers friends'/public playlists for the playlist view |
| `src/renderer/src/screens/FriendView.tsx` | create (Task 9) | friend profile |
| `src/renderer/src/screens/PartnerView.tsx` → `FriendPlaylistView.tsx` | rename + rewrite (Task 9) | read-only friend/public playlist |
| `src/renderer/src/library/LibraryProvider.tsx` | rewrite (Task 9) | `friends` playlists, refresh on account change |
| `src/renderer/src/screens/Home.tsx` | modify (Tasks 8, 9, 11) | friends' playlists, online line |
| `src/renderer/src/screens/Profile.tsx` | modify (Task 9), rewrite (Task 15) | server name, listen scope, account link to Teman |
| `src/renderer/src/social/lists.ts` | create (Task 10), modify (Task 11) | `onlineFriends`, `groupByOwner`, `onlineLine`, `lineText`, `inviteTarget` |
| `tests/social-lists.test.ts` | create (Task 10), modify (Task 11) | those helpers |
| `src/renderer/src/components/Sidebar.tsx` | modify (Tasks 6, 8, 9), rewrite (Task 10), modify (Task 13) | Teman nav + dot, ONLINE group, DARI TEMAN by owner, visibility icons |
| `src/renderer/src/components/OnlineLine.tsx` | create (Task 11) | Beranda's "Sedang online" / session line |
| `src/renderer/src/components/visibility.ts` | create (Task 13) | visibility options and sidebar icon mapping |
| `tests/visibility.test.ts` | create (Task 13) | mapping |
| `src/renderer/src/components/VisibilityPicker.tsx` | create (Task 13) | PRIBADI / TEMAN / PUBLIK menu |
| `src/renderer/src/components/CollectionHeader.tsx` | modify (Task 13) | `kind` accepts a node |
| `src/renderer/src/screens/PlaylistView.tsx` | modify (Task 13) | visibility picker as the label |
| `src/renderer/src/screens/Explore.tsx` | modify (Task 14) | Playlist publik |
| `src/renderer/src/styles/lists.css` | modify (Task 16) | drop the Berdua card rules |

---

## Task 1: Pull the account's library and merge it

**Files:**
- Create: `src/main/library/merge.ts`
- Create: `tests/library-merge.test.ts`
- Modify: `src/main/library/library.ts`
- Modify: `src/main/sync/engine.ts`
- Modify: `tests/sync-engine.test.ts`
- Modify: `src/main/sync/supabase-remote.ts`

Own rows are readable under the existing RLS policies (`owner_id = auth.uid()` on `playlists`, `playlist_tracks` through its playlist, `liked_tracks`), so the pull uses plain table selects. No migration.

- [ ] **Step 1: Write the failing merge tests**

Create `tests/library-merge.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import { mergeChanges, mergeLibrary, type LibrarySnapshot } from '../src/main/library/merge'
import type { LikeEntry, PlaylistWithTracks, Track } from '../src/shared/types'

const t = (n: number): Track => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `Song ${n}`,
  artist: 'Artist',
  coverUrl: `https://img/${n}.jpg`,
  durationSec: 100 + n
})
const pl = (id: string, updatedAt: number, tracks: Track[] = [], name = id): PlaylistWithTracks => ({
  id,
  name,
  updatedAt,
  visibility: 'friends',
  coverUrls: tracks.slice(0, 4).map((x) => x.coverUrl),
  tracks
})
const like = (n: number, likedAt: number): LikeEntry => ({ ...t(n), likedAt })
const snap = (playlists: PlaylistWithTracks[], likes: LikeEntry[] = []): LibrarySnapshot => ({ playlists, likes })

describe('mergeLibrary', () => {
  test('a playlist only on the server is added', () => {
    const plan = mergeLibrary(snap([]), snap([pl('a', 5)]), [])
    expect(plan.upsert.map((p) => p.id)).toEqual(['a'])
    expect(plan.remove).toEqual([])
  })

  test('the newer copy wins when both sides have the playlist', () => {
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 9, [t(1)])]), []).upsert.map((p) => p.id)).toEqual(['a'])
    expect(mergeLibrary(snap([pl('a', 9)]), snap([pl('a', 5)]), []).upsert).toEqual([])
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 5)]), []).upsert).toEqual([])
  })

  test('a pending local change wins even against a newer server copy', () => {
    expect(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 9)]), ['playlist:a']).upsert).toEqual([])
  })

  test('a local playlist missing on the server is removed unless it is pending', () => {
    expect(mergeLibrary(snap([pl('a', 5), pl('b', 5)]), snap([pl('a', 5)]), []).remove).toEqual(['b'])
    expect(mergeLibrary(snap([pl('b', 5)]), snap([]), ['playlist:b']).remove).toEqual([])
  })

  test('a playlist deleted here but not pushed yet is not brought back', () => {
    expect(mergeLibrary(snap([]), snap([pl('a', 5)]), ['playlist:a']).upsert).toEqual([])
  })

  test('the server likes win unless likes are pending', () => {
    const local = snap([], [like(1, 10)])
    const remote = snap([], [like(2, 20), like(1, 10)])
    expect(mergeLibrary(local, remote, []).likes?.map((l) => l.videoId)).toEqual([t(2).videoId, t(1).videoId])
    expect(mergeLibrary(local, remote, ['likes']).likes).toBeNull()
  })

  test('the same set of likes changes nothing', () => {
    expect(mergeLibrary(snap([], [like(1, 10)]), snap([], [like(1, 99)]), []).likes).toBeNull()
  })

  test('mergeChanges counts what a plan would change', () => {
    expect(mergeChanges(mergeLibrary(snap([pl('a', 5)]), snap([pl('a', 5)]), []))).toBe(0)
    expect(mergeChanges(mergeLibrary(snap([pl('b', 5)]), snap([pl('a', 5)], [like(1, 1)]), []))).toBe(3)
  })
})

describe('Library.applyMerge', () => {
  let lib: Library
  let clock = 1000
  let ids = 0

  beforeEach(() => {
    clock = 1000
    ids = 0
    lib = new Library(openDb(':memory:'), () => clock++, () => `pl-${++ids}`)
  })

  test('writes server playlists and likes without queueing them for upload', () => {
    lib.applyMerge({ upsert: [pl('srv', 50, [t(1), t(2)], 'Dari server')], remove: [], likes: [like(3, 70), like(4, 60)] })
    expect(lib.getPlaylist('srv')).toMatchObject({ name: 'Dari server', updatedAt: 50, visibility: 'friends' })
    expect(lib.getPlaylist('srv')!.tracks.map((x) => x.videoId)).toEqual([t(1).videoId, t(2).videoId])
    expect(lib.likeEntries().map((l) => [l.videoId, l.likedAt])).toEqual([
      [t(3).videoId, 70],
      [t(4).videoId, 60]
    ])
    expect(lib.pendingKeys()).toEqual([])
  })

  test('replaces the tracks of an existing playlist and removes deleted ones', () => {
    const a = lib.createPlaylist('A')
    lib.addTrack(a.id, t(1))
    const b = lib.createPlaylist('B')
    lib.clearKey(`playlist:${a.id}`)
    lib.clearKey(`playlist:${b.id}`)
    lib.applyMerge({ upsert: [{ ...pl(a.id, 99, [t(5)], 'A baru'), visibility: 'public' }], remove: [b.id], likes: null })
    expect(lib.getPlaylist(a.id)).toMatchObject({ name: 'A baru', visibility: 'public', updatedAt: 99 })
    expect(lib.getPlaylist(a.id)!.tracks.map((x) => x.videoId)).toEqual([t(5).videoId])
    expect(lib.getPlaylist(b.id)).toBeNull()
    expect(lib.pendingKeys()).toEqual([])
  })

  test('allPlaylists returns every playlist with its tracks', () => {
    const a = lib.createPlaylist('A')
    lib.addTrack(a.id, t(1))
    expect(lib.allPlaylists().map((p) => [p.id, p.tracks.length])).toEqual([[a.id, 1]])
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/library-merge.test.ts`
Expected: FAIL — `Cannot find module '../src/main/library/merge'`.

- [ ] **Step 3: Write the merge**

Create `src/main/library/merge.ts`:

```ts
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
  const remove = local.playlists.filter((p) => !remoteIds.has(p.id) && !isPending(p.id)).map((p) => p.id)
  const likes = pending.has('likes') || sameLikes(local.likes, remote.likes) ? null : remote.likes
  return { upsert, remove, likes }
}

/** How many things the plan changes (0 = the local library already matches the server). */
export const mergeChanges = (plan: MergePlan): number => plan.upsert.length + plan.remove.length + (plan.likes ? 1 : 0)
```

- [ ] **Step 4: Add `allPlaylists`, `applyMerge` and `close` to the library**

In `src/main/library/library.ts`, replace the import block:

```ts
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { FavoriteArtist, LikeEntry, PlayEntry, Playlist, PlaylistWithTracks, PlayRecord, Track, Visibility } from '../../shared/types'
```

with:

```ts
import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { FavoriteArtist, LikeEntry, PlayEntry, Playlist, PlaylistWithTracks, PlayRecord, Track, Visibility } from '../../shared/types'
import type { MergePlan } from './merge'
```

Then replace the end of the class:

```ts
  clearKey(key: string): void {
    this.db.prepare('DELETE FROM outbox WHERE key = ?').run(key)
  }
}
```

with:

```ts
  clearKey(key: string): void {
    this.db.prepare('DELETE FROM outbox WHERE key = ?').run(key)
  }

  /** Every playlist with its tracks (the local side of a pull). */
  allPlaylists(): PlaylistWithTracks[] {
    return this.listPlaylists()
      .map((p) => this.getPlaylist(p.id))
      .filter((p): p is PlaylistWithTracks => p !== null)
  }

  /** Applies a pull. The changes come from the server, so nothing is queued for upload. */
  applyMerge(plan: MergePlan): void {
    this.tx(() => {
      const upsert = this.db.prepare(
        `INSERT INTO playlists(id, name, updated_at, visibility) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, visibility = excluded.visibility`
      )
      const clear = this.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?')
      const insert = this.db.prepare(
        `INSERT INTO playlist_tracks(playlist_id, position, video_id, title, artist, cover_url, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      for (const p of plan.upsert) {
        upsert.run(p.id, p.name, p.updatedAt, p.visibility)
        clear.run(p.id)
        p.tracks.forEach((x, i) => insert.run(p.id, i, x.videoId, x.title, x.artist, x.coverUrl, x.durationSec))
      }
      const remove = this.db.prepare('DELETE FROM playlists WHERE id = ?')
      for (const id of plan.remove) remove.run(id)
      if (plan.likes) {
        this.db.exec('DELETE FROM liked_tracks')
        const like = this.db.prepare(
          `INSERT OR REPLACE INTO liked_tracks(video_id, title, artist, cover_url, duration_sec, liked_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        for (const l of plan.likes) like.run(l.videoId, l.title, l.artist, l.coverUrl, l.durationSec, l.likedAt)
      }
    })
  }

  /** Closes the database file (before another account's library opens). */
  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 5: Run the merge tests**

Run: `npx vitest run tests/library-merge.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Update the engine tests (failing first)**

Replace the whole of `tests/sync-engine.test.ts` with:

```ts
import { beforeEach, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import type { LibrarySnapshot } from '../src/main/library/merge'
import { SyncEngine, type Remote } from '../src/main/sync/engine'
import type { LikeEntry, PlaylistWithTracks, Track } from '../src/shared/types'

const track: Track = { videoId: 'video000001', title: 'S', artist: 'A', coverUrl: '', durationSec: 1 }

/** Keeps a server copy like Supabase would: pushes land in it, pulls read it. */
class FakeRemote implements Remote {
  upserts: PlaylistWithTracks[] = []
  deletes: string[] = []
  likes: LikeEntry[][] = []
  server: LibrarySnapshot = { playlists: [], likes: [] }
  failNext = false
  private maybeFail(): void {
    if (this.failNext) {
      this.failNext = false
      throw new Error('offline')
    }
  }
  async upsertPlaylist(p: PlaylistWithTracks): Promise<void> {
    this.maybeFail()
    this.upserts.push(p)
    this.server.playlists = [...this.server.playlists.filter((x) => x.id !== p.id), p]
  }
  async deletePlaylist(id: string): Promise<void> {
    this.maybeFail()
    this.deletes.push(id)
    this.server.playlists = this.server.playlists.filter((x) => x.id !== id)
  }
  async replaceLikes(l: LikeEntry[]): Promise<void> {
    this.maybeFail()
    this.likes.push(l)
    this.server.likes = l
  }
  async pullLibrary(): Promise<LibrarySnapshot> {
    this.maybeFail()
    return structuredClone(this.server)
  }
}

let lib: Library
let remote: FakeRemote
let engine: SyncEngine
let n = 0

beforeEach(() => {
  n = 0
  lib = new Library(openDb(':memory:'), () => 1000 + n, () => `pl-${++n}`)
  remote = new FakeRemote()
  engine = new SyncEngine(lib, remote)
})

test('flush pushes changed playlists and clears the outbox', async () => {
  const p = lib.createPlaylist('P')
  lib.addTrack(p.id, track)
  const r = await engine.flush()
  expect(r).toEqual({ pushed: 1 })
  expect(remote.upserts).toHaveLength(1)
  expect(remote.upserts[0].tracks).toHaveLength(1)
  expect(lib.pendingKeys()).toEqual([])
})

test('a playlist deleted locally is deleted remotely', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  lib.deletePlaylist(p.id)
  await engine.flush()
  expect(remote.deletes).toEqual([p.id])
})

test('likes are replaced as a whole list, with their like times', async () => {
  lib.setLiked(track, true)
  await engine.flush()
  expect(remote.likes).toEqual([[{ ...track, likedAt: 1000 }]])
})

test('on failure the key stays queued and flush reports the error', async () => {
  const p = lib.createPlaylist('P')
  remote.failNext = true
  const r = await engine.flush()
  expect(r.error).toBe('offline')
  expect(lib.pendingKeys()).toEqual([`playlist:${p.id}`])
  expect(await engine.flush()).toEqual({ pushed: 1 })
})

test('unknown outbox keys are dropped', async () => {
  ;(lib as unknown as { enqueue(k: string): void }).enqueue('mystery:1')
  expect(await engine.flush()).toEqual({ pushed: 1 })
  expect(lib.pendingKeys()).toEqual([])
})

test('pull pushes pending changes first, then adds what only the server has', async () => {
  const p = lib.createPlaylist('Lokal')
  remote.server.playlists.push({ id: 'srv', name: 'Server', updatedAt: 5, visibility: 'friends', coverUrls: [], tracks: [track] })
  expect(await engine.pull()).toBe(true)
  expect(remote.upserts.map((x) => x.id)).toEqual([p.id])
  expect(lib.listPlaylists().map((x) => x.name).sort()).toEqual(['Lokal', 'Server'])
  expect(lib.getPlaylist('srv')!.tracks).toEqual([track])
  expect(lib.pendingKeys()).toEqual([])
})

test('a playlist deleted on another computer is removed here', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  remote.server.playlists = []
  expect(await engine.pull()).toBe(true)
  expect(lib.getPlaylist(p.id)).toBeNull()
})

test('a pull with nothing new reports no change', async () => {
  lib.createPlaylist('P')
  await engine.pull()
  expect(await engine.pull()).toBe(false)
})

test('a failed pull leaves the library as it was', async () => {
  const p = lib.createPlaylist('P')
  await engine.flush()
  remote.server.playlists = []
  remote.failNext = true
  await expect(engine.pull()).rejects.toThrow('offline')
  expect(lib.getPlaylist(p.id)).not.toBeNull()
})
```

Run: `npx vitest run tests/sync-engine.test.ts`
Expected: FAIL — the pull tests fail with `engine.pull is not a function` and the likes test fails (`likedAt` missing). (Vitest does not typecheck, so the type errors only show in `npm run typecheck`.)

- [ ] **Step 7: Rewrite the engine**

Replace the whole of `src/main/sync/engine.ts` with:

```ts
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

/**
 * Pushes the outbox and pulls the account's library. Flush and pull never overlap: a pull that read
 * the server before a push finished could otherwise delete a playlist that was just uploaded.
 */
export class SyncEngine {
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private lib: Library,
    private remote: Remote
  ) {}

  flush(): Promise<{ pushed: number; error?: string }> {
    return this.run(() => this.doFlush())
  }

  /**
   * Pushes first, then merges the server copy (see mergeLibrary). Resolves true when the local
   * library changed. Rejects when the server cannot be read; the local library is then untouched.
   */
  pull(): Promise<boolean> {
    return this.run(async () => {
      await this.doFlush()
      const remote = await this.remote.pullLibrary()
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

  private async doFlush(): Promise<{ pushed: number; error?: string }> {
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
      await this.remote.replaceLikes(this.lib.likeEntries())
    }
    // unknown kinds are ignored and cleared by the caller
  }
}
```

- [ ] **Step 8: Teach the Supabase remote to pull, and to keep like times**

In `src/main/sync/supabase-remote.ts` (this file uses double quotes and semicolons; keep that):

Replace:

```ts
import type {
  AppConfig,
  Friend,
  FriendRequest,
  InviteCode,
  ListenInfo,
  ListenScope,
  MyProfile,
  PartnerPlaylist,
  PlaylistWithTracks,
  SignUpInput,
  Track,
  Visibility,
} from "../../shared/types";
import type { Remote } from "./engine";
import { FileStorage } from "./file-storage";
```

with:

```ts
import type {
  AppConfig,
  Friend,
  FriendRequest,
  InviteCode,
  LikeEntry,
  ListenInfo,
  ListenScope,
  MyProfile,
  PartnerPlaylist,
  PlaylistWithTracks,
  SignUpInput,
  Track,
  Visibility,
} from "../../shared/types";
import type { LibrarySnapshot } from "../library/merge";
import type { Remote } from "./engine";
import { FileStorage } from "./file-storage";

/** PostgREST returns at most this many rows per request (`max_rows` in supabase/config.toml). */
const PAGE = 1000;
```

Replace:

```ts
  async replaceLikes(tracks: Track[]): Promise<void> {
    const me = await this.userId();
    check(await this.sb.from("liked_tracks").delete().eq("owner_id", me));
    if (tracks.length)
      check(await this.sb.from("liked_tracks").insert(tracks.map(toRow)));
  }
```

with:

```ts
  async replaceLikes(likes: LikeEntry[]): Promise<void> {
    const me = await this.userId();
    check(await this.sb.from("liked_tracks").delete().eq("owner_id", me));
    if (likes.length)
      check(
        await this.sb.from("liked_tracks").insert(
          likes.map((l) => ({
            ...toRow(l),
            liked_at: new Date(l.likedAt).toISOString(),
          })),
        ),
      );
  }

  /** Every row of a query, a page at a time. `page` must order the rows by a unique key. */
  private async allRows<T>(
    page: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await page(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const got = (data ?? []) as T[];
      rows.push(...got);
      if (got.length < PAGE) return rows;
    }
  }

  /** The account's own playlists (with tracks) and likes. Own rows are readable under RLS. */
  async pullLibrary(): Promise<LibrarySnapshot> {
    const me = await this.userId();
    // A disabled account reads nothing under RLS; merging that empty answer would delete this
    // computer's playlists. my_profile() still answers for a disabled account.
    if ((await this.myProfile()).disabled) throw new Error("phinas:account_disabled");
    const lists = await this.allRows<{
      id: string;
      name: string;
      updated_at: string;
      visibility: Visibility;
    }>((from, to) =>
      this.sb
        .from("playlists")
        .select("id, name, updated_at, visibility")
        .eq("owner_id", me)
        .order("id")
        .range(from, to),
    );
    const ids = lists.map((p) => p.id);
    const tracks: (TrackRow & { playlist_id: string })[] = [];
    // Chunks keep the `in (...)` filter inside the URL length limit.
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      tracks.push(
        ...(await this.allRows<TrackRow & { playlist_id: string }>(
          (from, to) =>
            this.sb
              .from("playlist_tracks")
              .select(
                "playlist_id, position, video_id, title, artist, cover_url, duration_sec",
              )
              .in("playlist_id", chunk)
              .order("playlist_id")
              .order("position")
              .range(from, to),
        )),
      );
    }
    const byPlaylist = new Map<string, Track[]>();
    for (const r of tracks) {
      const list = byPlaylist.get(r.playlist_id) ?? [];
      list.push(fromRow(r));
      byPlaylist.set(r.playlist_id, list);
    }
    const likes = await this.allRows<TrackRow & { liked_at: string }>(
      (from, to) =>
        this.sb
          .from("liked_tracks")
          .select("video_id, title, artist, cover_url, duration_sec, liked_at")
          .eq("owner_id", me)
          .order("video_id")
          .range(from, to),
    );
    return {
      playlists: lists.map((p) => {
        const list = byPlaylist.get(p.id) ?? [];
        return {
          id: p.id,
          name: p.name,
          updatedAt: new Date(p.updated_at).getTime(),
          visibility: p.visibility,
          coverUrls: list
            .slice(0, 4)
            .map((t) => t.coverUrl)
            .filter(Boolean),
          tracks: list,
        };
      }),
      likes: likes
        .map((l) => ({ ...fromRow(l), likedAt: new Date(l.liked_at).getTime() }))
        .sort((a, b) => b.likedAt - a.likedAt),
    };
  }
```

(`ListenInfo` and `pairInfo` stay for now; Task 6 removes them.)

- [ ] **Step 9: Run everything**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all files pass, including `tests/library-merge.test.ts` and the 9 tests in `tests/sync-engine.test.ts`.

Run: `npm run build`
Expected: builds `out/main`, `out/preload`, `out/renderer` without errors.

- [ ] **Step 10: Commit**

```bash
git add src/main/library/merge.ts src/main/library/library.ts src/main/sync/engine.ts src/main/sync/supabase-remote.ts tests/library-merge.test.ts tests/sync-engine.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): pull the account's playlists and likes and merge them locally

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: One local library per account

**Files:**
- Create: `src/main/library/host.ts`
- Create: `tests/library-host.test.ts`
- Modify: `src/main/settings.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`
- Rewrite: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

Rules (spec §3): `libraries/<userId>.db` per account; signed out uses `phinas.db` until an account claims it (`settings.claimedBy`), then `libraries/guest.db`, emptied on every sign-out. A switch that fails keeps the previous library and records the error for Profil.

- [ ] **Step 1: Settings gain `claimedBy` and `welcomeDone`**

In `src/main/settings.ts`, replace:

```ts
export interface Settings {
  notch: boolean
}

const DEFAULTS: Settings = { notch: true }
```

with:

```ts
export interface Settings {
  notch: boolean
  /** The account that took the pre-account library (`phinas.db`), or null while none has. */
  claimedBy: string | null
  /** The welcome screen was answered: signed in once, or chose "Pakai tanpa akun". */
  welcomeDone: boolean
}

const DEFAULTS: Settings = { notch: true, claimedBy: null, welcomeDone: false }
```

- [ ] **Step 2: Write the failing host tests**

Create `tests/library-host.test.ts`:

```ts
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { LibraryHost, planAccount, planGuest } from '../src/main/library/host'
import { Library } from '../src/main/library/library'
import { SettingsStore } from '../src/main/settings'

describe('claim rules', () => {
  test('an account with its own file opens it', () => {
    expect(planAccount({ accountDbExists: true, legacyDbExists: true, claimedBy: null })).toBe('open')
  })
  test('the first account to sign in claims the pre-account library', () => {
    expect(planAccount({ accountDbExists: false, legacyDbExists: true, claimedBy: null })).toBe('claim')
  })
  test('any later account starts empty', () => {
    expect(planAccount({ accountDbExists: false, legacyDbExists: true, claimedBy: 'u1' })).toBe('create')
    expect(planAccount({ accountDbExists: false, legacyDbExists: false, claimedBy: null })).toBe('create')
  })
  test('signed out uses the pre-account library until it is claimed', () => {
    expect(planGuest(null)).toBe('legacy')
    expect(planGuest('u1')).toBe('guest')
  })
})

describe('LibraryHost', () => {
  let dir: string
  let settings: SettingsStore
  let hosts: LibraryHost<number>[]
  let builds = 0

  const host = (userId: string | null, open?: (path: string) => Library): LibraryHost<number> => {
    const h = new LibraryHost({ dir, settings, userId, build: () => ++builds, open })
    hosts.push(h)
    return h
  }
  const names = (h: LibraryHost<number>): string[] => h.library.listPlaylists().map((p) => p.name).sort()
  const seedLegacy = (name: string): void => {
    const lib = new Library(openDb(join(dir, 'phinas.db')))
    lib.createPlaylist(name)
    lib.close()
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'phinas-host-'))
    settings = new SettingsStore(join(dir, 'settings.json'))
    hosts = []
    builds = 0
  })

  afterEach(() => {
    for (const h of hosts) {
      try {
        h.close()
      } catch {
        // already closed
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })

  test('the first sign-in claims the pre-account library', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    expect(h.useAccount('u1')).toBe(true)
    expect(names(h)).toEqual(['Lama'])
    expect(existsSync(join(dir, 'phinas.db'))).toBe(false)
    expect(existsSync(join(dir, 'libraries', 'u1.db'))).toBe(true)
    expect(settings.get('claimedBy')).toBe('u1')
    expect(h.userId).toBe('u1')
  })

  test('a second account starts empty, and each account keeps its own library', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    h.useAccount('u1')
    h.useAccount('u2')
    expect(names(h)).toEqual([])
    h.library.createPlaylist('Punya u2')
    h.useAccount('u1')
    expect(names(h)).toEqual(['Lama'])
    h.useAccount('u2')
    expect(names(h)).toEqual(['Punya u2'])
  })

  test('after a claim, signing out gives an empty guest library, emptied again on the next sign-out', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    h.useAccount('u1')
    h.useGuest()
    expect(h.userId).toBeNull()
    expect(names(h)).toEqual([])
    h.library.createPlaylist('Tamu')
    h.useAccount('u1')
    h.useGuest()
    expect(names(h)).toEqual([])
  })

  test('without a claim, signing out returns to the pre-account library', () => {
    seedLegacy('Lama')
    mkdirSync(join(dir, 'libraries'))
    new Library(openDb(join(dir, 'libraries', 'u1.db'))).close()
    const h = host('u1')
    expect(names(h)).toEqual([])
    expect(settings.get('claimedBy')).toBeNull()
    h.useGuest()
    expect(names(h)).toEqual(['Lama'])
  })

  test('starting signed in claims the pre-account library too', () => {
    seedLegacy('Lama')
    const h = host('u1')
    expect(names(h)).toEqual(['Lama'])
    expect(settings.get('claimedBy')).toBe('u1')
  })

  test('a failed switch keeps the previous library and records why', () => {
    const open = (path: string): Library => {
      if (path.endsWith('u2.db')) throw new Error('disk full')
      return new Library(openDb(path))
    }
    const h = host('u1', open)
    h.library.createPlaylist('Punya u1')
    expect(h.useAccount('u2')).toBe(false)
    expect(h.error).toBe('disk full')
    expect(h.userId).toBe('u1')
    expect(names(h)).toEqual(['Punya u1'])
    expect(h.useGuest()).toBe(true)
    expect(h.error).toBeNull()
  })

  test('a user id that is not an id is refused', () => {
    const h = host(null)
    expect(h.useAccount('../escape')).toBe(false)
    expect(h.userId).toBeNull()
  })

  test('the services are rebuilt for every library that opens', () => {
    const h = host(null)
    expect(h.services).toBe(1)
    h.useAccount('u1')
    expect(h.services).toBe(2)
    h.useAccount('u1')
    expect(h.services).toBe(2)
  })
})
```

Run: `npx vitest run tests/library-host.test.ts`
Expected: FAIL — `Cannot find module '../src/main/library/host'`.

- [ ] **Step 3: Write the host**

Create `src/main/library/host.ts`:

```ts
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

function moveDb(from: string, to: string): void {
  for (const s of DB_SUFFIXES) if (existsSync(from + s)) renameSync(from + s, to + s)
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
  /** Builds what depends on the library (sync engine, recommender); called again after every switch. */
  build: (lib: Library) => S
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
  private readonly build: (lib: Library) => S
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
    this.svc = this.build(this.lib)
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
    const prevPath = this.path
    this.lib.close()
    let ok = true
    try {
      const n = next()
      this.lib = n.lib
      this.path = n.path
      this.owner = n.owner
      this.error = null
    } catch (e) {
      ok = false
      this.error = e instanceof Error ? e.message : String(e)
      console.error('[library] switch failed, keeping the previous library:', e)
      this.lib = this.open(prevPath)
    }
    this.svc = this.build(this.lib)
    return ok
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
    moveDb(this.legacyPath, path)
    let lib: Library
    try {
      lib = this.open(path)
    } catch (e) {
      moveDb(path, this.legacyPath)
      throw e
    }
    this.settings.set('claimedBy', uid)
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
```

Run: `npx vitest run tests/library-host.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 4: `SyncStatus` and `finishWelcome` in the shared types**

In `src/shared/types.ts`, replace:

```ts
export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email?: string
  pending: number
  lastError?: string
}
```

with:

```ts
export interface SyncStatus {
  configured: boolean
  signedIn: boolean
  email?: string
  pending: number
  lastError?: string
  /** The welcome screen was answered on this computer. */
  welcomeDone: boolean
  /** An account took this computer's pre-account library, so signed out shows an empty one. */
  libraryClaimed: boolean
  /** Why the last library switch failed; the previous library stayed open. */
  libraryError?: string
}
```

In `src/shared/ipc.ts`, replace:

```ts
  /** Opens the terms or privacy page in the browser. */
  openLegal(page: LegalPage): Promise<void>
```

with:

```ts
  /** Opens the terms or privacy page in the browser. */
  openLegal(page: LegalPage): Promise<void>
  /** The welcome screen was answered with "Pakai tanpa akun". */
  finishWelcome(): Promise<void>
```

and in `CHANNEL_MAP` replace:

```ts
  openLegal: true,
```

with:

```ts
  openLegal: true,
  finishWelcome: true,
```

- [ ] **Step 5: Handlers read the host**

Replace the whole of `src/main/ipc.ts` with:

```ts
import type { PhinasApi } from '../shared/ipc'
import type { Lyrics } from '../shared/types'
import { matchSongs } from './import/match'
import { fetchSpotifyList } from './import/spotify'
import type { LibraryHost } from './library/host'
import { fetchLyrics } from './music/lyrics'
import type { MusicSource } from './music/source'
import type { SyncEngine } from './sync/engine'
import type { SupabaseRemote } from './sync/supabase-remote'
import type { PairChannel } from './sync/realtime'
import type { SystemVolume } from './system-volume'
import type { Recommender } from './recommend/service'
import type { SettingsStore } from './settings'
import type { Updater } from './updater'
import { LEGAL_URLS } from '../shared/links'
import { withCache, type CacheStore } from './sync/cache'
import type { PresenceHub } from './sync/presence'

/** What depends on the active library; the host rebuilds it whenever another library opens. */
export interface LibraryServices {
  engine: SyncEngine | null
  recommender: Recommender
}

export interface Deps {
  /** The active local library (one per account) with its sync engine and recommender. */
  host: LibraryHost<LibraryServices>
  source: MusicSource
  coverData: (url: string) => Promise<string>
  systemVolume: SystemVolume
  proxyPort: () => number
  remote: SupabaseRemote | null
  /** Realtime channel for listen together; null when Supabase is not configured. */
  pair: PairChannel | null
  /** Friends' online state; null when Supabase is not configured. */
  presence: PresenceHub | null
  cache: CacheStore
  openExternal: (url: string) => void
  /** Tells the renderer the signed-in account changed (sign-in, sign-up, sign-out, deletion). */
  notifyAccountChanged: () => void
  /** Pushes, then pulls the account's library from the server. Never throws. */
  pullLibrary: () => Promise<void>
  lastError: { value?: string }
  settings: SettingsStore
  /** Shows or hides the notch window right away. */
  setNotchEnabled: (enabled: boolean) => void
  updater: Updater
}

export function createHandlers(d: Deps): PhinasApi {
  const requireRemote = (): SupabaseRemote => {
    if (!d.remote) throw new Error('Supabase belum dikonfigurasi (.env)')
    return d.remote
  }

  /** The remote and the signed-in user's id, or null when signed out or not configured. */
  const signedIn = async (): Promise<{ r: SupabaseRemote; uid: string } | null> => {
    if (!d.remote) return null
    // From the stored session, not the network, so the cache still works offline.
    const s = await d.remote.session()
    return s ? { r: d.remote, uid: s.userId } : null
  }

  /** Leaves every realtime channel and forgets cached social data. */
  const leaveAll = async (): Promise<void> => {
    await d.pair?.close()
    await d.presence?.close()
    d.cache.clear()
  }

  /** After sign-in or sign-up: open that account's library, pull it, then tell the renderer. */
  const enterAccount = async (r: SupabaseRemote): Promise<void> => {
    const s = await r.session()
    if (s) d.host.useAccount(s.userId)
    d.settings.set('welcomeDone', true)
    d.lastError.value = undefined
    await d.pullLibrary()
    d.notifyAccountChanged()
  }

  /** After sign-out or account deletion: back to the signed-out library. */
  const leaveAccount = (): void => {
    d.host.useGuest()
    d.lastError.value = undefined
    d.notifyAccountChanged()
  }

  // Answers (including "no lyrics") are cached for the session; network failures are not.
  const lyricsCache = new Map<string, Lyrics | null>()

  return {
    getLyrics: async (track) => {
      if (lyricsCache.has(track.videoId)) return lyricsCache.get(track.videoId) ?? null
      const found = await fetchLyrics(track)
      lyricsCache.set(track.videoId, found)
      return found
    },
    importSpotify: async (link) => {
      const list = await fetchSpotifyList(link)
      const { matched, missing } = await matchSongs(list.songs, (q) => d.source.search(q))
      return { name: list.name, total: list.songs.length, matched, missing }
    },
    search: (q) => d.source.search(q),
    getHomeFeed: () => d.source.getHomeFeed(),
    searchPlaylists: (q) => d.source.searchPlaylists(q),
    getPublicPlaylist: (id) => d.source.getPublicPlaylist(id),
    getUpdateStatus: async () => d.updater.status(),
    checkForUpdate: () => d.updater.check(),
    installUpdate: async () => d.updater.install(),
    getArtist: (name) => d.source.getArtist(name),
    getArtistSongs: (id) => d.source.getArtistSongs(id),
    getAlbum: (id) => d.source.getAlbum(id),
    getGenre: (params) => d.source.getGenre(params),
    streamUrl: async (id) => `http://127.0.0.1:${d.proxyPort()}/stream/${id}`,
    coverData: (url) => d.coverData(url),
    getSystemVolume: () => d.systemVolume.get(),
    setSystemVolume: (level) => d.systemVolume.set(level),
    listPlaylists: async () => d.host.library.listPlaylists(),
    getPlaylist: async (id) => d.host.library.getPlaylist(id),
    createPlaylist: async (name) => d.host.library.createPlaylist(name),
    renamePlaylist: async (id, name) => d.host.library.renamePlaylist(id, name),
    deletePlaylist: async (id) => d.host.library.deletePlaylist(id),
    addTrack: async (pid, t) => d.host.library.addTrack(pid, t),
    removeTrack: async (pid, vid) => d.host.library.removeTrack(pid, vid),
    listLikes: async () => d.host.library.listLikes(),
    setLiked: async (t, liked) => d.host.library.setLiked(t, liked),
    syncSignIn: async (email, password) => {
      const r = requireRemote()
      d.cache.clear()
      await r.signIn(email, password)
      await enterAccount(r)
    },
    syncSignOut: async () => {
      await leaveAll()
      await requireRemote().signOut()
      leaveAccount()
    },
    syncSignUp: async (input) => {
      const r = requireRemote()
      d.cache.clear()
      await r.signUp(input)
      await enterAccount(r)
    },
    myProfile: async () => {
      const s = await signedIn()
      return s ? withCache(d.cache, s.uid, 'profile', () => s.r.myProfile()) : null
    },
    updateMyProfile: async (name, scope) => {
      await requireRemote().updateMyProfile(name, scope)
      const s = await signedIn()
      if (s) await withCache(d.cache, s.uid, 'profile', () => s.r.myProfile())
    },
    getConfig: async () => {
      const s = await signedIn()
      return s ? withCache(d.cache, s.uid, 'config', () => s.r.getConfig()) : null
    },
    listFriends: async () => {
      const s = await signedIn()
      if (!s) return []
      const friends = await withCache(d.cache, s.uid, 'friends', () => s.r.listFriends())
      void d.presence
        ?.sync(s.uid, friends.map((f) => f.userId))
        .catch((e) => console.warn('[presence] sync failed:', e))
      return friends
    },
    listFriendRequests: () => requireRemote().listFriendRequests(),
    sendFriendRequest: (code) => requireRemote().sendFriendRequest(code),
    respondFriendRequest: (id, accept) => requireRemote().respondFriendRequest(id, accept),
    removeFriend: (id) => requireRemote().removeFriend(id),
    requestPartner: (id) => requireRemote().requestPartner(id),
    respondPartner: (id, accept) => requireRemote().respondPartner(id, accept),
    endPartner: (id) => requireRemote().endPartner(id),
    listMyInvites: () => requireRemote().listMyInvites(),
    createInvite: () => requireRemote().createInvite(),
    revokeInvite: (code) => requireRemote().revokeInvite(code),
    deleteAccount: async () => {
      await requireRemote().deleteAccount()
      await leaveAll()
      leaveAccount()
    },
    onlineFriends: async () => d.presence?.onlineIds() ?? [],
    setPlaylistVisibility: async (id, v) => d.host.library.setVisibility(id, v),
    listFriendPlaylists: (friendId) => requireRemote().listFriendPlaylists(friendId),
    listPublicPlaylists: () => requireRemote().listPublicPlaylists(),
    openLegal: async (page) => {
      if (!Object.hasOwn(LEGAL_URLS, page)) return
      d.openExternal(LEGAL_URLS[page])
    },
    finishWelcome: async () => d.settings.set('welcomeDone', true),
    syncStatus: async () => {
      const session = d.remote ? await d.remote.session() : null
      return {
        configured: d.remote !== null,
        signedIn: session !== null,
        email: session?.email,
        pending: d.host.library.pendingKeys().length,
        lastError: d.lastError.value,
        welcomeDone: d.settings.get('welcomeDone'),
        libraryClaimed: d.settings.get('claimedBy') !== null,
        libraryError: d.host.error ?? undefined
      }
    },
    listPartnerPlaylists: async () => requireRemote().listPartnerPlaylists(),
    recordPlay: async (rec) => {
      // History must never break playback.
      try {
        d.host.library.recordPlay(rec)
      } catch (e) {
        console.error('could not record play:', e)
      }
    },
    listRecentPlays: async (limit = 50) => d.host.library.recentPlays(Math.min(limit, 50)),
    listFavoriteArtists: async (limit = 8) => d.host.library.favoriteArtists(Math.min(limit, 12)),
    getRecommendations: () => d.host.services.recommender.forHome(),
    getAutoplay: (current, queueIds) => d.host.services.recommender.autoplay(current, queueIds),
    getNotchEnabled: async () => d.settings.get('notch'),
    setNotchEnabled: async (enabled) => {
      d.settings.set('notch', enabled)
      d.setNotchEnabled(enabled)
    },
    listenOpen: async () => {
      if (!d.remote || !d.pair) return null
      try {
        const info = await d.remote.pairInfo()
        if (!info) return null
        await d.pair.open(info.me, info.partnerId)
        return info
      } catch (e) {
        console.warn('[listen] could not open the channel:', e)
        return null
      }
    },
    listenClose: async () => d.pair?.close(),
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false, notAllowed: false },
    copyPartnerPlaylist: async (p) => {
      const lib = d.host.library
      const copy = lib.createPlaylist(`${p.name} (dari ${p.ownerName})`)
      for (const t of p.tracks) lib.addTrack(copy.id, t)
      return lib.getPlaylist(copy.id)!
    }
  }
}
```

- [ ] **Step 6: Build the host in the main process**

In `src/main/index.ts` make these replacements, in order.

Replace:

```ts
import { createHandlers } from './ipc'
import { openDb } from './library/db'
import { Library } from './library/library'
```

with:

```ts
import { createHandlers, type LibraryServices } from './ipc'
import { LibraryHost } from './library/host'
```

Replace:

```ts
const SYNC_INTERVAL_MS = 15_000
```

with:

```ts
const SYNC_INTERVAL_MS = 15_000
/** The account's library is pulled from the server every 20 sync ticks (5 minutes). */
const PULL_EVERY_TICKS = 20
```

Replace:

```ts
  const userData = app.getPath('userData')
  const library = new Library(openDb(join(userData, 'phinas.db')))
  const source = new YoutubeMusicSource(app.getLocaleCountryCode() || undefined)
```

with:

```ts
  const userData = app.getPath('userData')
  const settings = new SettingsStore(join(userData, 'settings.json'))
  const source = new YoutubeMusicSource(app.getLocaleCountryCode() || undefined)
```

Replace:

```ts
  const remote = url && key ? new SupabaseRemote(url, key, join(userData, 'session.json')) : null
  const engine = remote ? new SyncEngine(library, remote) : null
  const lastError: { value?: string } = {}

  const settings = new SettingsStore(join(userData, 'settings.json'))
  const recommender = new Recommender(library, source)
  let mainWindow: BrowserWindow | null = null
```

with:

```ts
  const remote = url && key ? new SupabaseRemote(url, key, join(userData, 'session.json')) : null
  // From the stored session (no network), so the right library opens offline too.
  const signedInAs = remote ? await remote.session().catch(() => null) : null
  // Someone already signed in on this computer has answered the welcome screen.
  if (signedInAs && !settings.get('welcomeDone')) settings.set('welcomeDone', true)
  const host = new LibraryHost<LibraryServices>({
    dir: userData,
    settings,
    userId: signedInAs?.userId ?? null,
    build: (lib) => ({ engine: remote ? new SyncEngine(lib, remote) : null, recommender: new Recommender(lib, source) })
  })
  const lastError: { value?: string } = {}

  let mainWindow: BrowserWindow | null = null
```

Replace:

```ts
  const cache = new CacheStore(join(userData, 'social-cache.json'))
```

with:

```ts
  const cache = new CacheStore(join(userData, 'social-cache.json'))

  /** Pushes, then pulls the account's library; a change reloads the renderer's copy. Never throws. */
  const pullLibrary = async (): Promise<void> => {
    const engine = host.services.engine
    if (!engine || !remote || !(await remote.session())) return
    try {
      if (await engine.pull()) mainWindow?.webContents.send('library:changed')
    } catch (e) {
      console.warn('[sync] pull failed, will retry:', e)
    }
  }
```

Replace:

```ts
  const handlers = createHandlers({
    library,
    source,
```

with:

```ts
  const handlers = createHandlers({
    host,
    source,
```

Replace:

```ts
    notifyAccountChanged: () => mainWindow?.webContents.send('account:changed'),
    engine,
    lastError,
    recommender,
    settings,
```

with:

```ts
    notifyAccountChanged: () => mainWindow?.webContents.send('account:changed'),
    pullLibrary,
    lastError,
    settings,
```

Replace:

```ts
  if (engine && remote) {
    let tick = 0
    setInterval(async () => {
      if (!(await remote.session())) return
      const r = await engine.flush()
      lastError.value = r.error
      // Every minute: refresh friends (keeps presence in step) and leave a pair that is no longer allowed.
      if (tick++ % 4 === 0) {
        const friends = await handlers.listFriends().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
        if (friends instanceof Error && friends.message.includes('phinas:account_disabled')) {
          // A disabled account may not listen together or show as online.
          await pair?.close()
          await presence?.close()
        } else if (!(friends instanceof Error) && !friends.some((f) => f.isPartner && f.canListen)) {
          await pair?.close()
        }
      }
    }, SYNC_INTERVAL_MS)
  }
```

with:

```ts
  if (remote) {
    let tick = 0
    setInterval(async () => {
      try {
        if (!(await remote.session())) return
        const n = tick++
        // Read the engine each time: the host rebuilds it when another account's library opens.
        const engine = host.services.engine
        if (engine) lastError.value = (await engine.flush()).error
        if (n % PULL_EVERY_TICKS === PULL_EVERY_TICKS - 1) await pullLibrary()
        // Every minute: refresh friends (keeps presence in step) and leave a pair that is no longer allowed.
        if (n % 4 === 0) {
          const friends = await handlers.listFriends().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
          if (friends instanceof Error && friends.message.includes('phinas:account_disabled')) {
            // A disabled account may not listen together or show as online.
            await pair?.close()
            await presence?.close()
          } else if (!(friends instanceof Error) && !friends.some((f) => f.isPartner && f.canListen)) {
            await pair?.close()
          }
        }
      } catch (e) {
        console.warn('[sync] tick failed:', e)
      }
    }, SYNC_INTERVAL_MS)
  }
```

Replace:

```ts
  mainWindow = createWindow()
```

with:

```ts
  mainWindow = createWindow()
  // At start, signed in: bring in what changed on other computers.
  void pullLibrary()
```

- [ ] **Step 7: Run everything**

Run: `npm run typecheck`
Expected: no errors. Then `grep -n "openDb\|new Library" src/main/index.ts` prints nothing (the host opens libraries now).

Run: `npm test`
Expected: all pass.

Run: `npm run build`
Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/main/library/host.ts tests/library-host.test.ts src/main/settings.ts src/shared/types.ts src/shared/ipc.ts src/main/ipc.ts src/main/index.ts
git commit -m "$(cat <<'EOF'
feat(library): one local library per account, claimed from the pre-account library

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `PHINAS_PROFILE` for a second dev instance

**Files:**
- Modify: `src/main/index.ts`

Two app instances on one computer need two user-data folders (library, session, settings, localStorage). Packaged builds ignore the variable.

- [ ] **Step 1: Pick the folder before the app is ready**

In `src/main/index.ts`, replace:

```ts
if (process.env['PHINAS_SHOT'] && process.env['PHINAS_SHOT_PROFILE']) {
  app.setPath('userData', process.env['PHINAS_SHOT_PROFILE'])
}
```

with:

```ts
if (process.env['PHINAS_SHOT'] && process.env['PHINAS_SHOT_PROFILE']) {
  app.setPath('userData', process.env['PHINAS_SHOT_PROFILE'])
}

// Dev only: `PHINAS_PROFILE=b npm run dev` runs a copy of the app with its own library, login,
// settings and localStorage in `userData/b`, so two accounts can be tried side by side.
const devProfile = process.env['PHINAS_PROFILE']
if (devProfile && !app.isPackaged && !process.env['PHINAS_SHOT']) {
  if (/^[A-Za-z0-9_-]+$/.test(devProfile)) {
    app.setPath('userData', join(app.getPath('userData'), devProfile))
    console.log('[dev] user data:', app.getPath('userData'))
  } else {
    console.error('[dev] PHINAS_PROFILE may only hold letters, digits, - and _; ignored:', devProfile)
  }
}
```

- [ ] **Step 2: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

Run: `PHINAS_PROFILE=a npm run dev`, wait for the window, and check the terminal shows `[dev] user data: …/a`. Quit the app (Cmd+Q).

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "$(cat <<'EOF'
chore(dev): PHINAS_PROFILE runs a second app with its own user data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Social state in the renderer

**Files:**
- Create: `src/renderer/src/social/SocialProvider.tsx`
- Modify: `src/renderer/src/App.tsx`

Every social screen needs the same data: own profile, friends, requests, who is online, and whether the server is reachable. One provider fetches it on start, every minute and after `account:changed`, and listens to `friends:online`. Calling `listFriends` also keeps the main process's presence (and, from Task 6, the pair hub) in step.

- [ ] **Step 1: Write the provider**

Create `src/renderer/src/social/SocialProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Friend, FriendRequest, MyProfile } from '../../../shared/types'

export interface SocialApi {
  /** Supabase is configured (.env). */
  configured: boolean
  signedIn: boolean
  /** The signed-in email, from the stored session. */
  email: string | null
  /** False until the first refresh has finished. */
  loaded: boolean
  me: MyProfile | null
  /** Accepted friends, partner first. */
  friends: Friend[]
  /** Pending friend requests, both directions. */
  requests: FriendRequest[]
  /** Ids of friends who have Phinas open right now. */
  online: ReadonlySet<string>
  /** The server could not be reached: lists come from the cache and actions are disabled. */
  offline: boolean
  partner: Friend | null
  /** Incoming friend and partner requests (the dot on Teman). */
  incoming: number
  refresh(): Promise<void>
  /** A friend's name, or "Teman" when they are not in the list. */
  nameOf(userId: string): string
}

const Ctx = createContext<SocialApi | null>(null)

export function useSocial(): SocialApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSocial must be used inside SocialProvider')
  return v
}

const REFRESH_MS = 60_000
const NOBODY: ReadonlySet<string> = new Set()

/** Own profile, friends, requests and who is online, shared by every social screen. */
export function SocialProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [configured, setConfigured] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [me, setMe] = useState<MyProfile | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [online, setOnline] = useState<ReadonlySet<string>>(NOBODY)
  const [offline, setOffline] = useState(false)
  // A slow answer from before a sign-out must not bring the old account back.
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    const s = await window.phinas.syncStatus().catch(() => null)
    if (mine !== seq.current) return
    setConfigured(s?.configured ?? false)
    if (!s?.signedIn) {
      setSignedIn(false)
      setEmail(null)
      setMe(null)
      setFriends([])
      setRequests([])
      setOnline(NOBODY)
      setOffline(false)
      setLoaded(true)
      return
    }
    const [p, f, r, o] = await Promise.allSettled([
      window.phinas.myProfile(),
      window.phinas.listFriends(),
      window.phinas.listFriendRequests(),
      window.phinas.onlineFriends()
    ])
    if (mine !== seq.current) return
    setSignedIn(true)
    setEmail(s.email ?? null)
    if (p.status === 'fulfilled') setMe(p.value)
    if (f.status === 'fulfilled') setFriends(f.value)
    if (r.status === 'fulfilled') setRequests(r.value)
    if (o.status === 'fulfilled') setOnline(new Set(o.value))
    // Requests are never cached, so their failure is how an offline start shows.
    setOffline(r.status === 'rejected')
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), REFRESH_MS)
    const offs = [
      window.phinas.onAccountChanged(() => void refresh()),
      window.phinas.onFriendsOnline((ids) => setOnline(new Set(ids)))
    ]
    return () => {
      clearInterval(t)
      offs.forEach((off) => off())
    }
  }, [refresh])

  const api = useMemo<SocialApi>(() => {
    const partner = friends.find((f) => f.isPartner) ?? null
    const incoming = requests.filter((r) => r.incoming).length + friends.filter((f) => f.partnerRequest === 'incoming').length
    return {
      configured,
      signedIn,
      email,
      loaded,
      me,
      friends,
      requests,
      online,
      offline,
      partner,
      incoming,
      refresh,
      nameOf: (userId) => friends.find((f) => f.userId === userId)?.name ?? 'Teman'
    }
  }, [configured, signedIn, email, loaded, me, friends, requests, online, offline, refresh])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
```

- [ ] **Step 2: Mount it inside the player, around Listen Together**

In `src/renderer/src/App.tsx`, replace:

```tsx
import { ListenTogetherProvider, useListen } from './sync/ListenTogetherProvider'
```

with:

```tsx
import { ListenTogetherProvider, useListen } from './sync/ListenTogetherProvider'
import { SocialProvider } from './social/SocialProvider'
```

and replace:

```tsx
    <LibraryProvider>
      <PlayerProvider>
        <ListenTogetherProvider>
          <Shell />
        </ListenTogetherProvider>
      </PlayerProvider>
    </LibraryProvider>
```

with:

```tsx
    <LibraryProvider>
      <PlayerProvider>
        <SocialProvider>
          <ListenTogetherProvider>
            <Shell />
          </ListenTogetherProvider>
        </SocialProvider>
      </PlayerProvider>
    </LibraryProvider>
```

- [ ] **Step 3: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/social/SocialProvider.tsx src/renderer/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(social): shared friends, requests and online state in the renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Busy decline, invite routing and a per-friend transport

**Files:**
- Modify: `src/shared/sync/protocol.ts`
- Modify: `src/shared/sync/session.ts`
- Modify: `tests/sync-session.test.ts`
- Modify: `src/renderer/src/components/ListenTogether.tsx`
- Create: `src/renderer/src/sync/route.ts`
- Create: `tests/listen-route.test.ts`
- Create: `src/renderer/src/sync/friendTransport.ts`
- Create: `tests/friend-transport.test.ts`

Pure pieces the new provider (Task 6) is built from. The protocol version stays 1: an older app treats `busy` as a plain decline.

- [ ] **Step 1: Failing session test for a busy decline**

Append to `tests/sync-session.test.ts`:

```ts
test('a busy decline ends the invite with its own reason', () => {
  const t = setup()
  t.a.invite()
  t.ta.deliver(msg('b', { type: 'decline', reason: 'busy' }))
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'busy' })
})
```

Run: `npx vitest run tests/sync-session.test.ts`
Expected: FAIL — `endReason` is `'declined'`.

- [ ] **Step 2: Add the reason**

In `src/shared/sync/protocol.ts`, replace:

```ts
  | { type: 'decline'; reason?: 'version' }
```

with:

```ts
  /** `busy`: the friend is already in a session or has another invite open. */
  | { type: 'decline'; reason?: 'version' | 'busy' }
```

In `src/shared/sync/session.ts`, replace:

```ts
export type EndReason = 'ended' | 'declined' | 'expired' | 'timeout' | 'version' | 'partner-ended'
```

with:

```ts
export type EndReason = 'ended' | 'declined' | 'expired' | 'timeout' | 'version' | 'partner-ended' | 'busy'
```

and replace:

```ts
      case 'decline':
        if (this.state.status === 'inviting') this.finish(m.reason === 'version' ? 'version' : 'declined')
        return
```

with:

```ts
      case 'decline':
        if (this.state.status === 'inviting') {
          this.finish(m.reason === 'version' ? 'version' : m.reason === 'busy' ? 'busy' : 'declined')
        }
        return
```

In `src/renderer/src/components/ListenTogether.tsx` (the `Record<EndReason, string>` must list every reason), replace:

```ts
  'partner-ended': 'Pasangan mengakhiri sesi.'
}
```

with:

```ts
  'partner-ended': 'Pasangan mengakhiri sesi.',
  busy: 'Pasangan sedang dengar bareng orang lain.'
}
```

(Task 6 replaces this table with `endedText`.)

Run: `npx vitest run tests/sync-session.test.ts`
Expected: PASS.

- [ ] **Step 3: Failing routing tests**

Create `tests/listen-route.test.ts`:

```ts
import { expect, test } from 'vitest'
import { routeInvite } from '../src/renderer/src/sync/route'

test('with nothing going on, an invite starts a new session with that friend', () => {
  expect(routeInvite({ activeFriend: null, status: 'idle' }, 'x')).toBe('new')
})

test('after a finished or idle session with someone else, a new invite still gets through', () => {
  expect(routeInvite({ activeFriend: 'y', status: 'ended' }, 'x')).toBe('new')
  expect(routeInvite({ activeFriend: 'y', status: 'idle' }, 'x')).toBe('new')
})

test('the friend of the current session is handled by that session', () => {
  expect(routeInvite({ activeFriend: 'x', status: 'inviting' }, 'x')).toBe('session')
  expect(routeInvite({ activeFriend: 'x', status: 'invited' }, 'x')).toBe('session')
  expect(routeInvite({ activeFriend: 'x', status: 'active' }, 'x')).toBe('session')
})

test('anyone else is told we are busy while a session or an invite is open', () => {
  expect(routeInvite({ activeFriend: 'y', status: 'active' }, 'x')).toBe('busy')
  expect(routeInvite({ activeFriend: 'y', status: 'invited' }, 'x')).toBe('busy')
  expect(routeInvite({ activeFriend: 'y', status: 'inviting' }, 'x')).toBe('busy')
})
```

Create `tests/friend-transport.test.ts`:

```ts
import { expect, test } from 'vitest'
import type { SyncMessage } from '../src/shared/sync/protocol'
import { createFriendTransport } from '../src/renderer/src/sync/friendTransport'

const m: SyncMessage = { type: 'end', from: 'b', ts: 1 }

test('send goes to the function it was made with', () => {
  const sent: SyncMessage[] = []
  const t = createFriendTransport((x) => sent.push(x))
  t.send(m)
  expect(sent).toEqual([m])
})

test('delivered messages reach subscribers until they unsubscribe', () => {
  const got: SyncMessage[] = []
  const t = createFriendTransport(() => {})
  const off = t.onMessage((x) => got.push(x))
  t.deliver(m)
  off()
  t.deliver(m)
  expect(got).toEqual([m])
})

test('presence and connection report the current value at once, then only changes', () => {
  const t = createFriendTransport(() => {}, { up: true, here: false })
  const ups: boolean[] = []
  const heres: boolean[] = []
  t.onConnection((u) => ups.push(u))
  t.onPartnerPresence((h) => heres.push(h))
  t.setLink({ up: true, here: true })
  t.setLink({ up: false, here: true })
  expect(ups).toEqual([true, false])
  expect(heres).toEqual([false, true])
})
```

Run: `npx vitest run tests/listen-route.test.ts tests/friend-transport.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Write the router and the transport**

Create `src/renderer/src/sync/route.ts`:

```ts
import type { SessionStatus } from '../../../shared/sync/session'

/** Where an incoming invite goes. */
export type InviteRoute =
  /** From the friend of the current session: that session handles it (both inviting at once, a repeat). */
  | 'session'
  /** Nothing going on: start a session with this friend and show the invite. */
  | 'new'
  /** A session or another invite is open: answer "busy" on this friend's channel. */
  | 'busy'

export interface RouteState {
  /** The friend of the current (or last) session, or null. */
  activeFriend: string | null
  status: SessionStatus
}

/** One session at a time: decides what an invite from `from` does. */
export function routeInvite(cur: RouteState, from: string): InviteRoute {
  if (cur.activeFriend === null || cur.status === 'idle' || cur.status === 'ended') return 'new'
  return cur.activeFriend === from ? 'session' : 'busy'
}
```

Create `src/renderer/src/sync/friendTransport.ts`:

```ts
import type { SyncMessage } from '../../../shared/sync/protocol'
import type { Transport } from '../../../shared/sync/session'

/** One friend's pair channel as the renderer sees it. */
export interface Link {
  /** Our own connection to the channel is up. */
  up: boolean
  /** The friend is on the channel. */
  here: boolean
}

export const DOWN: Link = { up: false, here: false }

/** A session transport for one friend. The provider feeds it; it never touches IPC itself. */
export interface FriendTransport extends Transport {
  /** A message from this friend, already validated. */
  deliver(m: SyncMessage): void
  /** The channel's state changed; subscribers hear only what changed. */
  setLink(link: Link): void
}

export function createFriendTransport(send: (m: SyncMessage) => void, initial: Link = DOWN): FriendTransport {
  const msg = new Set<(m: SyncMessage) => void>()
  const pres = new Set<(here: boolean) => void>()
  const conn = new Set<(up: boolean) => void>()
  let link = initial
  return {
    send,
    onMessage: (cb) => {
      msg.add(cb)
      return () => msg.delete(cb)
    },
    onPartnerPresence: (cb) => {
      pres.add(cb)
      cb(link.here)
      return () => pres.delete(cb)
    },
    onConnection: (cb) => {
      conn.add(cb)
      cb(link.up)
      return () => conn.delete(cb)
    },
    deliver: (m) => msg.forEach((cb) => cb(m)),
    setLink: (next) => {
      const prev = link
      link = next
      if (next.up !== prev.up) conn.forEach((cb) => cb(next.up))
      if (next.here !== prev.here) pres.forEach((cb) => cb(next.here))
    }
  }
}
```

- [ ] **Step 5: Run everything**

Run: `npx vitest run tests/listen-route.test.ts tests/friend-transport.test.ts`
Expected: PASS (4 + 3 tests).

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/shared/sync/protocol.ts src/shared/sync/session.ts tests/sync-session.test.ts src/renderer/src/components/ListenTogether.tsx src/renderer/src/sync/route.ts tests/listen-route.test.ts src/renderer/src/sync/friendTransport.ts tests/friend-transport.test.ts
git commit -m "$(cat <<'EOF'
feat(listen): busy decline, invite routing and a per-friend transport

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: A pair channel per online friend; Listen Together with any of them

**Files:**
- Create: `src/main/sync/pair-hub.ts`
- Create: `tests/pair-hub.test.ts`
- Modify: `src/main/sync/realtime.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/sync/supabase-remote.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Delete: `src/renderer/src/sync/ipcTransport.ts`
- Rewrite: `src/renderer/src/sync/ListenTogetherProvider.tsx`
- Modify: `src/renderer/src/sync/status.ts`
- Create: `tests/listen-text.test.ts`
- Rewrite: `src/renderer/src/components/ListenTogether.tsx`
- Modify: `src/renderer/src/components/NowPlaying.tsx`
- Modify: `src/renderer/src/components/BerduaLine.tsx`
- Modify: `src/renderer/src/components/ListenCard.tsx`
- Modify: `src/renderer/src/screens/TogetherView.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`

The IPC shape changes in this task, so main, preload and renderer change together. Until Tasks 8–12 replace them, the Berdua screens keep working against the partner through the new API.

A channel whose friend goes offline closes with reason `closed`; the renderer then treats it like a dropped connection (the session's 2-minute grace period), and the hub reopens it when the friend is back, which makes the session send `hello`. A friend who is no longer allowed (removed, scope changed, switch off) is closed as `not-allowed`, and the renderer ends that session at once.

- [ ] **Step 1: Failing hub tests**

Create `tests/pair-hub.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest'
import { channelPlan, eligibleFriends, PairHub } from '../src/main/sync/pair-hub'
import type { PairRealtimeLike } from '../src/main/sync/realtime'
import type { SyncMessage } from '../src/shared/sync/protocol'
import type { Friend } from '../src/shared/types'

/** Behaves like realtime-js: on() throws after subscribe(), and channel() reuses a live topic. */
class FakeChannel {
  subscribed = false
  sent: unknown[] = []
  failWith: { status: string; err?: Error } | null = null
  constructor(
    public name: string,
    public opts: { config: { private: boolean } }
  ) {}
  on(type: string): this {
    if (this.subscribed) throw new Error(`cannot add \`${type}\` callbacks for ${this.name} after \`subscribe()\`.`)
    return this
  }
  subscribe(cb: (status: string, err?: Error) => void): this {
    this.subscribed = true
    if (this.failWith) cb(this.failWith.status, this.failWith.err)
    else cb('SUBSCRIBED')
    return this
  }
  async track(): Promise<void> {}
  presenceState(): Record<string, unknown[]> {
    return {}
  }
  async send(msg: unknown): Promise<void> {
    this.sent.push(msg)
  }
}

class FakeClient implements PairRealtimeLike {
  channels: FakeChannel[] = []
  live = new Map<string, FakeChannel>()
  removed: string[] = []
  failNext: { status: string; err?: Error } | null = null
  realtime = { setAuth: async (): Promise<void> => {} }
  channel(name: string, opts: { config: { private: boolean } }): FakeChannel {
    const existing = this.live.get(name)
    if (existing) return existing
    const ch = new FakeChannel(name, opts)
    ch.failWith = this.failNext
    this.channels.push(ch)
    this.live.set(name, ch)
    return ch
  }
  async removeChannel(ch: FakeChannel): Promise<void> {
    this.removed.push(ch.name)
    if (this.live.get(ch.name) === ch) this.live.delete(ch.name)
  }
}

const friend = (userId: string, o: Partial<Friend> = {}): Friend => ({
  friendshipId: `fs-${userId}`,
  userId,
  name: userId.toUpperCase(),
  isPartner: false,
  partnerRequest: null,
  canListen: true,
  ...o
})

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('channelPlan', () => {
  test('opens channels for newly eligible friends and closes the others', () => {
    expect(channelPlan(['a', 'b'], ['b', 'c'])).toEqual({ open: ['c'], close: ['a'] })
  })
  test('keeps at most `cap` channels, in list order', () => {
    expect(channelPlan([], ['p', 'a', 'b'], 2)).toEqual({ open: ['p', 'a'], close: [] })
    expect(channelPlan(['b'], ['p', 'a', 'b'], 2)).toEqual({ open: ['p', 'a'], close: ['b'] })
  })
  test('nothing to do when the channels already match', () => {
    expect(channelPlan(['a'], ['a'])).toEqual({ open: [], close: [] })
  })
})

describe('eligibleFriends', () => {
  test('online friends who allow Listen Together, in list order', () => {
    const list = [friend('p', { isPartner: true }), friend('a', { canListen: false }), friend('b'), friend('c')]
    expect(eligibleFriends(list, new Set(['b', 'a', 'p']))).toEqual(['p', 'b'])
  })
})

describe('PairHub', () => {
  let client: FakeClient
  let events: [string, unknown][]
  let hub: PairHub

  beforeEach(() => {
    client = new FakeClient()
    events = []
    hub = new PairHub(client, (ch, v) => events.push([ch, v]))
  })

  const of = (ch: string): unknown[] => events.filter(([c]) => c === ch).map(([, v]) => v)

  test('opens one private channel per online friend who allows it', async () => {
    await hub.setFriends('me', [friend('a'), friend('b', { canListen: false }), friend('zz')])
    expect(client.channels).toHaveLength(0)
    await hub.setOnline(['a', 'b'])
    expect(client.channels.map((c) => c.name)).toEqual(['pair:a:me'])
    expect(client.channels[0].opts.config.private).toBe(true)
  })

  test('events name the friend they are about', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    expect(of('listen:connection')).toEqual([{ friendId: 'a', up: true }])
  })

  test('a friend going offline closes their channel with reason closed', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.setOnline([])
    expect(client.removed).toEqual(['pair:a:me'])
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'closed' }])
  })

  test('a friend who may no longer listen with us is closed as not-allowed', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.setFriends('me', [friend('a', { canListen: false })])
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'not-allowed' }])
  })

  test("send reaches only that friend's channel", async () => {
    await hub.setFriends('me', [friend('a'), friend('b')])
    await hub.setOnline(['a', 'b'])
    const msg: SyncMessage = { type: 'end', from: 'me', ts: 1 }
    hub.send('b', msg)
    expect(client.channels.find((c) => c.name === 'pair:a:me')!.sent).toEqual([])
    expect(client.channels.find((c) => c.name === 'pair:b:me')!.sent).toEqual([{ type: 'broadcast', event: 'msg', payload: msg }])
  })

  test('status is reported per friend', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    expect(hub.status()).toEqual({ a: { connected: true, partnerHere: false, notAllowed: false } })
  })

  test('close leaves every channel and forgets who was online', async () => {
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await hub.close()
    expect(client.removed).toEqual(['pair:a:me'])
    expect(hub.status()).toEqual({})
    await hub.setFriends('other', [friend('a')])
    expect(client.channels).toHaveLength(1)
  })

  test('a refused channel is not reopened while the friend stays eligible', async () => {
    client.failNext = { status: 'CHANNEL_ERROR', err: new Error('Unauthorized') }
    await hub.setFriends('me', [friend('a')])
    await hub.setOnline(['a'])
    await tick()
    client.failNext = null
    await hub.setOnline(['a'])
    expect(client.channels).toHaveLength(1)
    expect(of('listen:closed')).toEqual([{ friendId: 'a', reason: 'not-allowed' }])
  })
})
```

Run: `npx vitest run tests/pair-hub.test.ts`
Expected: FAIL — `Cannot find module '../src/main/sync/pair-hub'`.

- [ ] **Step 2: Shared event types**

In `src/shared/types.ts`, replace:

```ts
/** Who we listen together with by default: the partner, when Listen Together is allowed with them. */
export interface ListenInfo {
  me: string
  partnerId: string
  partnerName: string
}

/** Live state of the realtime channel, so the renderer can catch up on events it missed. */
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
  /** The server refused the channel (switch off, scope, not friends). No retry until reopened. */
  notAllowed: boolean
}
```

with:

```ts
/** Live state of one friend's pair channel, so the renderer can catch up on events it missed. */
export interface ListenStatus {
  connected: boolean
  /** The friend is on the channel. */
  partnerHere: boolean
  /** The server refused the channel (switch off, scope, not friends). No retry until reopened. */
  notAllowed: boolean
}

/** Why a pair channel closed: we left it (or the friend went offline), or the friend is no longer allowed. */
export type PairClosedReason = 'closed' | 'not-allowed'

/** Listen Together events from the main process; each names the friend whose channel it is about. */
export interface ListenMessageEvent {
  friendId: string
  /** Unvalidated: check it with `parseMessage`. */
  msg: unknown
}

export interface ListenPresenceEvent {
  friendId: string
  here: boolean
}

export interface ListenConnectionEvent {
  friendId: string
  up: boolean
}

export interface ListenClosedEvent {
  friendId: string
  reason: PairClosedReason
}
```

- [ ] **Step 3: `PairChannel.close` takes a reason**

In `src/main/sync/realtime.ts`, replace:

```ts
import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void

/** Why an open pair channel was closed (sent to the renderer as `listen:closed`). */
export type PairClosedReason = 'closed' | 'not-allowed'
```

with:

```ts
import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus, PairClosedReason } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void
```

and replace:

```ts
  close(): Promise<void> {
    return this.run(() => this.doClose('closed'))
  }
```

with:

```ts
  /** Leaves the channel. `not-allowed` tells the renderer this friend may no longer listen with us. */
  close(reason: PairClosedReason = 'closed'): Promise<void> {
    return this.run(() => this.doClose(reason))
  }
```

- [ ] **Step 4: Write the hub**

Create `src/main/sync/pair-hub.ts`:

```ts
import type { SyncMessage } from '../../shared/sync/protocol'
import type { Friend, ListenStatus, PairClosedReason } from '../../shared/types'
import { PairChannel, type PairRealtimeLike } from './realtime'

type Emit = (channel: string, value: unknown) => void

/** Most pair channels open at once (partner first, then friends in list order). */
export const MAX_PAIRS = 30

/** Which channels to open and close so exactly the first `cap` eligible friends have one. */
export function channelPlan(current: readonly string[], eligible: readonly string[], cap = MAX_PAIRS): { open: string[]; close: string[] } {
  const keep = new Set(eligible.slice(0, cap))
  const have = new Set(current)
  return {
    open: [...keep].filter((id) => !have.has(id)),
    close: current.filter((id) => !keep.has(id))
  }
}

/** Friends a pair channel is for: online and allowed, in list order (the server puts the partner first). */
export function eligibleFriends(friends: readonly Friend[], online: ReadonlySet<string>): string[] {
  return friends.filter((f) => f.canListen && online.has(f.userId)).map((f) => f.userId)
}

/**
 * One private `pair:<a>:<b>` channel per friend who is online and allows Listen Together. Follows
 * the friends list and the online set; events to the renderer carry the friend's id.
 * Calls are serialised, like PairChannel and PresenceHub.
 */
export class PairHub {
  private pairs = new Map<string, PairChannel>()
  private me: string | null = null
  private friends: Friend[] = []
  private online = new Set<string>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly sb: PairRealtimeLike,
    private readonly emit: Emit,
    private readonly cap = MAX_PAIRS
  ) {}

  /** The friends list was fetched again (it carries `canListen`). */
  setFriends(me: string, friends: Friend[]): Promise<void> {
    return this.run(async () => {
      if (this.me !== null && this.me !== me) await this.closeAll('closed')
      this.me = me
      this.friends = friends
      await this.reconcile()
    })
  }

  /** The set of online friends changed (from PresenceHub). */
  setOnline(ids: string[]): Promise<void> {
    return this.run(async () => {
      this.online = new Set(ids)
      await this.reconcile()
    })
  }

  send(friendId: string, msg: SyncMessage): void {
    this.pairs.get(friendId)?.send(msg)
  }

  /** Each open channel's state, by friend id. */
  status(): Record<string, ListenStatus> {
    return Object.fromEntries([...this.pairs].map(([id, p]) => [id, p.status()]))
  }

  /** Sign-out, deletion or a disabled account: leave everything and forget the lists. */
  close(): Promise<void> {
    return this.run(async () => {
      this.me = null
      this.friends = []
      this.online = new Set()
      await this.closeAll('closed')
    })
  }

  /** Runs `op` after every earlier operation; one failure does not stop the queue. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const p = this.queue.then(op)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async reconcile(): Promise<void> {
    const me = this.me
    if (me === null) return
    const plan = channelPlan([...this.pairs.keys()], eligibleFriends(this.friends, this.online), this.cap)
    for (const id of plan.close) {
      const p = this.pairs.get(id)
      this.pairs.delete(id)
      // Still a friend who allows it means they only went offline; anything else is a refusal.
      const allowed = this.friends.some((f) => f.userId === id && f.canListen)
      await p?.close(allowed ? 'closed' : 'not-allowed')
    }
    for (const id of plan.open) {
      const p = new PairChannel(this.sb, (channel, value) => this.forward(id, channel, value))
      this.pairs.set(id, p)
      await p.open(me, id)
    }
  }

  private async closeAll(reason: PairClosedReason): Promise<void> {
    const all = [...this.pairs.values()]
    this.pairs.clear()
    for (const p of all) await p.close(reason)
  }

  /** PairChannel emits bare values; the renderer needs to know whose channel they come from. */
  private forward(friendId: string, channel: string, value: unknown): void {
    if (channel === 'listen:message') this.emit(channel, { friendId, msg: value })
    else if (channel === 'listen:presence') this.emit(channel, { friendId, here: value })
    else if (channel === 'listen:connection') this.emit(channel, { friendId, up: value })
    else if (channel === 'listen:closed') this.emit(channel, { friendId, reason: value })
  }
}
```

Run: `npx vitest run tests/pair-hub.test.ts tests/pair-channel.test.ts`
Expected: PASS.

- [ ] **Step 5: The IPC contract**

In `src/shared/ipc.ts`, replace the first line:

```ts
import type { AppConfig, ArtistDetail, FavoriteArtist, Friend, FriendRequest, GenrePage, InviteCode, UpdateStatus, ListenInfo, ListenScope, ListenStatus, MyProfile, NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SignUpInput, SyncStatus, Track, Visibility } from './types'
```

with:

```ts
import type { AppConfig, ArtistDetail, FavoriteArtist, Friend, FriendRequest, GenrePage, InviteCode, UpdateStatus, ListenClosedEvent, ListenConnectionEvent, ListenMessageEvent, ListenPresenceEvent, ListenScope, ListenStatus, MyProfile, NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SignUpInput, SyncStatus, Track, Visibility } from './types'
```

Replace:

```ts
  /** Joins the pair channel. Null when not signed in, Supabase is not configured, or there is no partner yet. */
  listenOpen(): Promise<ListenInfo | null>
  listenClose(): Promise<void>
  /** Current connection and partner presence, for catching up on events fired before we subscribed. */
  listenStatus(): Promise<ListenStatus>
```

with:

```ts
  /** Every open pair channel's state by friend id, for catching up on events fired before we subscribed. */
  listenStatus(): Promise<Record<string, ListenStatus>>
```

Replace:

```ts
  /** Sends a listen-together message to the partner. */
  listenSend(msg: SyncMessage): void
  /** A raw message from the partner (validate it with `parseMessage`). Returns an unsubscribe. */
  onListenMessage(cb: (raw: unknown) => void): () => void
  onListenPresence(cb: (here: boolean) => void): () => void
  onListenConnection(cb: (up: boolean) => void): () => void
  /** The pair channel was closed (by us, or refused by the server). Returns an unsubscribe. */
  onListenClosed(cb: (reason: 'closed' | 'not-allowed') => void): () => void
```

with:

```ts
  /** Sends a listen-together message on one friend's pair channel. */
  listenSend(friendId: string, msg: SyncMessage): void
  /** A raw message from a friend (validate `msg` with `parseMessage`). Returns an unsubscribe. */
  onListenMessage(cb: (e: ListenMessageEvent) => void): () => void
  /** Whether a friend is on their pair channel. Returns an unsubscribe. */
  onListenPresence(cb: (e: ListenPresenceEvent) => void): () => void
  /** Whether our own connection to a friend's pair channel is up. Returns an unsubscribe. */
  onListenConnection(cb: (e: ListenConnectionEvent) => void): () => void
  /** A friend's pair channel closed (offline, or no longer allowed). Returns an unsubscribe. */
  onListenClosed(cb: (e: ListenClosedEvent) => void): () => void
```

Replace:

```ts
  /** The partner invited us: the main process shows a system notification when the window is not focused. */
  notifyListenInvite(partnerName: string): void
```

with:

```ts
  /** A friend invited us: the main process shows a system notification when the window is not focused. */
  notifyListenInvite(friendName: string): void
```

In `CHANNEL_MAP`, replace:

```ts
  setNotchEnabled: true,
  listenOpen: true,
  listenClose: true,
  listenStatus: true
}
```

with:

```ts
  setNotchEnabled: true,
  listenStatus: true
}
```

- [ ] **Step 6: Preload**

In `src/preload/index.ts`, replace:

```ts
  listenSend: (msg) => ipcRenderer.send('listen:send', msg),
```

with:

```ts
  listenSend: (friendId, msg) => ipcRenderer.send('listen:send', friendId, msg),
```

- [ ] **Step 7: Remote: drop `pairInfo`**

In `src/main/sync/supabase-remote.ts`, replace:

```ts
  LikeEntry,
  ListenInfo,
  ListenScope,
```

with:

```ts
  LikeEntry,
  ListenScope,
```

and delete this method (with its comment):

```ts
  /** The partner, when Listen Together is allowed with them; otherwise null. */
  async pairInfo(): Promise<ListenInfo | null> {
    const me = await this.userId();
    const partner = (await this.listFriends()).find(
      (f) => f.isPartner && f.canListen,
    );
    return partner
      ? { me, partnerId: partner.userId, partnerName: partner.name }
      : null;
  }

```

- [ ] **Step 8: Handlers use the hub**

In `src/main/ipc.ts`:

Replace:

```ts
import type { PairChannel } from './sync/realtime'
```

with:

```ts
import type { PairHub } from './sync/pair-hub'
```

Replace:

```ts
  /** Realtime channel for listen together; null when Supabase is not configured. */
  pair: PairChannel | null
```

with:

```ts
  /** One Listen Together channel per online friend who allows it; null when Supabase is not configured. */
  pairs: PairHub | null
```

Replace:

```ts
    await d.pair?.close()
```

with:

```ts
    await d.pairs?.close()
```

Replace:

```ts
      void d.presence
        ?.sync(s.uid, friends.map((f) => f.userId))
        .catch((e) => console.warn('[presence] sync failed:', e))
      return friends
```

with:

```ts
      void d.presence
        ?.sync(s.uid, friends.map((f) => f.userId))
        .catch((e) => console.warn('[presence] sync failed:', e))
      // canListen may have changed: the hub opens and closes pair channels to match.
      void d.pairs?.setFriends(s.uid, friends).catch((e) => console.warn('[listen] reconcile failed:', e))
      return friends
```

Replace:

```ts
    listenOpen: async () => {
      if (!d.remote || !d.pair) return null
      try {
        const info = await d.remote.pairInfo()
        if (!info) return null
        await d.pair.open(info.me, info.partnerId)
        return info
      } catch (e) {
        console.warn('[listen] could not open the channel:', e)
        return null
      }
    },
    listenClose: async () => d.pair?.close(),
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false, notAllowed: false },
```

with:

```ts
    listenStatus: async () => d.pairs?.status() ?? {},
```

- [ ] **Step 9: Main process wiring**

In `src/main/index.ts`:

Replace:

```ts
import { CHANNELS } from '../shared/ipc'
```

with:

```ts
import { CHANNELS } from '../shared/ipc'
import { parseMessage } from '../shared/sync/protocol'
```

Replace:

```ts
import { PairChannel } from './sync/realtime'
```

with:

```ts
import { PairHub } from './sync/pair-hub'
```

Replace:

```ts
  const pair = remote
    ? new PairChannel(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const presence = remote
    ? new PresenceHub(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
```

with:

```ts
  const pairs = remote
    ? new PairHub(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const presence = remote
    ? new PresenceHub(remote.client, (channel, value) => {
        mainWindow?.webContents.send(channel, value)
        // Who is online decides which pair channels stay open.
        if (channel === 'friends:online') {
          void pairs?.setOnline(value as string[]).catch((e) => console.warn('[listen] reconcile failed:', e))
        }
      })
    : null
```

Replace:

```ts
    remote,
    pair,
    presence,
```

with:

```ts
    remote,
    pairs,
    presence,
```

Replace:

```ts
        // Every minute: refresh friends (keeps presence in step) and leave a pair that is no longer allowed.
        if (n % 4 === 0) {
          const friends = await handlers.listFriends().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
          if (friends instanceof Error && friends.message.includes('phinas:account_disabled')) {
            // A disabled account may not listen together or show as online.
            await pair?.close()
            await presence?.close()
          } else if (!(friends instanceof Error) && !friends.some((f) => f.isPartner && f.canListen)) {
            await pair?.close()
          }
        }
```

with:

```ts
        // Every minute: refresh friends. listFriends hands them to presence and to the pair hub,
        // which closes the channel of any friend who may no longer listen with us.
        if (n % 4 === 0) {
          const friends = await handlers.listFriends().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
          if (friends instanceof Error && friends.message.includes('phinas:account_disabled')) {
            // A disabled account may not listen together or show as online.
            await pairs?.close()
            await presence?.close()
          }
        }
```

Replace:

```ts
  ipcMain.on('listen:send', (_e, msg) => pair?.send(msg))
  // An invite only shows inside the app, so without this a partner in another app never sees it.
  ipcMain.on('listen:invited', (_e, name: unknown) => {
    const win = mainWindow
    if (!win || win.isFocused()) return
    const who = typeof name === 'string' && name.trim() ? name.trim() : 'Pasangan'
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Dengarkan bareng', body: `${who} mengajak kamu dengarkan bareng.` })
```

with:

```ts
  ipcMain.on('listen:send', (_e, friendId: unknown, msg: unknown) => {
    const m = parseMessage(msg)
    if (typeof friendId === 'string' && m) pairs?.send(friendId, m)
  })
  // An invite only shows inside the app, so without this a friend in another app never sees it.
  ipcMain.on('listen:invited', (_e, name: unknown) => {
    const win = mainWindow
    if (!win || win.isFocused()) return
    const who = typeof name === 'string' && name.trim() ? name.trim() : 'Teman'
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Dengar bareng', body: `${who} mengajak kamu dengar bareng.` })
```

- [ ] **Step 10: `endedText` (failing test first)**

Create `tests/listen-text.test.ts`:

```ts
import { expect, test } from 'vitest'
import type { EndReason } from '../src/shared/sync/session'
import { endedText } from '../src/renderer/src/sync/status'

test('a busy friend is named', () => {
  expect(endedText('busy', 'Sari')).toBe('Sari sedang dengar bareng orang lain.')
})

test('the other reasons name the friend where it helps', () => {
  expect(endedText('declined', 'Sari')).toBe('Sari menolak ajakan.')
  expect(endedText('partner-ended', 'Sari')).toBe('Sari mengakhiri sesi.')
  expect(endedText('ended', 'Sari')).toBe('Sesi diakhiri.')
})

test('every end reason has a text', () => {
  const all: EndReason[] = ['ended', 'declined', 'expired', 'timeout', 'version', 'partner-ended', 'busy']
  for (const r of all) expect(endedText(r, 'Sari')).not.toBe('')
})
```

Run: `npx vitest run tests/listen-text.test.ts`
Expected: FAIL — `endedText` is not exported.

Replace the whole of `src/renderer/src/sync/status.ts` with:

```ts
import type { EndReason, SessionState } from '../../../shared/sync/session'

/** One line describing how an active session is going. Used by the button, the online line and the side panel. */
export function liveLabel(state: Pick<SessionState, 'connected' | 'partnerHere' | 'partnerError'>, name: string): string {
  if (!state.connected) return 'Koneksi terputus'
  if (!state.partnerHere) return `${name} terputus`
  if (state.partnerError) return `${name}: gagal memutar`
  return 'Tersambung'
}

/** Why the last session or invite ended, naming the friend it was with. */
export function endedText(reason: EndReason, name: string): string {
  switch (reason) {
    case 'ended':
      return 'Sesi diakhiri.'
    case 'declined':
      return `${name} menolak ajakan.`
    case 'expired':
      return `${name} tidak menjawab ajakan.`
    case 'timeout':
      return 'Sesi berakhir karena koneksi terputus.'
    case 'version':
      return 'Versi app berbeda. Update app dulu supaya sama.'
    case 'partner-ended':
      return `${name} mengakhiri sesi.`
    case 'busy':
      return `${name} sedang dengar bareng orang lain.`
  }
}
```

Run: `npx vitest run tests/listen-text.test.ts`
Expected: PASS.

- [ ] **Step 11: The provider**

Delete the old transport:

```bash
git rm src/renderer/src/sync/ipcTransport.ts
```

Replace the whole of `src/renderer/src/sync/ListenTogetherProvider.tsx` with:

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { friendlyError } from '../../../shared/errors'
import { parseMessage } from '../../../shared/sync/protocol'
import { INITIAL_STATE, SyncSession, type PlayerPort, type SessionState, type SessionStatus } from '../../../shared/sync/session'
import type { Friend, PairClosedReason } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { useSocial } from '../social/SocialProvider'
import { createFriendTransport, DOWN, type FriendTransport, type Link } from './friendTransport'
import { routeInvite } from './route'

export interface ListenApi {
  state: SessionState
  /** The friend of the current (or last) session, or null. */
  activeFriend: string | null
  /** That friend's name, for status texts ("Teman" when there is none). */
  activeName: string
  /** An invite waiting for Terima / Tolak. */
  pendingInvite: { friendId: string; name: string } | null
  /** The partner, online or not. */
  partner: Friend | null
  /** Online friends who allow Listen Together, partner first. */
  invitable: Friend[]
  /** A session or an invite (either way) is going on. */
  busy: boolean
  /** A refusal to show once ("not allowed"). */
  notice: string | null
  /** An invite to this friend can go out now: allowed, online, both on the channel, nothing else going on. */
  canInvite(friendId: string): boolean
  invite(friendId: string): void
  accept(): void
  decline(): void
  /** Ends an active session, or cancels an invite we sent. */
  end(): void
  dismissNotice(): void
}

const Ctx = createContext<ListenApi | null>(null)

export function useListen(): ListenApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useListen must be used inside ListenTogetherProvider')
  return v
}

interface Live {
  friendId: string
  session: SyncSession
  transport: FriendTransport
}

const isBusy = (s: SessionStatus): boolean => s === 'inviting' || s === 'invited' || s === 'active'

/**
 * Listen Together with any online friend, one session at a time. The main process keeps a pair
 * channel per eligible friend; this routes their events to the one live session and answers other
 * invites with "busy".
 */
export function ListenTogetherProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const player = usePlayer()
  const playerRef = useRef(player)
  playerRef.current = player
  const social = useSocial()
  const meRef = useRef<string | null>(null)
  meRef.current = social.me?.id ?? null
  const [links, setLinks] = useState<Record<string, Link>>({})
  const linksRef = useRef<Record<string, Link>>({})
  const [active, setActive] = useState<string | null>(null)
  const [state, setState] = useState<SessionState>(INITIAL_STATE)
  const [notice, setNotice] = useState<string | null>(null)
  const liveRef = useRef<Live | null>(null)

  // Built once: everything here reads refs, so it never goes stale.
  const ops = useMemo(() => {
    const port: PlayerPort = {
      snapshot: () => playerRef.current.sync.snapshot(),
      apply: (a) => playerRef.current.sync.apply(a),
      setRate: (r) => playerRef.current.sync.setRate(r)
    }

    const stop = (): void => {
      const live = liveRef.current
      if (!live) return
      liveRef.current = null
      playerRef.current.sync.bind(null)
      live.session.dispose()
    }

    /** A fresh session with this friend, replacing any earlier (finished) one. */
    const start = (friendId: string): Live | null => {
      const me = meRef.current
      if (!me) return null
      stop()
      const transport = createFriendTransport((m) => window.phinas.listenSend(friendId, m), linksRef.current[friendId] ?? DOWN)
      const session = new SyncSession({ me, transport, player: port })
      session.subscribe(() => setState(session.getState()))
      playerRef.current.sync.bind({
        action: (a) => session.localAction(a),
        streamError: (id) => session.reportStreamError(id)
      })
      const live = { friendId, session, transport }
      liveRef.current = live
      setActive(friendId)
      setState(session.getState())
      return live
    }

    const setLink = (friendId: string, patch: Partial<Link>): void => {
      const next = { ...(linksRef.current[friendId] ?? DOWN), ...patch }
      linksRef.current = { ...linksRef.current, [friendId]: next }
      setLinks(linksRef.current)
      if (liveRef.current?.friendId === friendId) liveRef.current.transport.setLink(next)
    }

    const onMessage = (friendId: string, raw: unknown): void => {
      const msg = parseMessage(raw)
      if (!msg) {
        console.warn('[listen] ignored a malformed message')
        return
      }
      const live = liveRef.current
      if (msg.type !== 'invite') {
        if (live?.friendId === friendId) live.transport.deliver(msg)
        return
      }
      const me = meRef.current
      if (!me) return
      const route = routeInvite({ activeFriend: live?.friendId ?? null, status: live?.session.getState().status ?? 'idle' }, friendId)
      if (route === 'session') live?.transport.deliver(msg)
      else if (route === 'new') start(friendId)?.transport.deliver(msg)
      else window.phinas.listenSend(friendId, { type: 'decline', reason: 'busy', from: me, ts: Date.now() })
    }

    const onClosed = (friendId: string, reason: PairClosedReason): void => {
      setLink(friendId, DOWN)
      const live = liveRef.current
      // A friend who went offline gets the session's grace period; a refusal ends it now.
      if (reason !== 'not-allowed' || live?.friendId !== friendId) return
      if (live.session.getState().status === 'invited') live.session.decline()
      else live.session.end()
    }

    /** Another account (or none): forget every session and channel. */
    const reset = (): void => {
      stop()
      linksRef.current = {}
      setLinks({})
      setActive(null)
      setState(INITIAL_STATE)
    }

    return { start, stop, setLink, onMessage, onClosed, reset }
  }, [])

  useEffect(() => {
    const offs = [
      window.phinas.onListenMessage((e) => ops.onMessage(e.friendId, e.msg)),
      window.phinas.onListenPresence((e) => ops.setLink(e.friendId, { here: e.here })),
      window.phinas.onListenConnection((e) => ops.setLink(e.friendId, { up: e.up })),
      window.phinas.onListenClosed((e) => ops.onClosed(e.friendId, e.reason)),
      window.phinas.onAccountChanged(() => ops.reset())
    ]
    // Events fired before we subscribed are lost, so ask for the state of every open channel.
    void window.phinas
      .listenStatus()
      .then((all) => {
        for (const [id, s] of Object.entries(all)) ops.setLink(id, { up: s.connected, here: s.partnerHere })
      })
      .catch(() => undefined)
    return () => {
      offs.forEach((off) => off())
      ops.stop()
    }
  }, [ops])

  const activeName = active ? social.nameOf(active) : 'Teman'

  // Tell the main process about a new invite so it can notify outside the app.
  const notified = useRef(false)
  useEffect(() => {
    if (state.status !== 'invited') {
      notified.current = false
      return
    }
    if (notified.current) return
    notified.current = true
    window.phinas.notifyListenInvite(activeName)
  }, [state.status, activeName])

  const invite = (friendId: string): void => {
    const live = liveRef.current
    if (live && isBusy(live.session.getState().status)) return
    setNotice(null)
    // The global switch or a scope may have changed since the last fetch: ask the server first.
    void window.phinas
      .listFriends()
      .then((friends) => friends.find((f) => f.userId === friendId)?.canListen ?? false)
      .catch(() => true) // offline: the channel itself refuses when it is not allowed
      .then((allowed) => {
        if (!allowed) {
          setNotice(friendlyError(new Error('phinas:listen_not_allowed')))
          return
        }
        const cur = liveRef.current
        if (cur && isBusy(cur.session.getState().status)) return
        ops.start(friendId)?.session.invite()
      })
  }

  const api = useMemo<ListenApi>(() => {
    const busy = isBusy(state.status)
    const allowed = (f: Friend): boolean => f.canListen && social.online.has(f.userId)
    return {
      state,
      activeFriend: active,
      activeName,
      pendingInvite: state.status === 'invited' && active ? { friendId: active, name: activeName } : null,
      partner: social.partner,
      invitable: social.friends.filter(allowed),
      busy,
      notice,
      canInvite: (id) => {
        const f = social.friends.find((x) => x.userId === id)
        const l = links[id]
        return !busy && f !== undefined && allowed(f) && l !== undefined && l.up && l.here
      },
      invite,
      accept: () => liveRef.current?.session.accept(),
      decline: () => liveRef.current?.session.decline(),
      end: () => liveRef.current?.session.end(),
      dismissNotice: () => setNotice(null)
    }
    // `invite` only reads refs and stable setters, so it may be from any render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, active, activeName, social.partner, social.friends, social.online, links, notice])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
```

- [ ] **Step 12: Components on the new API**

Replace the whole of `src/renderer/src/components/ListenTogether.tsx` with:

```tsx
import { Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useListen } from '../sync/ListenTogetherProvider'
import { endedText, liveLabel } from '../sync/status'

/** Player bar button: invite the partner, cancel or end a session, and show how it is going. */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  const { status } = l.state
  const name = l.activeName

  if (status === 'active') {
    const label = liveLabel(l.state, name)
    return (
      <button className="icon-btn on listen-btn" onClick={l.end} title="Akhiri sesi" aria-label="Akhiri sesi dengar bareng">
        <Headphones size={18} />
        <span className="listen-label">
          {name} · {label}
        </span>
      </button>
    )
  }
  if (status === 'inviting') {
    return (
      <button className="icon-btn listen-btn" onClick={l.end} title="Batalkan ajakan" aria-label="Batalkan ajakan">
        <Headphones size={18} />
        <span className="listen-label">Menunggu {name}…</span>
      </button>
    )
  }
  const partner = l.partner
  if (!partner) return null
  const ready = l.canInvite(partner.userId)
  const reason = ready ? `Dengar bareng ${partner.name}` : `${partner.name} sedang offline`
  return (
    <button className="icon-btn listen-btn" onClick={() => l.invite(partner.userId)} disabled={!ready} title={reason} aria-label={reason}>
      <Headphones size={18} />
    </button>
  )
}

/** Shown at the top of the page: an incoming invite, a refusal, or why the last session ended. */
export function ListenBanner(): React.JSX.Element | null {
  const l = useListen()
  const { status, endReason } = l.state
  const [shownEnd, setShownEnd] = useState<EndReason | null>(null)

  useEffect(() => {
    if (status !== 'ended' || !endReason) return
    setShownEnd(endReason)
    const t = setTimeout(() => setShownEnd(null), 4000)
    return () => clearTimeout(t)
  }, [status, endReason])

  const { notice, dismissNotice } = l
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismissNotice, 4000)
    return () => clearTimeout(t)
    // dismissNotice is a new function on every render; the timer only follows the notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  if (l.pendingInvite) {
    return (
      <div className="notice listen-banner" role="alertdialog">
        <span>{l.pendingInvite.name} mengajak kamu dengar bareng.</span>
        <button className="listen-action" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-action" onClick={l.decline}>
          Tolak
        </button>
      </div>
    )
  }
  if (notice) {
    return (
      <div className="notice" role="status" onClick={dismissNotice}>
        {notice}
      </div>
    )
  }
  if (shownEnd) {
    return (
      <div className="notice" role="status" onClick={() => setShownEnd(null)}>
        {endedText(shownEnd, l.activeName)}
      </div>
    )
  }
  return null
}
```

In `src/renderer/src/components/NowPlaying.tsx`, replace:

```tsx
  const l = useListen()
  if (!l.available || l.state.status !== 'active') return null
  const name = l.partnerName ?? 'pasangan'
```

with:

```tsx
  const l = useListen()
  if (l.state.status !== 'active') return null
  const name = l.activeName
```

In `src/renderer/src/components/BerduaLine.tsx` (replaced by Beranda's online line in Task 11), replace:

```tsx
  const l = useListen()
  if (!l.available) return null
  const name = l.partnerName ?? 'Pasangan'
  const view = berduaView(l.state, name)
  const run: Record<BerduaAction, () => void> = {
    end: l.end,
    cancel: l.end,
    accept: l.accept,
    decline: l.decline,
    invite: l.invite
  }
```

with:

```tsx
  const l = useListen()
  const partner = l.partner
  if (!partner) return null
  const name = partner.name
  // The session may be with another friend; then this line only shows whether the partner is reachable.
  const mine = l.activeFriend === partner.userId
  const ready = l.canInvite(partner.userId)
  const view = berduaView(mine ? l.state : { status: 'idle', connected: true, partnerHere: ready, partnerError: false }, name)
  const run: Record<BerduaAction, () => void> = {
    end: l.end,
    cancel: l.end,
    accept: l.accept,
    decline: l.decline,
    invite: () => l.invite(partner.userId)
  }
```

In `src/renderer/src/components/ListenCard.tsx` (deleted in Task 8), replace:

```tsx
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'
```

with:

```tsx
  const l = useListen()
  const partner = l.partner
  if (!partner) return null
  const status = l.activeFriend === partner.userId ? l.state.status : 'idle'
  const connected = true
  const partnerHere = l.canInvite(partner.userId)
  const name = partner.name
```

and replace:

```tsx
      <button className="btn" onClick={l.invite} disabled={!connected || !partnerHere}>
```

with:

```tsx
      <button className="btn" onClick={() => l.invite(partner.userId)} disabled={!connected || !partnerHere}>
```

In `src/renderer/src/screens/TogetherView.tsx` (deleted in Task 8), replace:

```tsx
      {listen.available ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
```

with:

```tsx
      {listen.partner ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
```

and replace:

```tsx
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
```

with:

```tsx
      {listen.partner && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
```

In `src/renderer/src/components/Sidebar.tsx`, replace:

```tsx
          online={listen.available && listen.state.partnerHere}
```

with:

```tsx
          online={listen.invitable.some((f) => f.isPartner)}
```

- [ ] **Step 13: Check that nothing uses the old API**

Run: `grep -rnE "listenOpen|listenClose|ListenInfo|pairInfo|partnerName|\.available|ipcTransport" src tests`
Expected: no output.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all pass (including `pair-hub`, `pair-channel`, `listen-text`).

Run: `npm run build`
Expected: success.

- [ ] **Step 14: Commit**

The deletion of `ipcTransport.ts` is already staged by `git rm` in Step 11.

```bash
git add src/main/sync/pair-hub.ts tests/pair-hub.test.ts src/main/sync/realtime.ts src/shared/types.ts src/shared/ipc.ts src/preload/index.ts src/main/sync/supabase-remote.ts src/main/ipc.ts src/main/index.ts src/renderer/src/sync/ListenTogetherProvider.tsx src/renderer/src/sync/status.ts tests/listen-text.test.ts src/renderer/src/components/ListenTogether.tsx src/renderer/src/components/NowPlaying.tsx src/renderer/src/components/BerduaLine.tsx src/renderer/src/components/ListenCard.tsx src/renderer/src/screens/TogetherView.tsx src/renderer/src/components/Sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(listen): a pair channel per online friend, Listen Together with any of them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Welcome screen and the shared sign-in form

**Files:**
- Create: `src/renderer/src/components/AuthForm.tsx`
- Create: `src/renderer/src/screens/Welcome.tsx`
- Create: `src/renderer/src/styles/social.css`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/App.tsx`

The welcome screen shows on first launch when Supabase is configured and `welcomeDone` is not set (main sets it after a sign-in or sign-up, and at start for anyone already signed in). Profil keeps its own form until Task 15 replaces it with a link to Teman.

- [ ] **Step 1: The form**

Create `src/renderer/src/components/AuthForm.tsx`:

```tsx
import { useState, type FormEvent, type MouseEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { LegalPage } from '../../../shared/links'

export type AuthMode = 'in' | 'up'

/** "Syarat & Ketentuan dan Kebijakan Privasi", opened in the browser. */
export function LegalLinks(): React.JSX.Element {
  const open =
    (page: LegalPage) =>
    (e: MouseEvent): void => {
      e.preventDefault()
      void window.phinas.openLegal(page)
    }
  return (
    <>
      <a href="#" onClick={open('terms')}>
        Syarat &amp; Ketentuan
      </a>{' '}
      dan{' '}
      <a href="#" onClick={open('privacy')}>
        Kebijakan Privasi
      </a>
    </>
  )
}

interface Props {
  mode: AuthMode
  onMode: (mode: AuthMode) => void
  /** After a successful sign-in or sign-up; the main process has already opened that account's library. */
  onDone: () => void
}

/** Sign in, or sign up with an invite code. Shared by the welcome screen and Teman. */
export function AuthForm({ mode, onMode, onDone }: Props): React.JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'up') {
        await window.phinas.syncSignUp({ email, password, displayName, inviteCode, acceptedTerms: accepted })
      } else {
        await window.phinas.syncSignIn(email, password)
      }
      setPassword('')
      setInviteCode('')
      onDone()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === 'up' && (
        <>
          <input
            className="field"
            placeholder="Kode undangan"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            aria-label="Kode undangan"
            required
            autoFocus
          />
          <input
            className="field"
            placeholder="Nama"
            value={displayName}
            maxLength={30}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-label="Nama"
            required
          />
        </>
      )}
      <input
        className="field"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email"
        required
        autoFocus={mode === 'in'}
      />
      <input
        className="field"
        type="password"
        placeholder="Password"
        value={password}
        minLength={mode === 'up' ? 6 : undefined}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
        required
      />
      {mode === 'up' && (
        <label className="auth-check">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
          <span>
            Saya setuju dengan <LegalLinks />.
          </span>
        </label>
      )}
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <div className="auth-actions">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Sebentar…' : mode === 'up' ? 'Daftar' : 'Masuk'}
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setError(null)
            onMode(mode === 'up' ? 'in' : 'up')
          }}
        >
          {mode === 'up' ? 'Sudah punya akun? Masuk' : 'Punya kode undangan? Daftar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: The welcome screen**

Create `src/renderer/src/screens/Welcome.tsx`:

```tsx
import { useState } from 'react'
import { AuthForm, LegalLinks, type AuthMode } from '../components/AuthForm'

/** First launch: sign up, sign in, or go on without an account. Covers the whole window. */
export function Welcome({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [mode, setMode] = useState<AuthMode | null>(null)

  const skip = async (): Promise<void> => {
    await window.phinas.finishWelcome().catch(() => undefined)
    onDone()
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Selamat datang">
      <div className="welcome-drag" aria-hidden="true" />
      <div className="welcome-body">
        <h1 className="welcome-title">
          Selamat datang di <em>Phinas.</em>
        </h1>
        <p className="welcome-line">Dengar musik bareng teman dan pasanganmu.</p>
        {mode === null ? (
          <div className="welcome-actions">
            <button className="btn" onClick={() => setMode('up')}>
              Punya kode undangan? Daftar
            </button>
            <button className="btn secondary" onClick={() => setMode('in')}>
              Sudah punya akun? Masuk
            </button>
            <button className="text-link" onClick={() => void skip()}>
              Pakai tanpa akun
            </button>
          </div>
        ) : (
          <>
            <AuthForm mode={mode} onMode={setMode} onDone={onDone} />
            <button className="text-link welcome-back" onClick={() => setMode(null)}>
              Kembali
            </button>
          </>
        )}
        <p className="welcome-legal small muted">
          <LegalLinks />
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Styles**

Create `src/renderer/src/styles/social.css`:

```css
/* Social screens: welcome, sign-in form, Teman, friend profile, sidebar groups, online line, pickers. */

/* ---------- welcome ---------- */
.welcome { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 48px 24px; background: linear-gradient(180deg, var(--wash) 0%, var(--paper) 55%), var(--paper); }
.welcome-drag { position: fixed; top: 0; left: 0; right: 0; height: 40px; -webkit-app-region: drag; }
.welcome-body { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; width: 100%; max-width: 420px; }
.welcome-title { font-family: var(--serif); font-size: 52px; font-weight: 400; line-height: 0.95; letter-spacing: -0.01em; }
.welcome-title em { font-style: italic; color: var(--accent); }
.welcome-line { margin: 0 0 10px; font-size: 14px; color: var(--ink-soft); }
.welcome-actions { display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: 100%; max-width: 320px; }
.welcome-actions .text-link { align-self: flex-start; margin-top: 6px; }
.welcome-back { margin-top: 4px; }
.welcome-legal { margin-top: 18px; }

/* ---------- sign-in / sign-up form ---------- */
.auth-form { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 320px; }
.auth-form .notice { margin: 4px 0 0; cursor: default; }
.auth-check { display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: var(--ink-soft); }
.auth-check input { margin-top: 3px; accent-color: var(--accent); }
.auth-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 4px; }
```

In `src/renderer/src/main.tsx`, replace:

```tsx
import './styles/profile.css'
```

with:

```tsx
import './styles/profile.css'
import './styles/social.css'
```

- [ ] **Step 4: Show it on first launch**

In `src/renderer/src/App.tsx`:

Replace:

```tsx
import { Profile } from './screens/Profile'
```

with:

```tsx
import { Profile } from './screens/Profile'
import { Welcome } from './screens/Welcome'
```

Replace:

```tsx
  const mainRef = useRef<HTMLElement>(null)
```

with:

```tsx
  const mainRef = useRef<HTMLElement>(null)
  // First launch: the welcome screen until the user signs in or goes on without an account.
  const [welcome, setWelcome] = useState(false)
  useEffect(() => {
    window.phinas
      .syncStatus()
      .then((s) => setWelcome(s.configured && !s.welcomeDone))
      .catch(() => undefined)
  }, [])
```

Replace:

```tsx
      {lyricsFull && <LyricsFull onClose={() => setLyricsFull(false)} />}
```

with:

```tsx
      {lyricsFull && <LyricsFull onClose={() => setLyricsFull(false)} />}
      {welcome && <Welcome onDone={() => setWelcome(false)} />}
```

- [ ] **Step 5: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/AuthForm.tsx src/renderer/src/screens/Welcome.tsx src/renderer/src/styles/social.css src/renderer/src/main.tsx src/renderer/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(social): welcome screen and a shared sign-in form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Teman page

**Files:**
- Create: `src/renderer/src/social/text.ts`
- Create: `tests/social-text.test.ts`
- Create: `src/renderer/src/screens/FriendsView.tsx`
- Modify: `src/renderer/src/views.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/screens/Home.tsx`
- Modify: `src/renderer/src/styles/social.css`
- Delete: `src/renderer/src/screens/TogetherView.tsx`, `src/renderer/src/components/ListenCard.tsx`

Spec §1 "Teman". The partner request rows live in the Pasangan section: the partner (if any) and every friend with an open partner request ("ingin jadi pasanganmu" → Terima / Tolak; "Menunggu…" → Batalkan via `endPartner`, which clears the request).

- [ ] **Step 1: Failing text tests**

Create `tests/social-text.test.ts`:

```ts
import { expect, test } from 'vitest'
import { friendStatusText, inviteState, inviteText } from '../src/renderer/src/social/text'
import type { InviteCode } from '../src/shared/types'

const inv = (o: Partial<InviteCode> = {}): InviteCode => ({
  code: 'ABCD2345',
  createdAt: '2026-11-20T00:00:00Z',
  expiresAt: '2026-12-04T00:00:00Z',
  usedAt: null,
  usedByName: null,
  revoked: false,
  ...o
})
const NOW = Date.parse('2026-11-20T12:00:00Z')

test('an open code counts the days it has left, rounded up', () => {
  expect(inviteState(inv(), NOW)).toEqual({ kind: 'active', daysLeft: 14 })
  expect(inviteText(inviteState(inv(), NOW))).toBe('aktif · berlaku 14 hari lagi')
})

test('a used code names who used it, even after it would have expired', () => {
  const used = inv({ usedAt: '2026-11-21T00:00:00Z', usedByName: 'Sari' })
  expect(inviteText(inviteState(used, Date.parse('2027-01-01T00:00:00Z')))).toBe('dipakai oleh Sari')
})

test('expired and revoked codes', () => {
  expect(inviteText(inviteState(inv(), Date.parse('2026-12-05T00:00:00Z')))).toBe('kedaluwarsa')
  expect(inviteText(inviteState(inv({ revoked: true }), NOW))).toBe('dicabut')
})

test("a friend's status", () => {
  expect(friendStatusText(true, false)).toBe('online')
  expect(friendStatusText(false, false)).toBe('offline')
  expect(friendStatusText(true, true)).toBe('online · bareng kamu')
})
```

Run: `npx vitest run tests/social-text.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: The texts**

Create `src/renderer/src/social/text.ts`:

```ts
import type { InviteCode } from '../../../shared/types'

export type InviteState =
  | { kind: 'active'; daysLeft: number }
  | { kind: 'used'; by: string }
  | { kind: 'expired' }
  | { kind: 'revoked' }

const DAY_MS = 86_400_000

/** Where an invite code stands at `now`. A used code stays "used" whatever happens to it later. */
export function inviteState(i: InviteCode, now: number): InviteState {
  if (i.usedAt) return { kind: 'used', by: i.usedByName ?? 'seseorang' }
  if (i.revoked) return { kind: 'revoked' }
  const left = Date.parse(i.expiresAt) - now
  if (left <= 0) return { kind: 'expired' }
  return { kind: 'active', daysLeft: Math.ceil(left / DAY_MS) }
}

export function inviteText(s: InviteState): string {
  switch (s.kind) {
    case 'active':
      return `aktif · berlaku ${s.daysLeft} hari lagi`
    case 'used':
      return `dipakai oleh ${s.by}`
    case 'expired':
      return 'kedaluwarsa'
    case 'revoked':
      return 'dicabut'
  }
}

/** The status after a friend's name. */
export function friendStatusText(online: boolean, withYou: boolean): string {
  if (withYou) return 'online · bareng kamu'
  return online ? 'online' : 'offline'
}
```

Run: `npx vitest run tests/social-text.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3: The page**

Create `src/renderer/src/screens/FriendsView.tsx`:

```tsx
import { Heart } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { Friend, InviteCode } from '../../../shared/types'
import { AuthForm, type AuthMode } from '../components/AuthForm'
import { useSocial } from '../social/SocialProvider'
import { friendStatusText, inviteState, inviteText } from '../social/text'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

/** Where an action's error shows: under the part of the page that caused it. */
type Section = 'top' | 'partner' | 'requests' | 'invites'

const num = (i: number): string => String(i + 1).padStart(2, '0')

/** Copies to the clipboard; false when the system refused (the code is on screen anyway). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** A friend's name. */
function FriendName({ friend }: { friend: Friend; nav: Nav }): React.JSX.Element {
  return <span className="fr-name">{friend.name}</span>
}

/** Teman: sign in when signed out; otherwise friend code, partner, requests, friends and invites. */
export function FriendsView({ nav }: { nav: Nav }): React.JSX.Element {
  const social = useSocial()
  if (!social.loaded) return <h1 className="page-title">Teman</h1>
  if (!social.configured) {
    return (
      <>
        <h1 className="page-title">Teman</h1>
        <p className="muted">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</p>
      </>
    )
  }
  return social.signedIn ? <SignedIn nav={nav} /> : <SignedOut />
}

function SignedOut(): React.JSX.Element {
  const social = useSocial()
  const [mode, setMode] = useState<AuthMode>('in')
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    window.phinas
      .syncStatus()
      .then((s) => setClaimed(s.libraryClaimed))
      .catch(() => undefined)
  }, [])

  return (
    <div className="friends">
      <h1 className="page-title">Teman</h1>
      <p className="muted">Masuk untuk berteman dan dengar bareng.</p>
      {claimed && <div className="notice">Playlist dan lagu yang kamu sukai tersimpan di akunmu. Masuk lagi untuk melihatnya.</div>}
      <section className="sec fr-auth">
        <AuthForm mode={mode} onMode={setMode} onDone={() => void social.refresh()} />
      </section>
    </div>
  )
}

function SignedIn({ nav }: { nav: Nav }): React.JSX.Element {
  const social = useSocial()
  const listen = useListen()
  const { me, friends, requests, online, offline, partner } = social
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({})
  const [working, setWorking] = useState(false)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [invites, setInvites] = useState<InviteCode[]>([])
  const disabled = offline || working

  const loadInvites = useCallback(async () => {
    try {
      setInvites(await window.phinas.listMyInvites())
    } catch {
      // offline: keep the last list
    }
  }, [])

  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  /** Runs an action, shows its error under its own section, then reloads the lists. */
  const run = async (section: Section, action: () => Promise<unknown>): Promise<boolean> => {
    setErrors((e) => ({ ...e, [section]: undefined }))
    setWorking(true)
    try {
      await action()
      await social.refresh()
      return true
    } catch (err) {
      setErrors((e) => ({ ...e, [section]: friendlyError(err) }))
      return false
    } finally {
      setWorking(false)
    }
  }

  const copy = async (text: string): Promise<void> => {
    if (!(await copyText(text))) return
    setCopied(text)
    setTimeout(() => setCopied((c) => (c === text ? null : c)), 2000)
  }

  const sendRequest = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    if (await run('top', () => window.phinas.sendFriendRequest(c))) {
      setCode('')
      setAdding(false)
    }
  }

  const createInvite = async (): Promise<void> => {
    let created = ''
    const ok = await run('top', async () => {
      created = await window.phinas.createInvite()
    })
    if (!ok) return
    await loadInvites()
    await copy(created)
  }

  const err = (s: Section): React.JSX.Element | null =>
    errors[s] ? (
      <div className="notice" role="alert">
        {errors[s]}
      </div>
    ) : null
  const isOnline = (f: Friend): boolean => online.has(f.userId)
  const withYou = (f: Friend): boolean => listen.activeFriend === f.userId && listen.state.status === 'active'
  const partnerAsks = friends.filter((f) => !f.isPartner && f.partnerRequest !== null)
  const others = friends.filter((f) => !f.isPartner)
  const incoming = requests.filter((r) => r.incoming)
  const outgoing = requests.filter((r) => !r.incoming)
  const canInviteMore = me !== null && (me.invitesLeft === null || me.invitesLeft > 0)
  const now = Date.now()

  return (
    <div className="friends">
      <h1 className="page-title">
        Teman <em>kamu</em>
      </h1>
      {offline && (
        <div className="notice">Tidak terhubung. Ini daftar temanmu yang terakhir tersimpan; aksi bisa dipakai lagi setelah tersambung.</div>
      )}

      <div className="fr-top">
        <span className="label">Kode temanmu</span>
        <strong className="fr-code">{me?.friendCode ?? '…'}</strong>
        <button className="text-link" onClick={() => me && void copy(me.friendCode)} disabled={!me}>
          {me && copied === me.friendCode ? 'Tersalin' : 'Salin'}
        </button>
        <span className="fr-spacer" />
        <button className="btn secondary" onClick={() => setAdding((a) => !a)} disabled={disabled} aria-expanded={adding}>
          Tambah teman
        </button>
        <button className="btn secondary" onClick={() => void createInvite()} disabled={disabled || !canInviteMore}>
          Undang
        </button>
        {me && me.invitesLeft !== null && <span className="small muted">{me.invitesLeft} tersisa</span>}
      </div>
      {adding && (
        <form className="fr-add" onSubmit={sendRequest}>
          <input
            className="field"
            placeholder="Kode teman, mis. PHN-7K2Q9M"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            aria-label="Kode teman"
            autoFocus
          />
          <button className="btn" type="submit" disabled={disabled || !code.trim()}>
            Kirim
          </button>
        </form>
      )}
      {err('top')}

      {(partner || partnerAsks.length > 0) && (
        <section className="sec">
          <h2 className="section-title">Pasangan</h2>
          {partner && (
            <div className="fr-row">
              <Heart className="fr-heart" size={13} fill="currentColor" aria-label="Pasangan" />
              <span className={`online-dot${isOnline(partner) ? '' : ' off'}`} aria-hidden="true" />
              <FriendName friend={partner} nav={nav} />
              <span className="fr-status">{friendStatusText(isOnline(partner), withYou(partner))}</span>
              <span className="fr-spacer" />
              {partner.canListen && !withYou(partner) && (
                <button className="text-link" onClick={() => listen.invite(partner.userId)} disabled={!listen.canInvite(partner.userId)}>
                  Dengar bareng
                </button>
              )}
            </div>
          )}
          {partnerAsks.map((f) => (
            <div key={f.userId} className="fr-row">
              <Heart className="fr-heart" size={13} aria-hidden="true" />
              <FriendName friend={f} nav={nav} />
              <span className="fr-status">{f.partnerRequest === 'incoming' ? 'ingin jadi pasanganmu' : 'Menunggu…'}</span>
              <span className="fr-spacer" />
              {f.partnerRequest === 'incoming' ? (
                <>
                  <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.respondPartner(f.friendshipId, true))}>
                    Terima
                  </button>
                  <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.respondPartner(f.friendshipId, false))}>
                    Tolak
                  </button>
                </>
              ) : (
                <button className="text-link" disabled={disabled} onClick={() => void run('partner', () => window.phinas.endPartner(f.friendshipId))}>
                  Batalkan
                </button>
              )}
            </div>
          ))}
          {err('partner')}
        </section>
      )}

      {requests.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Permintaan</h2>
          {incoming.map((r) => (
            <div key={r.friendshipId} className="fr-row">
              <span className="fr-text">
                <strong>{r.name}</strong> ingin berteman
              </span>
              <span className="fr-spacer" />
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.respondFriendRequest(r.friendshipId, true))}>
                Terima
              </button>
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.respondFriendRequest(r.friendshipId, false))}>
                Tolak
              </button>
            </div>
          ))}
          {outgoing.map((r) => (
            <div key={r.friendshipId} className="fr-row">
              <span className="fr-text">
                Menunggu <strong>{r.name}</strong>
              </span>
              <span className="fr-spacer" />
              <button className="text-link" disabled={disabled} onClick={() => void run('requests', () => window.phinas.removeFriend(r.friendshipId))}>
                Batalkan
              </button>
            </div>
          ))}
          {err('requests')}
        </section>
      )}

      <section className="sec">
        <h2 className="section-title">Teman</h2>
        {others.length === 0 && <p className="muted">Belum ada teman. Bagikan kode temanmu, atau undang seseorang dengan kode undangan.</p>}
        <ol className="fr-list">
          {others.map((f, i) => (
            <li key={f.userId} className="fr-row">
              <span className="fr-num">{num(i)}</span>
              <span className={`online-dot${isOnline(f) ? '' : ' off'}`} aria-hidden="true" />
              <FriendName friend={f} nav={nav} />
              <span className="fr-status">{friendStatusText(isOnline(f), withYou(f))}</span>
              <span className="fr-spacer" />
              {isOnline(f) && f.canListen && !withYou(f) && (
                <button className="text-link" onClick={() => listen.invite(f.userId)} disabled={!listen.canInvite(f.userId)}>
                  Ajak
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {invites.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Undangan</h2>
          {invites.map((inv) => {
            const st = inviteState(inv, now)
            return (
              <div key={inv.code} className="fr-row">
                <strong className="fr-code">{inv.code}</strong>
                <span className="fr-status">{inviteText(st)}</span>
                <span className="fr-spacer" />
                {st.kind === 'active' && (
                  <>
                    <button className="text-link" onClick={() => void copy(inv.code)}>
                      {copied === inv.code ? 'Tersalin' : 'Salin'}
                    </button>
                    <button
                      className="text-link"
                      disabled={disabled}
                      onClick={() =>
                        void run('invites', async () => {
                          await window.phinas.revokeInvite(inv.code)
                          await loadInvites()
                        })
                      }
                    >
                      Cabut
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {err('invites')}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Route it instead of Berdua**

In `src/renderer/src/views.ts`, replace:

```ts
  | { name: 'together' }
```

with:

```ts
  | { name: 'friends' }
```

In `src/renderer/src/App.tsx`, replace:

```tsx
import { TogetherView } from './screens/TogetherView'
```

with:

```tsx
import { FriendsView } from './screens/FriendsView'
```

and replace:

```tsx
      case 'together':
        return <TogetherView nav={nav} />
```

with:

```tsx
      case 'friends':
        return <FriendsView nav={nav} />
```

In `src/renderer/src/components/Sidebar.tsx`, replace:

```tsx
        <NavItem
          label="Berdua"
          icon={Users}
          active={view.name === 'together'}
          online={listen.invitable.some((f) => f.isPartner)}
          onClick={() => nav({ name: 'together' })}
        />
```

with:

```tsx
        <NavItem label="Teman" icon={Users} active={view.name === 'friends'} onClick={() => nav({ name: 'friends' })} />
```

In `src/renderer/src/screens/Home.tsx`, replace:

```tsx
      <BerduaLine onOpen={() => nav({ name: 'together' })} />
```

with:

```tsx
      <BerduaLine onOpen={() => nav({ name: 'friends' })} />
```

Delete the old Berdua page and its card:

```bash
git rm src/renderer/src/screens/TogetherView.tsx src/renderer/src/components/ListenCard.tsx
```

- [ ] **Step 5: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- Teman ---------- */
.friends { max-width: 760px; }
.fr-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding-bottom: 22px; }
.fr-code { font-family: var(--serif); font-size: 18px; font-weight: 400; letter-spacing: 0.04em; user-select: text; }
.fr-row .fr-code { font-size: 15px; }
.fr-spacer { flex: 1; }
.fr-add { display: flex; gap: 8px; max-width: 420px; margin: -8px 0 22px; }
.fr-list { list-style: none; margin: 0 0 16px; padding: 0; }
.fr-row { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.fr-row .text-link { font-size: 12px; }
.fr-num { width: 22px; flex: none; font-family: var(--serif); font-size: 15px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.fr-name { padding: 0; font-weight: 700; color: var(--ink); text-align: left; }
button.fr-name:hover { color: var(--accent); }
.fr-status, .fr-text { font-size: 12px; color: var(--ink-soft); }
.fr-text strong { color: var(--ink); }
.fr-heart { flex: none; color: var(--accent); }
.fr-auth { padding-top: 22px; }
```

- [ ] **Step 6: Check**

Run: `grep -rn "'together'\|TogetherView\|ListenCard" src`
Expected: no output.

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 7: Commit**

The deletions are already staged by `git rm`.

```bash
git add src/renderer/src/social/text.ts tests/social-text.test.ts src/renderer/src/screens/FriendsView.tsx src/renderer/src/views.ts src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/screens/Home.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(social): Teman page replaces Berdua

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Friend profile and the friend-playlist view

**Files:**
- Create: `src/renderer/src/social/playlistCache.ts`
- Create: `src/renderer/src/screens/FriendView.tsx`
- Rename + rewrite: `src/renderer/src/screens/PartnerView.tsx` → `src/renderer/src/screens/FriendPlaylistView.tsx`
- Rewrite: `src/renderer/src/library/LibraryProvider.tsx`
- Modify: `src/renderer/src/views.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/screens/Home.tsx`
- Modify: `src/renderer/src/screens/Profile.tsx`
- Modify: `src/renderer/src/screens/FriendsView.tsx`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/sync/supabase-remote.ts`
- Modify: `src/renderer/src/styles/social.css`

The `partner` view becomes `friendPlaylist`; the library's `partner` list becomes `friends` (all friends' shared playlists, from `listFriendPlaylists()`); the bridge IPC `listPartnerPlaylists` goes away and `copyPartnerPlaylist` becomes `copyFriendPlaylist`. Public playlists (Task 14) are not in `lib.friends`, so screens that open one first hand it to a small in-memory cache.

- [ ] **Step 1: IPC rename**

In `src/shared/ipc.ts`, replace:

```ts
  /** The partner's playlists (Berdua tab). Renamed in the redesign. */
  listPartnerPlaylists(): Promise<PartnerPlaylist[]>
  copyPartnerPlaylist(playlist: PartnerPlaylist): Promise<Playlist>
```

with:

```ts
  /** Copies a friend's or a public playlist into the local library as a new playlist. */
  copyFriendPlaylist(playlist: PartnerPlaylist): Promise<Playlist>
```

and in `CHANNEL_MAP` replace:

```ts
  listPartnerPlaylists: true,
  copyPartnerPlaylist: true,
```

with:

```ts
  copyFriendPlaylist: true,
```

In `src/main/ipc.ts`, delete the line:

```ts
    listPartnerPlaylists: async () => requireRemote().listPartnerPlaylists(),
```

and replace:

```ts
    copyPartnerPlaylist: async (p) => {
```

with:

```ts
    copyFriendPlaylist: async (p) => {
```

In `src/main/sync/supabase-remote.ts`, delete:

```ts
  /** Bridge for the Berdua tab until the redesign: the partner's playlists. */
  async listPartnerPlaylists(): Promise<PartnerPlaylist[]> {
    const partner = (await this.listFriends()).find((f) => f.isPartner);
    return partner ? this.listFriendPlaylists(partner.userId) : [];
  }
```

- [ ] **Step 2: Views**

In `src/renderer/src/views.ts`, replace:

```ts
  | { name: 'friends' }
```

with:

```ts
  | { name: 'friends' }
  /** A friend's profile; `id` is their user id. */
  | { name: 'friend'; id: string }
```

and replace:

```ts
  | { name: 'partner'; id: string }
```

with:

```ts
  /** A friend's shared playlist or a public one (read-only). */
  | { name: 'friendPlaylist'; id: string }
```

- [ ] **Step 3: Library provider with friends' playlists**

Replace the whole of `src/renderer/src/library/LibraryProvider.tsx` with:

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PartnerPlaylist, Playlist, Track } from '../../../shared/types'

interface LibraryApi {
  playlists: Playlist[]
  likes: Track[]
  /** Playlists friends share with me (DARI TEMAN), newest first. Empty when signed out. */
  friends: PartnerPlaylist[]
  refresh(): Promise<void>
  refreshFriends(): Promise<void>
}

const Ctx = createContext<LibraryApi | null>(null)

export function useLibrary(): LibraryApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLibrary must be used inside LibraryProvider')
  return v
}

const FRIENDS_REFRESH_MS = 60_000

/** One shared copy of the library so every screen and the sidebar stay in step. */
export function LibraryProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likes, setLikes] = useState<Track[]>([])
  const [friends, setFriends] = useState<PartnerPlaylist[]>([])

  const refresh = useCallback(async () => {
    const [p, l] = await Promise.all([window.phinas.listPlaylists(), window.phinas.listLikes()])
    setPlaylists(p)
    setLikes(l)
  }, [])

  const refreshFriends = useCallback(async () => {
    try {
      const status = await window.phinas.syncStatus()
      setFriends(status.signedIn ? await window.phinas.listFriendPlaylists() : [])
    } catch {
      // offline: keep the last list
    }
  }, [])

  useEffect(() => {
    void refresh()
    void refreshFriends()
    const t = setInterval(() => void refreshFriends(), FRIENDS_REFRESH_MS)
    // Another account means another library file and other friends.
    const off = window.phinas.onAccountChanged(() => {
      void refresh()
      void refreshFriends()
    })
    return () => {
      clearInterval(t)
      off()
    }
  }, [refresh, refreshFriends])

  const api = useMemo(() => ({ playlists, likes, friends, refresh, refreshFriends }), [playlists, likes, friends, refresh, refreshFriends])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
```

In `src/renderer/src/screens/Profile.tsx`, replace all three occurrences of `lib.refreshPartner()` with `lib.refreshFriends()` (Edit with replace-all; indentation unchanged). Then run `grep -n refreshPartner src/renderer/src/screens/Profile.tsx` and expect no output.

- [ ] **Step 4: The playlist cache**

Create `src/renderer/src/social/playlistCache.ts`:

```ts
import type { PartnerPlaylist } from '../../../shared/types'

const seen = new Map<string, PartnerPlaylist>()

/** Keeps a friend's or public playlist so the playlist screen can open it by id. */
export function rememberPlaylist(p: PartnerPlaylist): void {
  seen.set(p.id, p)
}

export function rememberedPlaylist(id: string): PartnerPlaylist | undefined {
  return seen.get(id)
}
```

- [ ] **Step 5: The friend-playlist view**

```bash
git mv src/renderer/src/screens/PartnerView.tsx src/renderer/src/screens/FriendPlaylistView.tsx
```

Replace the whole of `src/renderer/src/screens/FriendPlaylistView.tsx` with:

```tsx
import { CopyPlus } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { rememberedPlaylist } from '../social/playlistCache'
import type { Nav } from '../views'

/** A friend's shared playlist or a public one: read-only, with "Salin ke library saya". */
export function FriendPlaylistView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const pl = lib.friends.find((p) => p.id === id) ?? rememberedPlaylist(id)

  if (!pl) return <p className="muted">Playlist ini tidak tersedia.</p>

  const copy = async (): Promise<void> => {
    const c = await window.phinas.copyFriendPlaylist(pl)
    await lib.refresh()
    nav({ name: 'playlist', id: c.id })
  }

  return (
    <>
      <CollectionHeader
        cover={<PlaylistCover covers={pl.coverUrls} />}
        kind={`Playlist dari ${pl.ownerName}`}
        title={pl.name}
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="btn secondary" onClick={copy}>
          <CopyPlus size={13} /> Salin ke library saya
        </button>
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
```

- [ ] **Step 6: The friend profile**

Create `src/renderer/src/screens/FriendView.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { PartnerPlaylist } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import { PlaylistCover } from '../components/PlaylistCover'
import { rememberPlaylist } from '../social/playlistCache'
import { useSocial } from '../social/SocialProvider'
import { friendStatusText } from '../social/text'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

/** A friend: online state, Listen Together, partner actions, remove, and their shared playlists. */
export function FriendView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const social = useSocial()
  const listen = useListen()
  const [lists, setLists] = useState<PartnerPlaylist[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let alive = true
    window.phinas
      .listFriendPlaylists(id)
      .then((p) => {
        if (!alive) return
        p.forEach(rememberPlaylist)
        setLists(p)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [id])

  const friend = social.friends.find((f) => f.userId === id)
  if (!friend) return <p className="muted">{social.loaded ? 'Orang ini tidak ada di daftar temanmu.' : 'Memuat…'}</p>

  const online = social.online.has(id)
  const withYou = listen.activeFriend === id && listen.state.status === 'active'
  const disabled = social.offline || working

  /** Runs an action and reloads the lists; the error shows under the header. */
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setError(null)
    setWorking(true)
    try {
      await action()
      await social.refresh()
      return true
    } catch (e) {
      setError(friendlyError(e))
      return false
    } finally {
      setWorking(false)
    }
  }

  const removeFriend = async (): Promise<void> => {
    if (!window.confirm(`Hapus ${friend.name} dari temanmu? Kalian tidak bisa melihat playlist satu sama lain lagi.`)) return
    if (await run(() => window.phinas.removeFriend(friend.friendshipId))) nav({ name: 'friends' })
  }

  const endPartner = async (): Promise<void> => {
    if (!window.confirm(`Akhiri pasangan dengan ${friend.name}? Kalian tetap berteman.`)) return
    await run(() => window.phinas.endPartner(friend.friendshipId))
  }

  let partnerButtons: React.ReactNode = null
  if (friend.isPartner) {
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void endPartner()}>
        Akhiri pasangan
      </button>
    )
  } else if (friend.partnerRequest === 'incoming') {
    partnerButtons = (
      <>
        <button className="btn" disabled={disabled} onClick={() => void run(() => window.phinas.respondPartner(friend.friendshipId, true))}>
          Terima jadi pasangan
        </button>
        <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.respondPartner(friend.friendshipId, false))}>
          Tolak
        </button>
      </>
    )
  } else if (friend.partnerRequest === 'outgoing') {
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.endPartner(friend.friendshipId))}>
        Menunggu jawaban · Batalkan
      </button>
    )
  } else if (!social.partner) {
    // With a partner already, asking would only fail with "partner_taken".
    partnerButtons = (
      <button className="btn secondary" disabled={disabled} onClick={() => void run(() => window.phinas.requestPartner(friend.friendshipId))}>
        Jadikan pasangan
      </button>
    )
  }

  return (
    <>
      <CollectionHeader
        cover={
          <div className="fr-avatar" aria-hidden="true">
            {(friend.name.trim()[0] ?? '?').toUpperCase()}
          </div>
        }
        kind={friend.isPartner ? 'Pasangan' : 'Teman'}
        title={friend.name}
        meta={friendStatusText(online, withYou)}
        tracks={[]}
      >
        {online && friend.canListen && !withYou && (
          <button className="btn" disabled={!listen.canInvite(id)} onClick={() => listen.invite(id)}>
            Ajak dengar bareng
          </button>
        )}
        {partnerButtons}
        <button className="btn secondary" disabled={disabled} onClick={() => void removeFriend()}>
          Hapus teman
        </button>
      </CollectionHeader>
      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}
      <section className="sec">
        <h2 className="section-title">Playlist</h2>
        {failed ? (
          <p className="muted">Tidak bisa memuat playlist. Cek koneksi internetmu.</p>
        ) : lists === null ? (
          <CoverGridSkeleton count={4} />
        ) : lists.length === 0 ? (
          <p className="muted">Belum membagikan playlist.</p>
        ) : (
          <CoverGrid
            items={lists.map((p) => ({
              key: p.id,
              art: <PlaylistCover covers={p.coverUrls} />,
              title: p.name,
              meta: `${p.tracks.length} lagu`,
              onOpen: () => nav({ name: 'friendPlaylist', id: p.id })
            }))}
          />
        )}
      </section>
    </>
  )
}
```

- [ ] **Step 7: Routes and links**

In `src/renderer/src/App.tsx`, replace:

```tsx
import { PartnerView } from './screens/PartnerView'
```

with:

```tsx
import { FriendPlaylistView } from './screens/FriendPlaylistView'
import { FriendView } from './screens/FriendView'
```

and replace:

```tsx
      case 'partner':
        return <PartnerView id={view.id} nav={nav} />
```

with:

```tsx
      case 'friendPlaylist':
        return <FriendPlaylistView key={view.id} id={view.id} nav={nav} />
      case 'friend':
        return <FriendView key={view.id} id={view.id} nav={nav} />
```

In `src/renderer/src/components/Sidebar.tsx`, replace:

```tsx
        <NavItem label="Teman" icon={Users} active={view.name === 'friends'} onClick={() => nav({ name: 'friends' })} />
```

with:

```tsx
        <NavItem
          label="Teman"
          icon={Users}
          active={view.name === 'friends' || view.name === 'friend'}
          onClick={() => nav({ name: 'friends' })}
        />
```

and replace:

```tsx
        {lib.partner.length > 0 && <div className="label nav-group">Dari pasangan</div>}
        {lib.partner.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            covers={p.coverUrls}
            active={sameView(view, { name: 'partner', id: p.id })}
            onClick={() => nav({ name: 'partner', id: p.id })}
          />
        ))}
```

with:

```tsx
        {lib.friends.length > 0 && <div className="label nav-group">Dari teman</div>}
        {lib.friends.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            covers={p.coverUrls}
            active={sameView(view, { name: 'friendPlaylist', id: p.id })}
            onClick={() => nav({ name: 'friendPlaylist', id: p.id })}
          />
        ))}
```

In `src/renderer/src/screens/Home.tsx`, replace:

```tsx
/** Own playlists first, then the partner's, in one row of covers. */
```

with:

```tsx
/** Own playlists first, then friends', in one row of covers. */
```

and replace:

```tsx
    ...lib.partner.map((p) => ({
      key: `partner-${p.id}`,
      title: p.name,
      meta: `Dari ${p.ownerName}`,
      art: <PlaylistCover covers={p.coverUrls} />,
      onOpen: () => nav({ name: 'partner', id: p.id })
    }))
```

with:

```tsx
    ...lib.friends.map((p) => ({
      key: `friend-${p.id}`,
      title: p.name,
      meta: `Dari ${p.ownerName}`,
      art: <PlaylistCover covers={p.coverUrls} />,
      onOpen: () => nav({ name: 'friendPlaylist', id: p.id })
    }))
```

In `src/renderer/src/screens/FriendsView.tsx`, replace:

```tsx
/** A friend's name. */
function FriendName({ friend }: { friend: Friend; nav: Nav }): React.JSX.Element {
  return <span className="fr-name">{friend.name}</span>
}
```

with:

```tsx
/** A friend's name; opens their profile. */
function FriendName({ friend, nav }: { friend: Friend; nav: Nav }): React.JSX.Element {
  return (
    <button className="fr-name" onClick={() => nav({ name: 'friend', id: friend.userId })}>
      {friend.name}
    </button>
  )
}
```

and replace:

```tsx
              {isOnline(f) && f.canListen && !withYou(f) && (
                <button className="text-link" onClick={() => listen.invite(f.userId)} disabled={!listen.canInvite(f.userId)}>
                  Ajak
                </button>
              )}
            </li>
```

with:

```tsx
              {isOnline(f) && f.canListen && !withYou(f) && (
                <button className="text-link" onClick={() => listen.invite(f.userId)} disabled={!listen.canInvite(f.userId)}>
                  Ajak
                </button>
              )}
              <button className="text-link" onClick={() => nav({ name: 'friend', id: f.userId })}>
                Lihat
              </button>
            </li>
```

- [ ] **Step 8: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- friend profile ---------- */
.ch-cover:has(.fr-avatar) { border-radius: 50%; }
.fr-avatar { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-family: var(--serif); font-size: 64px; font-style: italic; }
```

- [ ] **Step 9: Check**

Run: `grep -rnE "lib\.partner|refreshPartner|listPartnerPlaylists|copyPartnerPlaylist|PartnerView|name: 'partner'" src`
Expected: no output.

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 10: Commit**

The rename is already staged by `git mv` (adding the new path stages its new content).

```bash
git add src/renderer/src/social/playlistCache.ts src/renderer/src/screens/FriendView.tsx src/renderer/src/screens/FriendPlaylistView.tsx src/renderer/src/library/LibraryProvider.tsx src/renderer/src/views.ts src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/screens/Home.tsx src/renderer/src/screens/Profile.tsx src/renderer/src/screens/FriendsView.tsx src/shared/ipc.ts src/main/ipc.ts src/main/sync/supabase-remote.ts src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(social): friend profile and the friend playlist view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Sidebar — Teman dot, ONLINE group, DARI TEMAN by friend

**Files:**
- Create: `src/renderer/src/social/lists.ts`
- Create: `tests/social-lists.test.ts`
- Rewrite: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/styles/social.css`

- [ ] **Step 1: Failing list tests**

Create `tests/social-lists.test.ts`:

```ts
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
```

Run: `npx vitest run tests/social-lists.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: The helpers**

Create `src/renderer/src/social/lists.ts`:

```ts
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
```

Run: `npx vitest run tests/social-lists.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: The sidebar**

Replace the whole of `src/renderer/src/components/Sidebar.tsx` with:

```tsx
import { Compass, Download, Heart, History, Home, Plus, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { groupByOwner, onlineFriends } from '../social/lists'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
import { PlaylistCover } from './PlaylistCover'
import { SearchBox } from './SearchBox'

interface Props {
  view: View
  nav: Nav
  query: string
  onQuery: (q: string) => void
  onSubmit: () => void
  recent: RecentEntry[]
  onForget: (entry: RecentEntry) => void
  onPlayTrack: (track: Track) => void
  /** The profile name, shown next to the avatar. */
  name: string
  /** First letter of the profile name, shown in the avatar. */
  initial: string
}

/** At most this many names in the ONLINE group; the rest become "+k lainnya". */
const MAX_ONLINE = 5

/** A text navigation item; the active one is bold with its icon in the accent. `alert` adds the red dot. */
function NavItem(p: { label: string; icon: LucideIcon; active: boolean; alert?: string; onClick: () => void }): React.JSX.Element {
  const Icon = p.icon
  return (
    <button className={`nav-item${p.active ? ' active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <Icon className="nav-icon" size={17} strokeWidth={p.active ? 2.2 : 1.8} aria-hidden="true" />
      <span>{p.label}</span>
      {p.alert && <span className="nav-alert" role="img" aria-label={p.alert} />}
    </button>
  )
}

function PlaylistItem(p: { name: string; covers: string[]; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <PlaylistCover covers={p.covers} size={30} />
      <span>{p.name}</span>
    </button>
  )
}

/** ONLINE · n: friends who have Phinas open, partner first. A name opens a small menu. */
function OnlineGroup({ nav }: { nav: Nav }): React.JSX.Element | null {
  const social = useSocial()
  const listen = useListen()
  const [menu, setMenu] = useState<string | null>(null)
  if (!social.signedIn) return null
  const people = onlineFriends(social.friends, social.online)
  if (people.length === 0) return null
  const shown = people.slice(0, MAX_ONLINE)
  const more = people.length - shown.length

  return (
    <div className="nav-online">
      <div className="label nav-group">Online · {people.length}</div>
      {shown.map((f) => {
        const withYou = listen.activeFriend === f.userId && listen.state.status === 'active'
        const open = menu === f.userId
        return (
          <div key={f.userId} className="menu-wrap">
            <button className="nav-person" onClick={() => setMenu(open ? null : f.userId)} aria-haspopup="menu" aria-expanded={open}>
              <span className="online-dot" aria-hidden="true" />
              {f.isPartner && <Heart className="nav-heart" size={11} fill="currentColor" aria-label="Pasangan" />}
              <span className="nav-person-name">{f.name}</span>
              {withYou && <span className="nav-person-note">· bareng kamu</span>}
            </button>
            {open && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <div className="menu nav-person-menu" role="menu">
                  {f.canListen && !withYou && (
                    <button
                      role="menuitem"
                      className="menu-item"
                      disabled={!listen.canInvite(f.userId)}
                      onClick={() => {
                        setMenu(null)
                        listen.invite(f.userId)
                      }}
                    >
                      Ajak dengar bareng
                    </button>
                  )}
                  <button
                    role="menuitem"
                    className="menu-item"
                    onClick={() => {
                      setMenu(null)
                      nav({ name: 'friend', id: f.userId })
                    }}
                  >
                    Lihat profil
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
      {more > 0 && (
        <button className="nav-more" onClick={() => nav({ name: 'friends' })}>
          +{more} lainnya
        </button>
      )}
    </div>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, name, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const social = useSocial()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  const groups = groupByOwner(lib.friends)

  return (
    <aside className="sidebar" aria-label="Navigasi">
      {/* An empty strip: the window's drag handle, and room for the macOS window buttons. */}
      <div className="nav-brand" aria-hidden="true" />
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="nav">
        <NavItem label="Beranda" icon={Home} active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem label="Jelajah" icon={Compass} active={view.name === 'explore'} onClick={() => nav({ name: 'explore' })} />
        <NavItem
          label="Teman"
          icon={Users}
          active={view.name === 'friends' || view.name === 'friend'}
          alert={social.incoming > 0 ? `${social.incoming} permintaan baru` : undefined}
          onClick={() => nav({ name: 'friends' })}
        />
        <NavItem label="Disukai" icon={Heart} active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem label="Riwayat" icon={History} active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <OnlineGroup nav={nav} />

      <div className="nav-section">
        <span className="label">Playlist</span>
        <div className="nav-actions">
          <button className="icon-btn" onClick={() => nav({ name: 'import' })} aria-label="Impor dari Spotify" title="Impor dari Spotify">
            <Download size={14} />
          </button>
          <button className="icon-btn" onClick={create} aria-label="Buat playlist" title="Buat playlist">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="nav-list">
        {lib.playlists.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            covers={p.coverUrls}
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="nav-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {groups.length > 0 && <div className="label nav-group">Dari teman</div>}
        {groups.map((g) => (
          <Fragment key={g.ownerId}>
            <div className="nav-owner">{g.ownerName}</div>
            {g.playlists.map((p) => (
              <PlaylistItem
                key={p.id}
                name={p.name}
                covers={p.coverUrls}
                active={sameView(view, { name: 'friendPlaylist', id: p.id })}
                onClick={() => nav({ name: 'friendPlaylist', id: p.id })}
              />
            ))}
          </Fragment>
        ))}
      </div>

      <div className="nav-foot">
        <button className={`nav-me${view.name === 'profile' ? ' active' : ''}`} onClick={() => nav({ name: 'profile' })} aria-label="Profil">
          <span className="nav-avatar">{initial}</span>
          <span className="nav-foot-name">{name}</span>
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- sidebar: request dot, online group, friends' playlists ---------- */
/* The only red in the app: something waits for an answer on Teman. */
.nav-alert { flex: none; width: 7px; height: 7px; margin-left: auto; border-radius: 50%; background: #d64545; }
.nav-online { margin-top: 14px; }
.nav-online > .nav-group { margin: 0 0 4px; }
.nav-person { justify-content: flex-start; gap: 8px; width: 100%; min-width: 0; padding: 4px 0; font-size: 12px; color: var(--ink-soft); text-align: left; }
.nav-person:hover, .nav-person[aria-expanded='true'] { color: var(--ink); }
.nav-person-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-person-note { flex: none; font-size: 11px; color: var(--accent); }
.nav-heart { flex: none; color: var(--accent); }
.nav-person-menu { left: 0; right: auto; min-width: 180px; }
.menu-item:disabled { color: var(--ink-faint); }
.nav-more { padding: 4px 0 0 16px; font-size: 11px; color: var(--ink-soft); }
.nav-more:hover { color: var(--accent); }
.nav-owner { padding: 6px 0 2px; font-size: 11px; font-weight: 600; color: var(--ink-faint); }
```

- [ ] **Step 5: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/social/lists.ts tests/social-lists.test.ts src/renderer/src/components/Sidebar.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(sidebar): online friends, friends' playlists by owner, request dot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Beranda's "Sedang online" line

**Files:**
- Modify: `src/renderer/src/social/lists.ts`
- Modify: `tests/social-lists.test.ts`
- Create: `src/renderer/src/components/OnlineLine.tsx`
- Modify: `src/renderer/src/screens/Home.tsx`
- Delete: `src/renderer/src/components/BerduaLine.tsx`
- Modify: `src/renderer/src/styles/social.css`

`berduaView` (and its test) stays: the line uses it for the session states (invited, inviting, active).

- [ ] **Step 1: Failing tests**

In `tests/social-lists.test.ts`, replace:

```ts
import { groupByOwner, onlineFriends } from '../src/renderer/src/social/lists'
```

with:

```ts
import { groupByOwner, inviteTarget, lineText, onlineFriends, onlineLine } from '../src/renderer/src/social/lists'
```

and append:

```ts

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
```

Run: `npx vitest run tests/social-lists.test.ts`
Expected: FAIL — `onlineLine` is not exported.

- [ ] **Step 2: The helpers**

Append to `src/renderer/src/social/lists.ts`:

```ts

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
```

Run: `npx vitest run tests/social-lists.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 3: The line**

Create `src/renderer/src/components/OnlineLine.tsx`:

```tsx
import { Fragment } from 'react'
import { inviteTarget, lineText, onlineFriends, onlineLine } from '../social/lists'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'
import { berduaView, type BerduaAction } from './berduaView'

/**
 * Beranda's line between the cover story and the lists. During a session (or an invite either way)
 * it shows that session; otherwise who is online, with Ajak for the partner or the first friend who
 * allows it. Hidden when signed out or nobody is online.
 */
export function OnlineLine({ nav }: { nav: Nav }): React.JSX.Element | null {
  const social = useSocial()
  const l = useListen()
  if (!social.signedIn) return null

  if (l.activeFriend && l.busy) {
    const id = l.activeFriend
    const view = berduaView(l.state, l.activeName)
    const run: Record<BerduaAction, () => void> = {
      end: l.end,
      cancel: l.end,
      accept: l.accept,
      decline: l.decline,
      invite: () => l.invite(id)
    }
    return (
      <div className="berdua-line" role="group" aria-label="Dengar bareng">
        <span className={`online-dot${view.online ? '' : ' off'}`} aria-hidden="true" />
        <button className="berdua-name" onClick={() => nav({ name: 'friend', id })}>
          {l.activeName}
        </button>
        <span className="muted">{view.text}</span>
        <span className="berdua-spacer" />
        <span className="berdua-actions">
          {view.actions.map((a, i) => (
            <Fragment key={a.kind}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <button className="text-link" onClick={run[a.kind]} disabled={a.disabled}>
                {a.label}
              </button>
            </Fragment>
          ))}
        </span>
      </div>
    )
  }

  const people = onlineFriends(social.friends, social.online)
  if (people.length === 0) return null
  const parts = onlineLine(people.map((f) => ({ id: f.userId, name: f.name })))
  const target = inviteTarget(people)

  return (
    <div className="berdua-line" role="group" aria-label="Sedang online" title={`Sedang online: ${lineText(parts)}`}>
      <span className="online-dot" aria-hidden="true" />
      <span className="muted">Sedang online:</span>
      <span className="online-names">
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            <Fragment key={i}>{p}</Fragment>
          ) : (
            <button key={p.id} className="berdua-name" onClick={() => nav({ name: 'friend', id: p.id })}>
              {p.name}
            </button>
          )
        )}
      </span>
      <span className="berdua-spacer" />
      {target && (
        <button className="text-link" onClick={() => l.invite(target.userId)} disabled={!l.canInvite(target.userId)}>
          Ajak {target.name}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Use it on Beranda**

In `src/renderer/src/screens/Home.tsx`, replace:

```tsx
import { BerduaLine } from '../components/BerduaLine'
```

with:

```tsx
import { OnlineLine } from '../components/OnlineLine'
```

and replace:

```tsx
      <BerduaLine onOpen={() => nav({ name: 'friends' })} />
```

with:

```tsx
      <OnlineLine nav={nav} />
```

Delete the old line:

```bash
git rm src/renderer/src/components/BerduaLine.tsx
```

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- Beranda: online line ---------- */
.online-names { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-soft); }
.online-names .berdua-name { display: inline; }
```

- [ ] **Step 5: Check**

Run: `grep -rn BerduaLine src`
Expected: no output.

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Commit**

The deletion is already staged by `git rm`.

```bash
git add src/renderer/src/social/lists.ts tests/social-lists.test.ts src/renderer/src/components/OnlineLine.tsx src/renderer/src/screens/Home.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(home): Sedang online line with Ajak and the session status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Player bar — Listen Together with a friend picker

**Files:**
- Rewrite: `src/renderer/src/components/ListenTogether.tsx`
- Modify: `src/renderer/src/styles/social.css`

One click invites the partner when they can be invited right now; otherwise the button opens a small list of online friends who allow Listen Together (each disabled until both sides are on the channel). Signed out, the button is hidden.

- [ ] **Step 1: The button**

Replace the whole of `src/renderer/src/components/ListenTogether.tsx` with:

```tsx
import { Headphones, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useSocial } from '../social/SocialProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { endedText, liveLabel } from '../sync/status'

/**
 * Player bar button. In a session: its status, click to end. Otherwise one click invites the
 * partner when they can be invited; if not, it opens a list of online friends who allow it.
 */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  const social = useSocial()
  const [open, setOpen] = useState(false)
  if (!social.signedIn) return null
  const { status } = l.state
  const name = l.activeName

  if (status === 'active') {
    const label = liveLabel(l.state, name)
    return (
      <button className="icon-btn on listen-btn" onClick={l.end} title="Akhiri sesi" aria-label="Akhiri sesi dengar bareng">
        <Headphones size={18} />
        <span className="listen-label">
          {name} · {label}
        </span>
      </button>
    )
  }
  if (status === 'inviting') {
    return (
      <button className="icon-btn listen-btn" onClick={l.end} title="Batalkan ajakan" aria-label="Batalkan ajakan">
        <Headphones size={18} />
        <span className="listen-label">Menunggu {name}…</span>
      </button>
    )
  }

  const partner = l.partner
  const partnerReady = partner !== null && l.canInvite(partner.userId)
  const title = partner && partnerReady ? `Dengar bareng ${partner.name}` : 'Dengar bareng teman'
  const click = (): void => {
    if (partner && partnerReady) l.invite(partner.userId)
    else setOpen((o) => !o)
  }

  return (
    <div className="menu-wrap">
      <button
        className="icon-btn listen-btn"
        onClick={click}
        disabled={status === 'invited'}
        title={title}
        aria-label={title}
        aria-haspopup={partnerReady ? undefined : 'menu'}
        aria-expanded={partnerReady ? undefined : open}
      >
        <Headphones size={18} />
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu listen-menu" role="menu">
            <div className="label menu-title">Dengar bareng</div>
            {l.invitable.length === 0 && <div className="menu-empty">Belum ada teman online yang bisa diajak.</div>}
            {l.invitable.map((f) => (
              <button
                key={f.userId}
                role="menuitem"
                className="menu-item listen-pick"
                disabled={!l.canInvite(f.userId)}
                onClick={() => {
                  setOpen(false)
                  l.invite(f.userId)
                }}
              >
                <span className="online-dot" aria-hidden="true" />
                {f.isPartner && <Heart className="nav-heart" size={11} fill="currentColor" aria-label="Pasangan" />}
                {f.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Shown at the top of the page: an incoming invite, a refusal, or why the last session ended. */
export function ListenBanner(): React.JSX.Element | null {
  const l = useListen()
  const { status, endReason } = l.state
  const [shownEnd, setShownEnd] = useState<EndReason | null>(null)

  useEffect(() => {
    if (status !== 'ended' || !endReason) return
    setShownEnd(endReason)
    const t = setTimeout(() => setShownEnd(null), 4000)
    return () => clearTimeout(t)
  }, [status, endReason])

  const { notice, dismissNotice } = l
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismissNotice, 4000)
    return () => clearTimeout(t)
    // dismissNotice is a new function on every render; the timer only follows the notice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice])

  if (l.pendingInvite) {
    return (
      <div className="notice listen-banner" role="alertdialog">
        <span>{l.pendingInvite.name} mengajak kamu dengar bareng.</span>
        <button className="listen-action" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-action" onClick={l.decline}>
          Tolak
        </button>
      </div>
    )
  }
  if (notice) {
    return (
      <div className="notice" role="status" onClick={dismissNotice}>
        {notice}
      </div>
    )
  }
  if (shownEnd) {
    return (
      <div className="notice" role="status" onClick={() => setShownEnd(null)}>
        {endedText(shownEnd, l.activeName)}
      </div>
    )
  }
  return null
}
```

- [ ] **Step 2: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- player bar: friend picker (opens upwards) ---------- */
.listen-menu { top: auto; bottom: calc(100% + 10px); right: 0; min-width: 220px; }
.listen-pick { gap: 8px; }
```

- [ ] **Step 3: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ListenTogether.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(player): Listen Together picker for online friends

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Playlist visibility picker and sidebar icons

**Files:**
- Create: `src/renderer/src/components/visibility.ts`
- Create: `tests/visibility.test.ts`
- Create: `src/renderer/src/components/VisibilityPicker.tsx`
- Modify: `src/renderer/src/components/CollectionHeader.tsx`
- Modify: `src/renderer/src/screens/PlaylistView.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/styles/social.css`

`setPlaylistVisibility` already stores the value, bumps `updatedAt` and queues the playlist in the outbox (A), so the change syncs like any other edit.

- [ ] **Step 1: Failing mapping tests**

Create `tests/visibility.test.ts`:

```ts
import { expect, test } from 'vitest'
import { sidebarIcon, VISIBILITY_OPTIONS, visibilityOption } from '../src/renderer/src/components/visibility'

test('three options in order, each with a one-line explanation and an icon', () => {
  expect(VISIBILITY_OPTIONS.map((o) => [o.value, o.label, o.hint, o.icon])).toEqual([
    ['private', 'Pribadi', 'Hanya kamu', 'lock'],
    ['friends', 'Teman', 'Semua temanmu', 'users'],
    ['public', 'Publik', 'Semua pengguna Phinas', 'globe']
  ])
})

test('visibilityOption finds each value', () => {
  expect(visibilityOption('private').label).toBe('Pribadi')
  expect(visibilityOption('friends').label).toBe('Teman')
  expect(visibilityOption('public').label).toBe('Publik')
})

test('the sidebar marks private and public playlists, not friends ones', () => {
  expect(sidebarIcon('private')).toBe('lock')
  expect(sidebarIcon('public')).toBe('globe')
  expect(sidebarIcon('friends')).toBeNull()
})
```

Run: `npx vitest run tests/visibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: The mapping**

Create `src/renderer/src/components/visibility.ts`:

```ts
import type { Visibility } from '../../../shared/types'

export interface VisibilityOption {
  value: Visibility
  /** Shown in capitals by the label style: PRIBADI, TEMAN, PUBLIK. */
  label: string
  hint: string
  icon: 'lock' | 'users' | 'globe'
}

export const VISIBILITY_OPTIONS: readonly VisibilityOption[] = [
  { value: 'private', label: 'Pribadi', hint: 'Hanya kamu', icon: 'lock' },
  { value: 'friends', label: 'Teman', hint: 'Semua temanmu', icon: 'users' },
  { value: 'public', label: 'Publik', hint: 'Semua pengguna Phinas', icon: 'globe' }
]

export function visibilityOption(v: Visibility): VisibilityOption {
  return VISIBILITY_OPTIONS.find((o) => o.value === v) ?? VISIBILITY_OPTIONS[1]
}

/** The small icon after an own playlist in the sidebar; friends (the default) gets none. */
export function sidebarIcon(v: Visibility): 'lock' | 'globe' | null {
  if (v === 'private') return 'lock'
  if (v === 'public') return 'globe'
  return null
}
```

Run: `npx vitest run tests/visibility.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: The picker**

Create `src/renderer/src/components/VisibilityPicker.tsx`:

```tsx
import { Globe, Lock, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { Visibility } from '../../../shared/types'
import { VISIBILITY_OPTIONS, visibilityOption } from './visibility'

const ICONS: Record<'lock' | 'users' | 'globe', LucideIcon> = { lock: Lock, users: Users, globe: Globe }

/** The playlist header's label line: who can see this playlist, and a menu to change it. */
export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const current = visibilityOption(value)
  const Icon = ICONS[current.icon]

  return (
    <span className="menu-wrap vis-wrap">
      <button
        className="vis-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Siapa yang bisa melihat playlist ini"
      >
        <Icon size={11} strokeWidth={2.2} aria-hidden="true" />
        {current.label}
      </button>
      {open && (
        <>
          <span className="menu-backdrop" onClick={() => setOpen(false)} />
          <span className="menu vis-menu" role="menu">
            {VISIBILITY_OPTIONS.map((o) => {
              const ItemIcon = ICONS[o.icon]
              const on = o.value === value
              return (
                <button
                  key={o.value}
                  role="menuitemradio"
                  aria-checked={on}
                  className={`menu-item vis-item${on ? ' active' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    if (!on) onChange(o.value)
                  }}
                >
                  <ItemIcon size={14} aria-hidden="true" />
                  <span className="vis-text">
                    <strong>{o.label}</strong>
                    <span className="small">{o.hint}</span>
                  </span>
                </button>
              )
            })}
          </span>
        </>
      )}
    </span>
  )
}
```

- [ ] **Step 4: The header takes a node as its label**

In `src/renderer/src/components/CollectionHeader.tsx`, replace:

```tsx
  /** The label line, e.g. "Playlist", "Album · Hindia", "Artis" (shown in capitals). */
  kind: string
```

with:

```tsx
  /** The label line, e.g. "Playlist", "Album · Hindia", "Artis" (shown in capitals), or a control in that style. */
  kind: ReactNode
```

In `src/renderer/src/screens/PlaylistView.tsx`, replace:

```tsx
import { TrackListHead, TrackRow } from '../components/TrackRow'
```

with:

```tsx
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { VisibilityPicker } from '../components/VisibilityPicker'
```

and replace:

```tsx
        kind="Playlist"
```

with:

```tsx
        kind={
          <VisibilityPicker
            value={pl.visibility}
            onChange={async (v) => {
              await window.phinas.setPlaylistVisibility(pl.id, v)
              await lib.refresh()
            }}
          />
        }
```

- [ ] **Step 5: Icons in the sidebar**

In `src/renderer/src/components/Sidebar.tsx`, replace:

```tsx
import { Compass, Download, Heart, History, Home, Plus, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { Track } from '../../../shared/types'
```

with:

```tsx
import { Compass, Download, Globe, Heart, History, Home, Lock, Plus, Users, type LucideIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { Track, Visibility } from '../../../shared/types'
```

replace:

```tsx
import { SearchBox } from './SearchBox'
```

with:

```tsx
import { SearchBox } from './SearchBox'
import { sidebarIcon } from './visibility'
```

replace:

```tsx
function PlaylistItem(p: { name: string; covers: string[]; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <PlaylistCover covers={p.covers} size={30} />
      <span>{p.name}</span>
    </button>
  )
}
```

with:

```tsx
function PlaylistItem(p: { name: string; covers: string[]; active: boolean; visibility?: Visibility; onClick: () => void }): React.JSX.Element {
  const icon = p.visibility ? sidebarIcon(p.visibility) : null
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <PlaylistCover covers={p.covers} size={30} />
      <span>{p.name}</span>
      {icon === 'lock' && <Lock className="nav-vis" size={11} aria-label="Pribadi" />}
      {icon === 'globe' && <Globe className="nav-vis" size={11} aria-label="Publik" />}
    </button>
  )
}
```

and replace:

```tsx
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
```

with:

```tsx
            active={sameView(view, { name: 'playlist', id: p.id })}
            visibility={p.visibility}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
```

- [ ] **Step 6: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- playlist visibility ---------- */
.vis-wrap { display: inline-block; }
/* Sits inside the header's .label line, so it takes that look. */
.vis-btn { gap: 6px; padding: 2px 0; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; }
.vis-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.vis-menu { left: 0; right: auto; min-width: 240px; font-weight: 400; letter-spacing: 0; text-transform: none; }
.vis-item { align-items: flex-start; gap: 10px; color: var(--ink); }
.vis-item svg { flex: none; margin-top: 2px; color: var(--ink-soft); }
.vis-item.active, .vis-item.active svg { color: var(--accent); }
.vis-text { display: flex; flex-direction: column; gap: 1px; }
.vis-text strong { font-weight: 600; }
.vis-text .small { color: var(--ink-soft); }
.nav-vis { flex: none; margin-left: auto; color: var(--ink-faint); }
```

- [ ] **Step 7: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/visibility.ts tests/visibility.test.ts src/renderer/src/components/VisibilityPicker.tsx src/renderer/src/components/CollectionHeader.tsx src/renderer/src/screens/PlaylistView.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(playlist): visibility picker in the header and icons in the sidebar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Jelajah — Playlist publik

**Files:**
- Modify: `src/renderer/src/screens/Explore.tsx`

Up to 12 public playlists of other users (`listPublicPlaylists()`), signed in only. Opening one goes through the playlist cache to the read-only friend-playlist view.

- [ ] **Step 1: Imports**

In `src/renderer/src/screens/Explore.tsx`, replace:

```tsx
import type { FavoriteArtist, HomeFeed, Track } from '../../../shared/types'
```

with:

```tsx
import type { FavoriteArtist, HomeFeed, PartnerPlaylist, Track } from '../../../shared/types'
```

replace:

```tsx
import { formatTime } from '../components/TrackRow'
```

with:

```tsx
import { PlaylistCover } from '../components/PlaylistCover'
import { formatTime } from '../components/TrackRow'
```

and replace:

```tsx
import { usePlayer } from '../player/PlayerProvider'
```

with:

```tsx
import { usePlayer } from '../player/PlayerProvider'
import { rememberPlaylist } from '../social/playlistCache'
import { useSocial } from '../social/SocialProvider'
```

- [ ] **Step 2: Load them**

Replace:

```tsx
  const [artists, setArtists] = useState<FavoriteArtist[]>([])

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFailed(true))
    window.phinas.listFavoriteArtists(6).then(setArtists).catch(() => setArtists([]))
  }, [])
```

with:

```tsx
  const [artists, setArtists] = useState<FavoriteArtist[]>([])
  const social = useSocial()
  const [publicLists, setPublicLists] = useState<PartnerPlaylist[] | null>(null)
  const [publicFailed, setPublicFailed] = useState(false)

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFailed(true))
    window.phinas.listFavoriteArtists(6).then(setArtists).catch(() => setArtists([]))
  }, [])

  // Public playlists come from other Phinas users, so they need an account.
  useEffect(() => {
    if (!social.signedIn) return
    let alive = true
    setPublicFailed(false)
    window.phinas
      .listPublicPlaylists()
      .then((p) => {
        if (alive) setPublicLists(p.slice(0, 12))
      })
      .catch(() => {
        if (alive) setPublicFailed(true)
      })
    return () => {
      alive = false
    }
  }, [social.signedIn])
```

- [ ] **Step 3: The section, after Rilis baru**

Replace:

```tsx
      {artists.length > 0 && (
```

with:

```tsx
      {social.signedIn && (publicLists === null || publicLists.length > 0 || publicFailed) && (
        <section className="sec">
          <h2 className="section-title">Playlist publik</h2>
          {publicFailed ? (
            error
          ) : publicLists === null ? (
            <CoverGridSkeleton four count={4} />
          ) : (
            <CoverGrid
              four
              items={publicLists.map((p) => ({
                key: p.id,
                art: <PlaylistCover covers={p.coverUrls} />,
                title: p.name,
                meta: `oleh ${p.ownerName}`,
                onOpen: () => {
                  rememberPlaylist(p)
                  nav({ name: 'friendPlaylist', id: p.id })
                }
              }))}
            />
          )}
        </section>
      )}

      {artists.length > 0 && (
```

- [ ] **Step 4: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Explore.tsx
git commit -m "$(cat <<'EOF'
feat(explore): public playlists from other Phinas users

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Profil — server name, listen scope, account link to Teman

**Files:**
- Rewrite: `src/renderer/src/screens/Profile.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/social.css`

Signed in, the display name lives on the server (`updateMyProfile(name, null)`, 800 ms after typing stops) and is shown everywhere from `myProfile`; signed out it stays in localStorage as today. The sign-in form leaves Profil (it is on Teman and the welcome screen).

- [ ] **Step 1: Profil**

Replace the whole of `src/renderer/src/screens/Profile.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { ListenScope, SyncStatus } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import { useSocial } from '../social/SocialProvider'
import type { ThemeMode } from '../theme/mode'
import { useUpdate } from '../update/useUpdate'
import type { Nav } from '../views'

const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Ikuti sistem', hint: 'Siang atau malam mengikuti komputer' },
  { id: 'day', label: 'Siang', hint: 'Kertas terang' },
  { id: 'night', label: 'Malam', hint: 'Tinta gelap' }
]

const SCOPES: { id: ListenScope; label: string; hint: string }[] = [
  { id: 'friends', label: 'Semua teman', hint: 'Teman mana pun yang online' },
  { id: 'partner', label: 'Pasangan saja', hint: 'Hanya pasanganmu' },
  { id: 'off', label: 'Tidak ada', hint: 'Tidak ada yang bisa mengajak' }
]

/** Typing pauses this long before the name goes to the server. */
const NAME_SAVE_MS = 800
const STATUS_REFRESH_MS = 5000

interface Props {
  nav: Nav
  /** The name kept on this computer (used while signed out). */
  name: string
  onName: (n: string) => void
  theme: ThemeMode
  onTheme: (t: ThemeMode) => void
}

export function Profile({ nav, name, onName, theme, onTheme }: Props): React.JSX.Element {
  const lib = useLibrary()
  const social = useSocial()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [notch, setNotch] = useNotchEnabled()
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)
  /** What is typed while signed in, until the server has it. */
  const [draft, setDraft] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signedIn = social.signedIn

  const load = async (): Promise<void> => {
    setStatus(await window.phinas.syncStatus().catch(() => null))
  }

  // The status is local and cheap (pending changes, library errors); poll it while Profil is open.
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), STATUS_REFRESH_MS)
    return () => clearInterval(t)
  }, [])

  const shownName = signedIn ? (draft ?? social.me?.displayName ?? '') : name
  const initial = (shownName.trim()[0] ?? 'K').toUpperCase()

  const changeName = (value: string): void => {
    if (!signedIn) {
      onName(value)
      return
    }
    setDraft(value)
    setNameError(null)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const trimmed = value.trim()
      if (!trimmed) {
        setNameError(friendlyError(new Error('phinas:name_invalid')))
        return
      }
      window.phinas
        .updateMyProfile(trimmed, null)
        .then(() => social.refresh())
        .then(() => setDraft((d) => (d === value ? null : d)))
        .catch((e: unknown) => setNameError(friendlyError(e)))
    }, NAME_SAVE_MS)
  }

  const changeScope = async (scope: ListenScope): Promise<void> => {
    setScopeError(null)
    try {
      await window.phinas.updateMyProfile(null, scope)
      await social.refresh()
    } catch (e) {
      setScopeError(friendlyError(e))
    }
  }

  const signOut = async (): Promise<void> => {
    setError(null)
    try {
      await window.phinas.syncSignOut()
      await load()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const deleteAccount = async (): Promise<void> => {
    const ok = window.confirm(
      'Hapus akun Phinas? Playlist dan lagu yang disukai di server ikut terhapus, dan teman-temanmu tidak bisa melihatnya lagi. Data di komputer ini tetap ada.'
    )
    if (!ok) return
    setError(null)
    try {
      await window.phinas.deleteAccount()
      await load()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <>
      <header className="pf-head">
        <div className="pf-avatar">{initial}</div>
        <div className="pf-who">
          <span className="label accent">Profil</span>
          <input className="pf-name" value={shownName} maxLength={30} onChange={(e) => changeName(e.target.value)} aria-label="Nama tampilan" />
          {nameError && (
            <div className="notice" role="alert">
              {nameError}
            </div>
          )}
          <div className="pf-stats">
            <span>
              <strong>{lib.playlists.length}</strong> playlist
            </span>
            <span>
              <strong>{lib.likes.length}</strong> lagu disukai
            </span>
            {signedIn && social.email && <span>{social.email}</span>}
          </div>
        </div>
      </header>

      <section className="sec pf-sec">
        <h2 className="section-title">Tema</h2>
        <div className="pf-themes" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              className={`pf-theme${theme === t.id ? ' active' : ''}`}
              onClick={() => onTheme(t.id)}
            >
              <strong>{t.label}</strong>
              <span className="small">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {signedIn && (
        <section className="sec pf-sec">
          <h2 className="section-title">Siapa yang boleh mengajak dengar bareng</h2>
          <div className="pf-themes" role="radiogroup" aria-label="Siapa yang boleh mengajak dengar bareng">
            {SCOPES.map((s) => {
              const on = social.me?.listenScope === s.id
              return (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={on}
                  className={`pf-theme${on ? ' active' : ''}`}
                  disabled={social.offline || !social.me}
                  onClick={() => void changeScope(s.id)}
                >
                  <strong>{s.label}</strong>
                  <span className="small">{s.hint}</span>
                </button>
              )
            })}
          </div>
          <p className="small pf-note">Teman tetap bisa melihat kamu sedang online.</p>
          {scopeError && (
            <div className="notice" role="alert">
              {scopeError}
            </div>
          )}
        </section>
      )}

      <section className="sec pf-sec">
        <h2 className="section-title">Notch</h2>
        <label className="pf-check">
          <input type="checkbox" checked={notch ?? true} disabled={notch === null} onChange={(e) => setNotch(e.target.checked)} />
          <span>Tampilkan notch</span>
        </label>
        <p>Pill kecil di tengah atas layar saat ada lagu. Arahkan kursor untuk membuka kontrolnya.</p>
      </section>

      <UpdateSection />

      <section className="sec pf-sec">
        <h2 className="section-title">Akun</h2>
        {status && !status.configured && <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>}
        {status?.libraryError && (
          <div className="notice">
            Library akun tidak bisa dibuka ({status.libraryError}). Library sebelumnya tetap dipakai; tidak ada yang dihapus.
          </div>
        )}
        {status?.configured && status.signedIn && (
          <>
            {social.me?.disabled && <div className="notice">{friendlyError(new Error('phinas:account_disabled'))}</div>}
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {social.me && (
              <p>
                Kode temanmu: <strong className="pf-code">{social.me.friendCode}</strong>
              </p>
            )}
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            {error && <div className="notice">{error}</div>}
            <div className="pf-row">
              <button className="btn secondary" onClick={() => void signOut()}>
                Keluar
              </button>
              <button className="btn secondary" onClick={() => void deleteAccount()}>
                Hapus akun
              </button>
            </div>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <p>
            Belum masuk. Playlist dan lagu yang kamu sukai tersimpan di komputer ini.{' '}
            <button className="text-link" onClick={() => nav({ name: 'friends' })}>
              Masuk atau daftar di halaman Teman
            </button>
          </p>
        )}
      </section>
    </>
  )
}

/** Version, and a manual "check for updates". */
function UpdateSection(): React.JSX.Element {
  const u = useUpdate()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      await window.phinas.checkForUpdate()
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }
  let line = u ? `Phinas ${u.current}` : 'Phinas'
  if (u?.state === 'available' || u?.state === 'ready') line += ` · versi ${u.latest} tersedia`
  else if (u?.state === 'downloading') line += ` · mengunduh ${u.latest} (${u.progress ?? 0}%)`
  else if (checked) line += ' · sudah versi terbaru'
  return (
    <section className="sec pf-sec">
      <h2 className="section-title">Pembaruan</h2>
      <p>{line}</p>
      <div className="pf-row">
        <button className="btn secondary" onClick={() => void check()} disabled={checking || u?.state === 'downloading'}>
          {checking ? 'Memeriksa...' : 'Cek pembaruan'}
        </button>
        {(u?.state === 'available' || u?.state === 'ready') && (
          <button className="btn" onClick={() => void window.phinas.installUpdate()}>
            {u.state === 'ready' ? 'Mulai ulang & perbarui' : 'Unduh versi baru'}
          </button>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Show the server name everywhere**

In `src/renderer/src/App.tsx`:

Replace:

```tsx
import { SocialProvider } from './social/SocialProvider'
```

with:

```tsx
import { SocialProvider, useSocial } from './social/SocialProvider'
```

Replace:

```tsx
  const profile = useProfile()
```

with:

```tsx
  const profile = useProfile()
  const social = useSocial()
  // Signed in, the name lives on the server (friends see it); signed out it stays on this computer.
  const shownName = social.me?.displayName || profile.name
  const shownInitial = (shownName.trim()[0] ?? 'K').toUpperCase()
```

Replace:

```tsx
        return <Home nav={nav} name={profile.name} />
```

with:

```tsx
        return <Home nav={nav} name={shownName} />
```

Replace:

```tsx
        return <Profile name={profile.name} onName={profile.setName} initial={profile.initial} theme={theme.mode} onTheme={theme.setMode} />
```

with:

```tsx
        return <Profile nav={nav} name={profile.name} onName={profile.setName} theme={theme.mode} onTheme={theme.setMode} />
```

Replace:

```tsx
        name={profile.name}
        initial={profile.initial}
```

with:

```tsx
        name={shownName}
        initial={shownInitial}
```

- [ ] **Step 3: Styles**

Append to `src/renderer/src/styles/social.css`:

```css

/* ---------- Profil: listen scope ---------- */
.pf-note { margin: 10px 0 0; color: var(--ink-soft); }
.pf-theme:disabled { opacity: 0.5; }
```

- [ ] **Step 4: Check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Profile.tsx src/renderer/src/App.tsx src/renderer/src/styles/social.css
git commit -m "$(cat <<'EOF'
feat(profile): server display name, Listen Together scope, sign-in on Teman

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Remove what is left of Berdua

**Files:**
- Modify: `src/renderer/src/styles/lists.css`
- Modify: `src/renderer/src/styles/home.css`

`TogetherView`, `ListenCard`, `BerduaLine` and `ipcTransport` were deleted in Tasks 6, 8 and 11. `berduaView.ts` stays (the online line uses it for session states). What remains is CSS and a last search.

- [ ] **Step 1: Drop the Berdua card rules**

In `src/renderer/src/styles/lists.css`, delete these lines (and the blank line before them):

```css
/* ---------- Berdua ---------- */
.listen-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 0 0 26px; }
.listen-card-title { font-family: var(--serif); font-size: 30px; line-height: 1.05; }
.listen-card-title em { font-style: italic; color: var(--accent); }
.listen-card-actions { display: flex; gap: 8px; margin-top: 6px; }
```

In `src/renderer/src/styles/home.css`, replace:

```css
/* Beranda: cover story, Berdua line, numbered lists. */
```

with:

```css
/* Beranda: cover story, online line (.berdua-line), numbered lists. */
```

and replace:

```css
/* Berdua line */
```

with:

```css
/* Online line: who is online, or the current Listen Together session */
```

- [ ] **Step 2: Nothing refers to the old pieces**

Run: `grep -rnE "TogetherView|ListenCard|BerduaLine|ipcTransport|listenOpen|listenClose|ListenInfo|pairInfo|listPartnerPlaylists|copyPartnerPlaylist|refreshPartner|lib\.partner|name: 'together'|name: 'partner'|listen-card" src tests`
Expected: no output.

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/styles/lists.css src/renderer/src/styles/home.css
git commit -m "$(cat <<'EOF'
chore: remove what is left of the Berdua screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Two accounts against the local Supabase stack (manual)

**Files:** none (temporary `.env.local`, deleted at the end).

A person runs this with the app windows in front of them; a subagent can only prepare the stack and the env file. Nothing is committed unless a step finds a bug (then fix it in its own commit with superpowers:systematic-debugging).

- [ ] **Step 1: Local stack with Auth, REST and Realtime**

```bash
supabase start -x studio,imgproxy,storage-api,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
supabase db reset
supabase test db
```

Expected: `supabase status` lists the API at `http://127.0.0.1:54321`; `supabase db reset` prints no `Listen Together policies skipped` notice; `supabase test db` passes every file. (If the CLI rejects a service name in `-x`, drop that name; `supabase start --help` lists the valid ones.)

- [ ] **Step 2: Point dev builds at it**

```bash
printf 'MAIN_VITE_SUPABASE_URL=%s\nMAIN_VITE_SUPABASE_ANON_KEY=%s\n' \
  "$(supabase status -o env | sed -n 's/^API_URL="\(.*\)"/\1/p')" \
  "$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"/\1/p')" > .env.local
cat .env.local
```

Expected: two lines, the URL `http://127.0.0.1:54321`. `.env.local` overrides `.env` and is git-ignored (`git status --short` does not list it).

- [ ] **Step 3: Three app instances**

In three terminals:

```bash
PHINAS_PROFILE=a npm run dev
PHINAS_PROFILE=b npm run dev
PHINAS_PROFILE=c npm run dev
```

Each prints `[dev] user data: …/a` (`b`, `c`); note the three folders for Step 6. The second and third dev servers take the next free Vite port. If one fails to start, run `npm run build` once and start that instance with `PHINAS_PROFILE=b npx electron-vite preview` instead.

- [ ] **Step 4: Walk the flows** (write down what happened for each)

1. **Welcome, guest library, claim.** In A the welcome screen shows. Click "Pakai tanpa akun": Beranda opens. Create a playlist "Sebelum akun" and like one song. Open Teman → "Punya kode undangan? Daftar" and register `a@local.test` with any code (the first account on an empty database becomes admin). The playlist and the like are still there; Profil shows "Semua perubahan sudah tersinkron" within 15 s.
2. **Invite and register.** In A, Teman → Undang: a code appears under Undangan as "aktif · berlaku 14 hari lagi" (and is copied). In B, welcome → Daftar with that code as `b@local.test`. B lands on Beranda; A's Undangan row turns into "dipakai oleh b"; both Teman pages list each other. Make one more code in A and register C (`c@local.test`) with it. B and C are not friends.
3. **Online awareness.** Within a minute A's sidebar shows `ONLINE · 2` with B and C; Beranda shows "Sedang online: b dan c". Quit C: within a minute C leaves the group.
4. **Listen Together between friends (no partner).** In A, sidebar → B → Ajak dengar bareng. B shows the banner "a mengajak kamu dengar bareng." → Terima. Both show the session (player bar label, side panel "Bareng …", Beranda line). Play a song in A: B follows. Pause in B: A pauses.
5. **Busy.** Start C again. While A and B are in the session, in C open the player-bar button and pick A. C shows "a sedang dengar bareng orang lain." A sees nothing. End the session in A (Akhiri).
6. **Partner.** In A open B's profile → Jadikan pasangan. B's sidebar Teman gets the red dot; Teman → Pasangan shows "a · ingin jadi pasanganmu" → Terima. Both show ♥ next to the other; A's player-bar button now invites B in one click.
7. **Visibility and public playlists.** In B create "Lagu B" and set the label to PUBLIK (sidebar shows the globe). Within 15 s, C's Jelajah shows "Playlist publik" with "Lagu B — oleh b"; opening it shows "Salin ke library saya". Set it to PRIBADI in B: after a minute it leaves A's DARI TEMAN (and C's Jelajah after reopening the page).
8. **Profil.** In B change the name to "Bee" and wait a second: after a minute A sees "Bee" in Teman and the sidebar. Set "Siapa yang boleh mengajak dengar bareng" to "Tidak ada" in B: within a minute A's Ajak for B disappears or is disabled.
9. **Library switch on one computer.** In A: Profil → Keluar. The sidebar shows no playlists (empty guest library) and Teman says "Playlist dan lagu yang kamu sukai tersimpan di akunmu. Masuk lagi untuk melihatnya." Sign in there as `b@local.test`: B's playlists appear (pulled from the server). Keluar, sign in as `a@local.test`: "Sebelum akun" is back.
10. **Remove a friend.** In A open C's profile → Hapus teman → confirm. C disappears from A's Teman and A from C's (after a minute).

- [ ] **Step 5: Tests still pass**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 6: Clean up**

Quit the three app instances, then:

```bash
rm .env.local
git status --short
```

Expected: no output from `git status --short`. Optionally delete the three `PHINAS_PROFILE` folders printed in Step 3 and run `supabase stop`.
