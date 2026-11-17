# Listen Together Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two Phinas users listen to the same music at the same time, with shared track, queue, play/pause and position.

**Architecture:** A pure-TypeScript sync core in `src/shared/sync` (no Electron, DOM or Supabase) talks through two small interfaces, `Transport` and `PlayerPort`. On desktop the session runs in the renderer, next to the audio element. The Supabase Realtime channel lives in the main process (where the Supabase client already is) and is bridged to the renderer over IPC. Mobile clients will later reuse `src/shared/sync` unchanged.

**Tech Stack:** TypeScript, React 19, Electron IPC, Supabase Realtime (broadcast + presence), vitest with fake timers.

Spec: `docs/superpowers/specs/2026-11-17-listen-together-design.md`. Branch: `feat/v1`.

## Design details the spec leaves open

These are decided here so the tasks below stay unambiguous. Task 14 copies them back into the spec.

- **Action kinds:** `play`, `pause`, `seek`, `queue`. A `queue` action carries a full snapshot (`tracks`, `index`, `position`, `playing`), so it covers "set track" too. Queues longer than 100 tracks are windowed around the current track so a message stays small.
- **Who sends heartbeats:** only the "lead", meaning whoever made the last action (the inviter at the start). The other side reconciles toward it. This avoids two sides correcting toward each other.
- **Self-healing:** Realtime broadcast can drop a message. If a heartbeat shows a different track than the local one, the follower sends `resync` and the lead replies with a `queue` snapshot.
- **Rejoin:** a side that lost its own connection sends `hello` when it is back. The other side replies with a snapshot. If both were away, the smaller user id sends the snapshot.
- **Starting state:** the inviter's current queue wins. If the inviter has none, the acceptor's queue (sent inside `accept`) is used.
- **Simultaneous invites:** the smaller user id's invite stands and the other side accepts automatically.

## File structure

| File | Responsibility |
|---|---|
| `src/shared/sync/protocol.ts` | Message types, constants, `parseMessage`, `windowQueue` |
| `src/shared/sync/clock.ts` | `ClockEstimator`: peer clock offset from ping/pong |
| `src/shared/sync/reconcile.ts` | `reconcile` (drift to correction), `expectedPosition` |
| `src/shared/sync/session.ts` | `SyncSession` state machine, plus `Transport` and `PlayerPort` interfaces |
| `tests/helpers/sync-fakes.ts` | `FakeTransport`, `FakePlayer` for tests |
| `tests/sync-*.test.ts` | Tests per module |
| `src/main/sync/realtime.ts` | `PairChannel`: Supabase Realtime adapter |
| `src/main/sync/supabase-remote.ts` | Add `client` getter and `pairInfo()` |
| `src/shared/types.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, `src/main/index.ts` | IPC wiring |
| `src/renderer/src/sync/ipcTransport.ts` | `Transport` implemented over IPC |
| `src/renderer/src/sync/ListenTogetherProvider.tsx` | Creates the session, exposes `useListen()` |
| `src/renderer/src/player/PlayerProvider.tsx` | Emit user actions, apply remote actions |
| `src/renderer/src/components/ListenTogether.tsx` | Button and invite/ended banner |

Tests run with `npx vitest run <file>`. Type check with `npm run typecheck`.

---

### Task 1: Protocol

**Files:**
- Create: `src/shared/sync/protocol.ts`
- Test: `tests/sync-protocol.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync-protocol.test.ts
import { expect, test } from 'vitest'
import { MAX_QUEUE, parseMessage, windowQueue } from '../src/shared/sync/protocol'
import type { Track } from '../src/shared/types'

const track = (id: string): Track => ({ videoId: id, title: id, artist: 'x', coverUrl: '', durationSec: 1 })
const base = { from: 'a', ts: 1000 }

test('parseMessage accepts a well-formed message', () => {
  const m = parseMessage({ ...base, type: 'invite', version: 1 })
  expect(m?.type).toBe('invite')
})

test('parseMessage rejects junk', () => {
  expect(parseMessage(null)).toBeNull()
  expect(parseMessage('x')).toBeNull()
  expect(parseMessage({ ...base, type: 'nope' })).toBeNull()
  expect(parseMessage({ type: 'invite', version: 1 })).toBeNull()
  expect(parseMessage({ ...base, ts: 'later', type: 'invite', version: 1 })).toBeNull()
})

test('parseMessage checks action payloads', () => {
  const ok = { ...base, type: 'action', action: { kind: 'seek', position: 12 } }
  expect(parseMessage(ok)).not.toBeNull()
  expect(parseMessage({ ...base, type: 'action', action: { kind: 'seek' } })).toBeNull()
  expect(parseMessage({ ...base, type: 'action', action: { kind: 'queue', tracks: [], index: 0, position: 0, playing: true } })).toBeNull()
  expect(
    parseMessage({ ...base, type: 'action', action: { kind: 'queue', tracks: [track('a')], index: 3, position: 0, playing: true } })
  ).toBeNull()
  expect(
    parseMessage({ ...base, type: 'action', action: { kind: 'queue', tracks: [track('a')], index: 0, position: 0, playing: true } })
  ).not.toBeNull()
})

test('parseMessage checks heartbeat, pong and accept', () => {
  expect(parseMessage({ ...base, type: 'heartbeat', videoId: 'a', position: 1, playing: true })).not.toBeNull()
  expect(parseMessage({ ...base, type: 'heartbeat', videoId: 'a', position: '1', playing: true })).toBeNull()
  expect(parseMessage({ ...base, type: 'pong', id: 'x', t0: 5 })).not.toBeNull()
  expect(parseMessage({ ...base, type: 'pong', id: 'x' })).toBeNull()
  expect(parseMessage({ ...base, type: 'accept', version: 1, snapshot: null })).not.toBeNull()
  expect(parseMessage({ ...base, type: 'accept', version: 1, snapshot: { kind: 'x' } })).toBeNull()
})

test('windowQueue leaves a short queue alone', () => {
  const tracks = [track('a'), track('b')]
  expect(windowQueue(tracks, 1)).toEqual({ tracks, index: 1 })
})

test('windowQueue keeps the current track and trims a long queue', () => {
  const tracks = Array.from({ length: 250 }, (_, i) => track(`t${i}`))
  for (const index of [0, 3, 120, 245, 249]) {
    const w = windowQueue(tracks, index)
    expect(w.tracks).toHaveLength(MAX_QUEUE)
    expect(w.tracks[w.index].videoId).toBe(`t${index}`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-protocol.test.ts`
Expected: FAIL, cannot resolve `../src/shared/sync/protocol`

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/sync/protocol.ts
import type { Track } from '../types'

export const PROTOCOL_VERSION = 1
/** An invite nobody answers expires after this long. */
export const INVITE_TTL_MS = 60_000
/** A side that is away longer than this ends the session on both sides. */
export const GRACE_MS = 120_000
export const HEARTBEAT_MS = 3_000
export const CLOCK_RESYNC_MS = 30_000
/** Largest queue sent in one message. Longer queues are windowed around the current track. */
export const MAX_QUEUE = 100

export type SyncAction =
  | { kind: 'play'; position: number }
  | { kind: 'pause'; position: number }
  | { kind: 'seek'; position: number }
  | { kind: 'queue'; tracks: Track[]; index: number; position: number; playing: boolean }

export type SyncPayload =
  | { type: 'invite'; version: number }
  /** `snapshot` is the acceptor's queue, used when the inviter has nothing playing. */
  | { type: 'accept'; version: number; snapshot: SyncAction | null }
  | { type: 'decline'; reason?: 'version' }
  | { type: 'end' }
  /** Sent by a side that lost and regained its own connection. */
  | { type: 'hello'; version: number }
  | { type: 'action'; action: SyncAction }
  | { type: 'heartbeat'; videoId: string | null; position: number; playing: boolean }
  | { type: 'resync' }
  | { type: 'status'; state: 'ok' | 'error' }
  | { type: 'ping'; id: string }
  /** `t0` echoes the `ts` of the ping; this message's own `ts` is the peer clock when it answered. */
  | { type: 'pong'; id: string; t0: number }

/** `ts` is the sender's own clock (ms). The receiver converts it with the clock offset. */
export type SyncMessage = SyncPayload & { from: string; ts: number }

export type MessageOf<T extends SyncPayload['type']> = Extract<SyncMessage, { type: T }>

const TYPES = new Set<string>([
  'invite', 'accept', 'decline', 'end', 'hello', 'action', 'heartbeat', 'resync', 'status', 'ping', 'pong'
])

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validAction(a: unknown): a is SyncAction {
  if (typeof a !== 'object' || a === null) return false
  const x = a as Record<string, unknown>
  if (!isNum(x.position)) return false
  if (x.kind === 'play' || x.kind === 'pause' || x.kind === 'seek') return true
  return (
    x.kind === 'queue' &&
    Array.isArray(x.tracks) &&
    x.tracks.length > 0 &&
    Number.isInteger(x.index) &&
    (x.index as number) >= 0 &&
    (x.index as number) < x.tracks.length &&
    typeof x.playing === 'boolean'
  )
}

/** Returns the message when it looks valid, otherwise null. Never throws. */
export function parseMessage(raw: unknown): SyncMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  if (typeof m.type !== 'string' || !TYPES.has(m.type)) return null
  if (typeof m.from !== 'string' || !isNum(m.ts)) return null
  switch (m.type) {
    case 'action':
      if (!validAction(m.action)) return null
      break
    case 'accept':
      if (!isNum(m.version)) return null
      if (m.snapshot !== null && !validAction(m.snapshot)) return null
      break
    case 'invite':
    case 'hello':
      if (!isNum(m.version)) return null
      break
    case 'heartbeat':
      if (!isNum(m.position) || typeof m.playing !== 'boolean') return null
      break
    case 'pong':
      if (typeof m.id !== 'string' || !isNum(m.t0)) return null
      break
    case 'ping':
      if (typeof m.id !== 'string') return null
      break
    case 'status':
      if (m.state !== 'ok' && m.state !== 'error') return null
      break
  }
  return raw as SyncMessage
}

/** At most `max` tracks, always including the current one. The index is adjusted to the new list. */
export function windowQueue(tracks: Track[], index: number, max = MAX_QUEUE): { tracks: Track[]; index: number } {
  if (tracks.length <= max) return { tracks, index }
  const start = Math.min(Math.max(0, index - 5), tracks.length - max)
  return { tracks: tracks.slice(start, start + max), index: index - start }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-protocol.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/protocol.ts tests/sync-protocol.test.ts
git commit -m "feat(sync): add listen-together protocol types and validation"
```

---

### Task 2: Clock estimator

**Files:**
- Create: `src/shared/sync/clock.ts`
- Test: `tests/sync-clock.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync-clock.test.ts
import { expect, test } from 'vitest'
import { ClockEstimator } from '../src/shared/sync/clock'

// The peer's clock reads 500 ms ahead of ours.
const SKEW = 500

/** One ping/pong round trip with the given one-way latencies. Returns [t0, t1, t2]. */
function trip(t0: number, out: number, back: number): [number, number, number] {
  const t1 = t0 + out + SKEW // peer clock when the ping arrives
  const t2 = t0 + out + back // our clock when the pong arrives
  return [t0, t1, t2]
}

test('symmetric latency gives the exact offset', () => {
  const c = new ClockEstimator()
  c.add(...trip(1000, 40, 40))
  expect(c.offset).toBe(SKEW)
})

test('asymmetric latency is off by at most half the difference', () => {
  const c = new ClockEstimator()
  c.add(...trip(1000, 10, 30))
  expect(Math.abs(c.offset - SKEW)).toBeLessThanOrEqual(10)
})

test('the sample with the shortest round trip wins', () => {
  const c = new ClockEstimator()
  c.add(...trip(1000, 200, 20)) // slow, lopsided: error 90
  c.add(...trip(2000, 15, 15)) // fast, exact
  expect(c.offset).toBe(SKEW)
})

test('toLocal converts a peer timestamp to our clock', () => {
  const c = new ClockEstimator()
  c.add(...trip(1000, 20, 20))
  expect(c.toLocal(5000 + SKEW)).toBe(5000)
})

test('offset is 0 before any sample', () => {
  const c = new ClockEstimator()
  expect(c.offset).toBe(0)
  expect(c.toLocal(123)).toBe(123)
})

test('stable needs three samples that agree', () => {
  const c = new ClockEstimator()
  c.add(...trip(1000, 20, 20))
  c.add(...trip(2000, 20, 20))
  expect(c.stable).toBe(false)
  c.add(...trip(3000, 25, 25))
  expect(c.stable).toBe(true)
  c.add(...trip(4000, 20, 200)) // very lopsided: offset moves by about 90 ms
  c.add(...trip(5000, 200, 20))
  expect(c.stable).toBe(false)
})

test('a negative round trip is ignored', () => {
  const c = new ClockEstimator()
  c.add(2000, 1000, 1500)
  expect(c.offset).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-clock.test.ts`
Expected: FAIL, cannot resolve `../src/shared/sync/clock`

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/sync/clock.ts
interface Sample {
  offset: number
  rtt: number
}

/**
 * Estimates how far the partner's clock is ahead of ours, NTP-style:
 * we send a ping at t0, the peer stamps t1 when it answers, we receive at t2.
 * The sample with the shortest round trip is the most trustworthy.
 */
export class ClockEstimator {
  private samples: Sample[] = []

  constructor(private readonly max = 8) {}

  add(t0: number, t1: number, t2: number): void {
    const rtt = t2 - t0
    if (rtt < 0) return
    this.samples.push({ offset: t1 - (t0 + t2) / 2, rtt })
    if (this.samples.length > this.max) this.samples.shift()
  }

  /** Peer clock minus our clock, in ms. 0 until the first sample. */
  get offset(): number {
    let best: Sample | undefined
    for (const s of this.samples) if (!best || s.rtt < best.rtt) best = s
    return best?.offset ?? 0
  }

  toLocal(peerTs: number): number {
    return peerTs - this.offset
  }

  /** True once there are enough samples and they agree to within 100 ms. */
  get stable(): boolean {
    if (this.samples.length < 3) return false
    const offs = this.samples.map((s) => s.offset)
    return Math.max(...offs) - Math.min(...offs) < 100
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-clock.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/clock.ts tests/sync-clock.test.ts
git commit -m "feat(sync): estimate the partner's clock offset"
```

---

### Task 3: Drift reconcile

**Files:**
- Create: `src/shared/sync/reconcile.ts`
- Test: `tests/sync-reconcile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync-reconcile.test.ts
import { expect, test } from 'vitest'
import { expectedPosition, reconcile } from '../src/shared/sync/reconcile'

test('small drift needs nothing', () => {
  expect(reconcile(0.1)).toEqual({ kind: 'none' })
  expect(reconcile(-0.19)).toEqual({ kind: 'none' })
})

test('ahead of the partner slows down, behind speeds up', () => {
  expect(reconcile(0.3)).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(-0.3)).toEqual({ kind: 'rate', rate: 1.03 })
})

test('one second or more is a seek', () => {
  expect(reconcile(1)).toEqual({ kind: 'seek' })
  expect(reconcile(-4)).toEqual({ kind: 'seek' })
})

test('once correcting, it keeps going until the drift is nearly gone', () => {
  expect(reconcile(0.1, { correcting: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(0.04, { correcting: true })).toEqual({ kind: 'none' })
})

test('loose mode doubles every threshold', () => {
  expect(reconcile(0.3, { loose: true })).toEqual({ kind: 'none' })
  expect(reconcile(0.5, { loose: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(1.5, { loose: true })).toEqual({ kind: 'rate', rate: 0.97 })
  expect(reconcile(2, { loose: true })).toEqual({ kind: 'seek' })
})

test('expectedPosition advances a playing heartbeat by its age', () => {
  expect(expectedPosition({ position: 10, playing: true }, 1000, 1500)).toBe(10.5)
})

test('expectedPosition does not advance a paused heartbeat', () => {
  expect(expectedPosition({ position: 10, playing: false }, 1000, 1500)).toBe(10)
})

test('expectedPosition ignores a heartbeat that seems to be from the future', () => {
  expect(expectedPosition({ position: 10, playing: true }, 2000, 1500)).toBe(10)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-reconcile.test.ts`
Expected: FAIL, cannot resolve `../src/shared/sync/reconcile`

- [ ] **Step 3: Write the implementation**

```ts
// src/shared/sync/reconcile.ts
/** Below this (seconds) the two sides count as in sync. */
export const SOFT_DRIFT = 0.2
/** While already correcting, keep going until the drift falls below this. */
export const SETTLE_DRIFT = 0.05
/** At or above this, jump instead of changing speed. */
export const SEEK_DRIFT = 1
export const SLOW_RATE = 0.97
export const FAST_RATE = 1.03

export type Correction = { kind: 'none' } | { kind: 'rate'; rate: number } | { kind: 'seek' }

/**
 * `drift` is our position minus the expected one, in seconds (positive means we are ahead).
 * `loose` doubles the thresholds, for when the clock estimate is shaky.
 * `correcting` is true while the rate is already changed, so it does not flap around the threshold.
 */
export function reconcile(drift: number, opts: { loose?: boolean; correcting?: boolean } = {}): Correction {
  const k = opts.loose ? 2 : 1
  const abs = Math.abs(drift)
  if (abs >= SEEK_DRIFT * k) return { kind: 'seek' }
  if (abs >= SOFT_DRIFT * k || (opts.correcting && abs >= SETTLE_DRIFT * k)) {
    return { kind: 'rate', rate: drift > 0 ? SLOW_RATE : FAST_RATE }
  }
  return { kind: 'none' }
}

/** Where the partner should be right now, given a heartbeat stamped at `hbLocalTs` (our clock, ms). */
export function expectedPosition(hb: { position: number; playing: boolean }, hbLocalTs: number, nowLocal: number): number {
  return hb.playing ? hb.position + Math.max(0, nowLocal - hbLocalTs) / 1000 : hb.position
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-reconcile.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/reconcile.ts tests/sync-reconcile.test.ts
git commit -m "feat(sync): decide drift corrections"
```

---

### Task 4: Session state machine and test fakes

**Files:**
- Create: `tests/helpers/sync-fakes.ts`
- Create: `src/shared/sync/session.ts`
- Test: `tests/sync-session.test.ts`

The session file is built up over Tasks 4 to 7. Task 4 covers invites, accept, decline, end, expiry and version checks. Unused imports are fine for now (the tsconfig does not forbid them).

- [ ] **Step 1: Write the test helpers**

```ts
// tests/helpers/sync-fakes.ts
import type { SyncAction, SyncMessage } from '../../src/shared/sync/protocol'
import type { PlayerPort, PlayerSnapshot, Transport } from '../../src/shared/sync/session'

/** A transport wired straight to another one. Uses setTimeout, so tests drive it with fake timers. */
export class FakeTransport implements Transport {
  peer: FakeTransport | null = null
  latency: number | (() => number) = 0
  /** While true, nothing is sent or received (a dropped connection). */
  down = false
  sent: SyncMessage[] = []
  private msg = new Set<(m: SyncMessage) => void>()
  private pres = new Set<(here: boolean) => void>()
  private conn = new Set<(up: boolean) => void>()

  send(m: SyncMessage): void {
    this.sent.push(m)
    const peer = this.peer
    if (!peer || this.down) return
    const delay = typeof this.latency === 'function' ? this.latency() : this.latency
    setTimeout(() => {
      if (!peer.down) peer.deliver(structuredClone(m))
    }, delay)
  }
  onMessage(cb: (m: SyncMessage) => void): () => void {
    this.msg.add(cb)
    return () => this.msg.delete(cb)
  }
  onPartnerPresence(cb: (here: boolean) => void): () => void {
    this.pres.add(cb)
    return () => this.pres.delete(cb)
  }
  onConnection(cb: (up: boolean) => void): () => void {
    this.conn.add(cb)
    return () => this.conn.delete(cb)
  }

  deliver(m: SyncMessage): void {
    this.msg.forEach((cb) => cb(m))
  }
  emitPresence(here: boolean): void {
    this.pres.forEach((cb) => cb(here))
  }
  emitConnection(up: boolean): void {
    this.conn.forEach((cb) => cb(up))
  }
  sentOfType(type: SyncMessage['type']): SyncMessage[] {
    return this.sent.filter((m) => m.type === type)
  }
}

/** A player that just records what it is told and updates its snapshot accordingly. */
export class FakePlayer implements PlayerPort {
  snap: PlayerSnapshot = { tracks: [], index: 0, position: 0, playing: false }
  applied: SyncAction[] = []
  rate = 1

  snapshot(): PlayerSnapshot {
    return this.snap
  }
  apply(a: SyncAction): void {
    this.applied.push(a)
    if (a.kind === 'queue') this.snap = { tracks: a.tracks, index: a.index, position: a.position, playing: a.playing }
    else if (a.kind === 'play') this.snap = { ...this.snap, position: a.position, playing: true }
    else if (a.kind === 'pause') this.snap = { ...this.snap, position: a.position, playing: false }
    else this.snap = { ...this.snap, position: a.position }
  }
  setRate(r: number): void {
    this.rate = r
  }
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/sync-session.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PROTOCOL_VERSION, type SyncMessage, type SyncPayload } from '../src/shared/sync/protocol'
import { SyncSession } from '../src/shared/sync/session'
import type { Track } from '../src/shared/types'
import { FakePlayer, FakeTransport } from './helpers/sync-fakes'

const track = (id: string): Track => ({ videoId: id, title: id, artist: 'x', coverUrl: '', durationSec: 200 })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
})
afterEach(() => {
  vi.useRealTimers()
})

/** Two sessions, 'a' and 'b', joined by fake transports. `skewB` makes b's clock run ahead. */
function setup(opts: { latency?: number | (() => number); skewB?: number } = {}) {
  const ta = new FakeTransport()
  const tb = new FakeTransport()
  ta.peer = tb
  tb.peer = ta
  ta.latency = tb.latency = opts.latency ?? 0
  const pa = new FakePlayer()
  const pb = new FakePlayer()
  const a = new SyncSession({ me: 'a', transport: ta, player: pa })
  const b = new SyncSession({ me: 'b', transport: tb, player: pb, now: () => Date.now() + (opts.skewB ?? 0) })
  for (const t of [ta, tb]) {
    t.emitConnection(true)
    t.emitPresence(true)
  }
  const wait = typeof opts.latency === 'number' ? opts.latency : 200
  return { ta, tb, pa, pb, a, b, wait }
}

type Rig = ReturnType<typeof setup>

/** 'a' invites, 'b' accepts, and the clock pings settle. */
function activate(rig: Rig = setup()): Rig {
  rig.a.invite()
  vi.advanceTimersByTime(rig.wait + 1)
  rig.b.accept()
  vi.advanceTimersByTime(3000)
  return rig
}

const msg = (from: string, p: SyncPayload): SyncMessage => ({ ...p, from, ts: Date.now() }) as SyncMessage

test('invite then accept makes both sides active', () => {
  const t = setup()
  t.a.invite()
  expect(t.a.getState().status).toBe('inviting')
  vi.advanceTimersByTime(1)
  expect(t.b.getState().status).toBe('invited')
  t.b.accept()
  vi.advanceTimersByTime(1)
  expect(t.a.getState().status).toBe('active')
  expect(t.b.getState().status).toBe('active')
})

test('declining ends the invite for the inviter and returns the other side to idle', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(1)
  t.b.decline()
  vi.advanceTimersByTime(1)
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'declined' })
  expect(t.b.getState().status).toBe('idle')
})

test('an unanswered invite expires after 60 s on both sides', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(59_000)
  expect(t.a.getState().status).toBe('inviting')
  expect(t.b.getState().status).toBe('invited')
  vi.advanceTimersByTime(2_000)
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'expired' })
  expect(t.b.getState().status).toBe('idle')
})

test('cancelling an invite returns the other side to idle', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(1)
  t.a.end()
  vi.advanceTimersByTime(1)
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'ended' })
  expect(t.b.getState().status).toBe('idle')
})

test('ending an active session ends the other side too', () => {
  const t = activate()
  t.a.end()
  vi.advanceTimersByTime(1)
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'ended' })
  expect(t.b.getState()).toMatchObject({ status: 'ended', endReason: 'partner-ended' })
})

test('a new invite works after a session ended', () => {
  const t = activate()
  t.a.end()
  vi.advanceTimersByTime(1)
  t.b.invite()
  vi.advanceTimersByTime(1)
  expect(t.a.getState().status).toBe('invited')
})

test('an invite from a different protocol version is declined with a reason', () => {
  const t = setup()
  t.tb.deliver(msg('a', { type: 'invite', version: PROTOCOL_VERSION + 1 }))
  expect(t.b.getState().status).toBe('idle')
  expect(t.tb.sentOfType('decline')[0]).toMatchObject({ reason: 'version' })
})

test('a version decline tells the inviter to update', () => {
  const t = setup()
  t.a.invite()
  t.ta.deliver(msg('b', { type: 'decline', reason: 'version' }))
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'version' })
})

test('simultaneous invites: the smaller id wins and the other side accepts by itself', () => {
  const t = setup()
  t.a.invite()
  t.b.invite()
  vi.advanceTimersByTime(5)
  expect(t.a.getState().status).toBe('active')
  expect(t.b.getState().status).toBe('active')
})

test('messages from ourselves are ignored', () => {
  const t = setup()
  t.ta.deliver(msg('a', { type: 'invite', version: PROTOCOL_VERSION }))
  expect(t.a.getState().status).toBe('idle')
})

test('subscribers hear about state changes and can unsubscribe', () => {
  const t = setup()
  const seen: string[] = []
  const off = t.a.subscribe(() => seen.push(t.a.getState().status))
  t.a.invite()
  off()
  t.a.end()
  expect(seen).toEqual(['inviting'])
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: FAIL, cannot resolve `../src/shared/sync/session`

- [ ] **Step 4: Write the implementation**

```ts
// src/shared/sync/session.ts
import type { Track } from '../types'
import { ClockEstimator } from './clock'
import {
  CLOCK_RESYNC_MS,
  GRACE_MS,
  HEARTBEAT_MS,
  INVITE_TTL_MS,
  PROTOCOL_VERSION,
  windowQueue,
  type MessageOf,
  type SyncAction,
  type SyncMessage,
  type SyncPayload
} from './protocol'
import { expectedPosition, reconcile } from './reconcile'

/** How the session reaches the partner. Desktop uses IPC to a Supabase channel; mobile will use its own. */
export interface Transport {
  send(msg: SyncMessage): void
  onMessage(cb: (msg: SyncMessage) => void): () => void
  /** Whether the partner is on the channel. Should call back right away with the current value. */
  onPartnerPresence(cb: (here: boolean) => void): () => void
  /** Whether our own connection to the channel is up. Should call back right away with the current value. */
  onConnection(cb: (up: boolean) => void): () => void
}

export interface PlayerSnapshot {
  tracks: Track[]
  index: number
  /** Seconds into the current track. */
  position: number
  playing: boolean
}

/** What the session needs from the audio player. `apply` must NOT report the change back to the session. */
export interface PlayerPort {
  snapshot(): PlayerSnapshot
  apply(action: SyncAction): void
  setRate(rate: number): void
}

export type SessionStatus = 'idle' | 'inviting' | 'invited' | 'active' | 'ended'
export type EndReason = 'ended' | 'declined' | 'expired' | 'timeout' | 'version' | 'partner-ended'

export interface SessionState {
  status: SessionStatus
  /** The partner is on the channel. */
  partnerHere: boolean
  /** Our own connection to the channel is up. */
  connected: boolean
  /** The partner reported that their stream failed. */
  partnerError: boolean
  /** The clock estimate is shaky, so drift correction is more forgiving. */
  looseSync: boolean
  endReason: EndReason | null
}

export const INITIAL_STATE: SessionState = {
  status: 'idle',
  partnerHere: false,
  connected: false,
  partnerError: false,
  looseSync: true,
  endReason: null
}

export interface SessionOptions {
  /** Our user id. */
  me: string
  transport: Transport
  player: PlayerPort
  /** Clock in ms. Tests pass a skewed one. */
  now?: () => number
}

type Timer = ReturnType<typeof setTimeout>

export class SyncSession {
  private state: SessionState = { ...INITIAL_STATE }
  private listeners = new Set<() => void>()
  private clock = new ClockEstimator()
  private readonly me: string
  private readonly transport: Transport
  private readonly player: PlayerPort
  private readonly now: () => number
  /** Whoever made the last action; only the lead sends heartbeats. */
  private lead: string | null = null
  private lastAction: { ts: number; from: string } | null = null
  private rejoining = false
  private rate = 1
  private failedId: string | null = null
  private pingSeq = 0
  private inviteTimer: Timer | null = null
  private graceTimer: Timer | null = null
  private heartbeatTimer: Timer | null = null
  private clockTimer: Timer | null = null
  private readonly offs: (() => void)[]

  constructor(o: SessionOptions) {
    this.me = o.me
    this.transport = o.transport
    this.player = o.player
    this.now = o.now ?? Date.now
    this.offs = [
      o.transport.onMessage((m) => this.onMessage(m)),
      o.transport.onPartnerPresence((here) => this.onPresence(here)),
      o.transport.onConnection((up) => this.onConnection(up))
    ]
  }

  getState(): SessionState {
    return this.state
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  dispose(): void {
    this.offs.forEach((off) => off())
    this.clearTimers()
    this.listeners.clear()
  }

  // ---- what the user can do ----

  invite(): void {
    if (this.state.status !== 'idle' && this.state.status !== 'ended') return
    this.set({ status: 'inviting', endReason: null, partnerError: false })
    this.send({ type: 'invite', version: PROTOCOL_VERSION })
    this.inviteTimer = setTimeout(() => this.finish('expired'), INVITE_TTL_MS)
  }

  accept(): void {
    if (this.state.status !== 'invited' || !this.lead) return
    this.doAccept(this.lead)
  }

  decline(): void {
    if (this.state.status !== 'invited') return
    this.clearInviteTimer()
    this.send({ type: 'decline' })
    this.set({ status: 'idle' })
  }

  /** Ends an active session, or cancels an invite we sent. */
  end(): void {
    if (this.state.status !== 'active' && this.state.status !== 'inviting') return
    this.send({ type: 'end' })
    this.finish('ended')
  }

  // ---- incoming ----

  private onMessage(m: SyncMessage): void {
    if (m.from === this.me) return
    switch (m.type) {
      case 'invite':
        return this.onInvite(m)
      case 'accept':
        return this.onAccept(m)
      case 'decline':
        if (this.state.status === 'inviting') this.finish(m.reason === 'version' ? 'version' : 'declined')
        return
      case 'end':
        if (this.state.status === 'active') this.finish('partner-ended')
        else if (this.state.status === 'invited') {
          this.clearInviteTimer()
          this.set({ status: 'idle' })
        }
        return
      default:
        return
    }
  }

  private onInvite(m: MessageOf<'invite'>): void {
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'decline', reason: 'version' })
      return
    }
    const s = this.state.status
    if (s === 'active') return
    if (s === 'inviting') {
      // Both asked at once: the smaller id's invite stands, the other side accepts it.
      if (m.from < this.me) this.doAccept(m.from)
      return
    }
    this.lead = m.from
    this.clearInviteTimer()
    this.set({ status: 'invited', endReason: null })
    this.inviteTimer = setTimeout(() => {
      this.inviteTimer = null
      this.set({ status: 'idle' })
    }, INVITE_TTL_MS)
  }

  private onAccept(m: MessageOf<'accept'>): void {
    if (this.state.status !== 'inviting') return
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'end' })
      this.finish('version')
      return
    }
    this.clearInviteTimer()
    this.startActive(this.me)
  }

  // ---- internals ----

  private doAccept(inviter: string): void {
    this.clearInviteTimer()
    this.send({ type: 'accept', version: PROTOCOL_VERSION, snapshot: null })
    this.startActive(inviter)
  }

  private startActive(lead: string): void {
    this.lead = lead
    this.lastAction = null
    this.rejoining = false
    this.failedId = null
    this.clock = new ClockEstimator()
    this.set({ status: 'active', endReason: null, partnerError: false, looseSync: true })
  }

  private onPresence(here: boolean): void {
    this.set({ partnerHere: here })
  }

  private onConnection(up: boolean): void {
    this.set({ connected: up })
  }

  private finish(reason: EndReason): void {
    this.clearTimers()
    this.setRate(1)
    this.set({ status: 'ended', endReason: reason, partnerError: false })
  }

  private setRate(r: number): void {
    if (this.rate === r) return
    this.rate = r
    this.player.setRate(r)
  }

  private clearInviteTimer(): void {
    if (this.inviteTimer) clearTimeout(this.inviteTimer)
    this.inviteTimer = null
  }

  private clearTimers(): void {
    this.clearInviteTimer()
    if (this.graceTimer) clearTimeout(this.graceTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.graceTimer = this.heartbeatTimer = this.clockTimer = null
  }

  private set(patch: Partial<SessionState>): void {
    const next = { ...this.state, ...patch }
    if (Object.keys(patch).every((k) => this.state[k as keyof SessionState] === next[k as keyof SessionState])) return
    this.state = next
    this.listeners.forEach((cb) => cb())
  }

  private send(payload: SyncPayload, ts: number = this.now()): void {
    this.transport.send({ ...payload, from: this.me, ts } as SyncMessage)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Commit**

```bash
git add src/shared/sync/session.ts tests/helpers/sync-fakes.ts tests/sync-session.test.ts
git commit -m "feat(sync): session state machine for invites"
```

---

### Task 5: Clock pings, actions and last command wins

**Files:**
- Modify: `src/shared/sync/session.ts`
- Test: `tests/sync-session.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

```ts
// append to tests/sync-session.test.ts
import type { SyncAction } from '../src/shared/sync/protocol'

const pause = (position: number): SyncAction => ({ kind: 'pause', position })
const play = (position: number): SyncAction => ({ kind: 'play', position })
const queueOf = (ids: string[], index = 0, position = 0, playing = true): SyncAction => ({
  kind: 'queue',
  tracks: ids.map(track),
  index,
  position,
  playing
})

test('clock pings run after the session starts and settle the estimate', () => {
  const t = activate()
  expect(t.a.getState().looseSync).toBe(false)
  expect(t.b.getState().looseSync).toBe(false)
})

test('a local action is sent and applied by the other side', () => {
  const t = activate()
  t.a.localAction(pause(42))
  vi.advanceTimersByTime(1)
  expect(t.pb.applied).toEqual([pause(42)])
})

test('applying a remote action does not send it back', () => {
  const t = activate()
  t.a.localAction(pause(42))
  vi.advanceTimersByTime(50)
  expect(t.tb.sentOfType('action')).toHaveLength(0)
})

test('local actions are ignored outside an active session', () => {
  const t = setup()
  t.a.localAction(pause(1))
  expect(t.ta.sentOfType('action')).toHaveLength(0)
})

test('the later action wins when two sides act at nearly the same time', () => {
  const t = activate(setup({ latency: 100 }))
  t.a.localAction(pause(10)) // at T
  vi.advanceTimersByTime(50)
  t.b.localAction(play(10)) // at T + 50
  vi.advanceTimersByTime(300)
  expect(t.pa.applied).toEqual([play(10)]) // a accepted the later action
  expect(t.pb.applied).toEqual([]) // b ignored the earlier one
})

test('the later action wins even when the two clocks disagree', () => {
  const t = activate(setup({ latency: 100, skewB: 500 }))
  t.a.localAction(pause(10)) // real time T
  vi.advanceTimersByTime(50)
  t.b.localAction(play(10)) // real time T + 50, stamped T + 550 on b's clock
  vi.advanceTimersByTime(300)
  expect(t.pa.applied).toEqual([play(10)])
  expect(t.pb.applied).toEqual([])
})

test('with identical timestamps the smaller user id wins on both sides', () => {
  const t = activate(setup({ latency: 100 }))
  t.a.localAction(pause(10))
  t.b.localAction(play(10)) // same instant
  vi.advanceTimersByTime(300)
  expect(t.pb.applied).toEqual([pause(10)]) // b took a's action
  expect(t.pa.applied).toEqual([]) // a ignored b's
})

test('the inviter\'s queue is the starting state when it is already playing', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(1)
  t.pa.snap = { tracks: [track('x'), track('y')], index: 1, position: 30, playing: true }
  t.pb.snap = { tracks: [track('other')], index: 0, position: 5, playing: true }
  t.b.accept()
  vi.advanceTimersByTime(5)
  expect(t.pb.applied[0]).toMatchObject({ kind: 'queue', index: 1, position: 30 })
  expect(t.pa.applied).toEqual([]) // b's own queue lost
})

test('the acceptor\'s queue is used when the inviter has nothing playing', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(1)
  t.pb.snap = { tracks: [track('mine')], index: 0, position: 12, playing: true }
  t.b.accept()
  vi.advanceTimersByTime(5)
  expect(t.pa.applied[0]).toMatchObject({ kind: 'queue', position: 12 })
})

test('both idle: the session starts empty', () => {
  const t = activate()
  expect(t.pa.applied).toEqual([])
  expect(t.pb.applied).toEqual([])
})

test('a very long queue is windowed before sending', () => {
  const t = activate()
  const ids = Array.from({ length: 300 }, (_, i) => `t${i}`)
  t.a.localAction(queueOf(ids, 150))
  vi.advanceTimersByTime(1)
  const got = t.pb.applied[0]
  if (got.kind !== 'queue') throw new Error('expected a queue action')
  expect(got.tracks).toHaveLength(100)
  expect(got.tracks[got.index].videoId).toBe('t150')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: FAIL, `t.a.localAction is not a function` (and the clock test fails on `looseSync`)

- [ ] **Step 3: Extend the implementation**

Edit `src/shared/sync/session.ts`.

3a. In `onMessage`, replace the `default:` branch (the last case in the switch):

```ts
      default:
        return
    }
  }

  private onInvite(
```

with:

```ts
      case 'action':
        if (this.state.status === 'active') this.applyIncoming(m.action, m.ts, m.from)
        return
      case 'ping':
        if (this.state.status === 'active') this.send({ type: 'pong', id: m.id, t0: m.ts })
        return
      case 'pong':
        if (this.state.status !== 'active') return
        this.clock.add(m.t0, m.ts, this.now())
        this.set({ looseSync: !this.clock.stable })
        return
      default:
        return
    }
  }

  private onInvite(
```

3b. Replace `onAccept`'s last line `this.startActive(this.me)` with:

```ts
    this.startActive(this.me)
    // Whoever is already playing sets the starting state; the inviter wins if both are.
    const mine = this.snapshotAction()
    if (mine) this.localAction(mine)
    else if (m.snapshot) this.applyIncoming(m.snapshot, m.ts, m.from)
```

3c. Replace `doAccept`'s send line so the snapshot is included:

```ts
    this.send({ type: 'accept', version: PROTOCOL_VERSION, snapshot: this.snapshotAction() })
```

3d. In `startActive`, after the `this.set({ status: 'active', ... })` line add:

```ts
    this.burstPings(5, 200)
    this.clockTimer = setInterval(() => this.sendPing(), CLOCK_RESYNC_MS)
```

3e. Add these methods inside the class, directly above `private doAccept(`:

```ts
  /** Called by the player whenever the user does something. Applied locally already; this tells the partner. */
  localAction(action: SyncAction): void {
    if (this.state.status !== 'active') return
    const a = action.kind === 'queue' ? this.windowed(action) : action
    const ts = this.now()
    this.lastAction = { ts, from: this.me }
    this.lead = this.me
    this.send({ type: 'action', action: a }, ts)
  }

  /** Applies an action from the partner unless a later one (ours or theirs) already won. */
  private applyIncoming(action: SyncAction, peerTs: number, from: string): void {
    const ts = this.clock.toLocal(peerTs)
    const last = this.lastAction
    if (last && (last.ts > ts || (last.ts === ts && last.from < from))) return
    this.lastAction = { ts, from }
    this.lead = from
    this.rejoining = false
    this.player.apply(action)
  }

  private windowed(a: Extract<SyncAction, { kind: 'queue' }>): SyncAction {
    const w = windowQueue(a.tracks, a.index)
    return { ...a, tracks: w.tracks, index: w.index }
  }

  /** The current queue as an action, or null when nothing is loaded. */
  private snapshotAction(): SyncAction | null {
    const s = this.player.snapshot()
    if (!s.tracks[s.index]) return null
    return this.windowed({ kind: 'queue', tracks: s.tracks, index: s.index, position: s.position, playing: s.playing })
  }

  private sendSnapshot(): void {
    const a = this.snapshotAction()
    if (a) this.localAction(a)
  }

  private burstPings(n: number, gapMs: number): void {
    for (let i = 0; i < n; i++) setTimeout(() => this.sendPing(), i * gapMs)
  }

  private sendPing(): void {
    if (this.state.status !== 'active') return
    this.send({ type: 'ping', id: `${this.me}:${++this.pingSeq}` })
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: PASS (22 tests)

If "the later action wins ... clocks disagree" fails, check that `activate` advanced time long enough for all five pings (about 1 s) before the actions. It advances 3 s.

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/session.ts tests/sync-session.test.ts
git commit -m "feat(sync): actions, clock pings and last-command-wins"
```

---

### Task 6: Heartbeat, drift correction, resync and stream errors

**Files:**
- Modify: `src/shared/sync/session.ts`
- Test: `tests/sync-session.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

```ts
// append to tests/sync-session.test.ts
const T1 = track('song1')

/** 'a' leads (it invited). Both play song1; b is `bPosition`, a is at 10. */
function withSong(bPosition: number, bPlaying = true) {
  const t = activate()
  t.pa.snap = { tracks: [T1], index: 0, position: 10, playing: true }
  t.pb.snap = { tracks: [T1], index: 0, position: bPosition, playing: bPlaying }
  return t
}

test('the lead sends heartbeats every 3 s and the follower does not', () => {
  const t = withSong(10)
  const before = t.ta.sentOfType('heartbeat').length
  vi.advanceTimersByTime(9000)
  expect(t.ta.sentOfType('heartbeat').length - before).toBe(3)
  expect(t.tb.sentOfType('heartbeat')).toHaveLength(0)
})

test('a follower that is a little ahead slows down, then returns to normal speed', () => {
  const t = withSong(10.5)
  vi.advanceTimersByTime(3000)
  expect(t.pb.rate).toBe(0.97)
  t.pb.snap = { ...t.pb.snap, position: 10 } // caught up
  vi.advanceTimersByTime(3000)
  expect(t.pb.rate).toBe(1)
})

test('a follower that is a little behind speeds up', () => {
  const t = withSong(9.6)
  vi.advanceTimersByTime(3000)
  expect(t.pb.rate).toBe(1.03)
})

test('a follower that is far off seeks to the expected position', () => {
  const t = withSong(13)
  vi.advanceTimersByTime(3000)
  expect(t.pb.applied.at(-1)).toEqual({ kind: 'seek', position: 10 })
  expect(t.pb.rate).toBe(1)
})

test('a follower that is in sync is left alone', () => {
  const t = withSong(10.05)
  vi.advanceTimersByTime(3000)
  expect(t.pb.applied).toEqual([])
  expect(t.pb.rate).toBe(1)
})

test('a follower that is paused while the lead plays is told to play', () => {
  const t = withSong(10, false)
  vi.advanceTimersByTime(3000)
  expect(t.pb.applied.at(-1)).toMatchObject({ kind: 'play' })
})

test('a heartbeat for another track makes the follower ask for a resync and get a snapshot', () => {
  const t = withSong(10)
  t.pb.snap = { tracks: [track('other')], index: 0, position: 3, playing: true }
  vi.advanceTimersByTime(3000)
  expect(t.tb.sentOfType('resync')).toHaveLength(1)
  vi.advanceTimersByTime(10)
  expect(t.pb.applied.at(-1)).toMatchObject({ kind: 'queue', index: 0 })
})

test('after the follower acts, it becomes the lead and the other side follows its heartbeats', () => {
  const t = withSong(10)
  t.b.localAction(pause(10))
  vi.advanceTimersByTime(10)
  const aBefore = t.ta.sentOfType('heartbeat').length
  vi.advanceTimersByTime(6000)
  expect(t.ta.sentOfType('heartbeat').length).toBe(aBefore) // a stopped sending
  expect(t.tb.sentOfType('heartbeat').length).toBeGreaterThan(0)
})

test('loose sync tolerates twice the drift', () => {
  const t = setup()
  t.a.invite()
  vi.advanceTimersByTime(1)
  t.b.accept()
  // Heartbeat arrives before the pings could settle the clock: still loose.
  t.pa.snap = { tracks: [T1], index: 0, position: 10, playing: true }
  t.pb.snap = { tracks: [T1], index: 0, position: 10.3, playing: true }
  t.tb.deliver(msg('a', { type: 'heartbeat', videoId: 'song1', position: 10, playing: true }))
  expect(t.pb.rate).toBe(1)
})

test('a stream error on one side is reported and does not break the session', () => {
  const t = activate()
  t.b.reportStreamError('song1')
  vi.advanceTimersByTime(1)
  expect(t.a.getState().partnerError).toBe(true)
  expect(t.a.getState().status).toBe('active')
})

test('the failed side does not ask for a resync of the track it could not play', () => {
  const t = activate()
  t.pa.snap = { tracks: [T1], index: 0, position: 10, playing: true }
  t.pb.snap = { tracks: [track('next')], index: 0, position: 0, playing: true } // skipped past song1
  t.b.reportStreamError('song1')
  vi.advanceTimersByTime(9000)
  expect(t.tb.sentOfType('resync')).toHaveLength(0)
})

test('the error clears once the lead moves on', () => {
  const t = activate()
  t.pa.snap = { tracks: [T1], index: 0, position: 10, playing: true }
  t.pb.snap = { tracks: [track('next')], index: 0, position: 0, playing: true }
  t.b.reportStreamError('song1')
  vi.advanceTimersByTime(1)
  t.pa.snap = { tracks: [track('next')], index: 0, position: 1, playing: true }
  vi.advanceTimersByTime(3000)
  expect(t.a.getState().partnerError).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: FAIL, `reportStreamError is not a function` and missing heartbeat behavior

- [ ] **Step 3: Extend the implementation**

Edit `src/shared/sync/session.ts`.

3a. In `onMessage`, add these cases directly above `default:`:

```ts
      case 'heartbeat':
        if (this.state.status === 'active') this.onHeartbeat(m)
        return
      case 'resync':
        if (this.state.status === 'active' && this.lead === this.me) this.sendSnapshot()
        return
      case 'status':
        if (this.state.status === 'active') this.set({ partnerError: m.state === 'error' })
        return
```

3b. In `startActive`, after the `this.clockTimer = setInterval(...)` line add:

```ts
    this.heartbeatTimer = setInterval(() => this.beat(), HEARTBEAT_MS)
```

3c. Add these methods inside the class, directly above `private doAccept(`:

```ts
  /** The player calls this when a track cannot be streamed, so the session does not fight the skip. */
  reportStreamError(videoId: string): void {
    if (this.state.status !== 'active') return
    this.failedId = videoId
    this.send({ type: 'status', state: 'error' })
  }

  private beat(): void {
    if (this.state.status !== 'active' || this.lead !== this.me) return
    const s = this.player.snapshot()
    this.send({
      type: 'heartbeat',
      videoId: s.tracks[s.index]?.videoId ?? null,
      position: s.position,
      playing: s.playing
    })
  }

  private onHeartbeat(m: MessageOf<'heartbeat'>): void {
    if (this.lead === this.me) return
    if (this.failedId && m.videoId !== this.failedId) {
      this.failedId = null
      this.send({ type: 'status', state: 'ok' })
    }
    const s = this.player.snapshot()
    const mine = s.tracks[s.index]?.videoId ?? null
    if (m.videoId !== mine) {
      // A missed message, or we skipped a track we could not play. Ask again unless it is the latter.
      if (m.videoId !== null && m.videoId !== this.failedId) this.send({ type: 'resync' })
      return
    }
    if (mine === null) return
    const expected = expectedPosition(m, this.clock.toLocal(m.ts), this.now())
    if (m.playing !== s.playing) {
      this.player.apply({ kind: m.playing ? 'play' : 'pause', position: expected })
      return
    }
    const c = reconcile(s.position - expected, { loose: !this.clock.stable, correcting: this.rate !== 1 })
    if (c.kind === 'seek') {
      this.player.apply({ kind: 'seek', position: expected })
      this.setRate(1)
    } else if (c.kind === 'rate') {
      this.setRate(c.rate)
    } else {
      this.setRate(1)
    }
  }

```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: PASS (33 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/session.ts tests/sync-session.test.ts
git commit -m "feat(sync): heartbeats, drift correction and resync"
```

---

### Task 7: Presence, reconnect and the 2-minute grace period

**Files:**
- Modify: `src/shared/sync/session.ts`
- Test: `tests/sync-session.test.ts` (append)

- [ ] **Step 1: Append the failing tests**

```ts
// append to tests/sync-session.test.ts
test('the session survives a short absence', () => {
  const t = activate()
  t.ta.emitPresence(false)
  vi.advanceTimersByTime(119_000)
  expect(t.a.getState().status).toBe('active')
  expect(t.a.getState().partnerHere).toBe(false)
})

test('the session ends after 2 minutes without the partner, on both sides', () => {
  const t = activate()
  t.ta.emitPresence(false)
  vi.advanceTimersByTime(121_000)
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'timeout' })
  expect(t.b.getState()).toMatchObject({ status: 'ended', endReason: 'partner-ended' })
})

test('the partner returning in time cancels the countdown', () => {
  const t = activate()
  t.ta.emitPresence(false)
  vi.advanceTimersByTime(60_000)
  t.ta.emitPresence(true)
  vi.advanceTimersByTime(180_000)
  expect(t.a.getState().status).toBe('active')
})

test('the dropped side closes its own session after 2 minutes too', () => {
  const t = activate()
  t.tb.down = true
  t.tb.emitConnection(false)
  vi.advanceTimersByTime(121_000)
  expect(t.b.getState()).toMatchObject({ status: 'ended', endReason: 'timeout' })
})

test('a side that regains its connection catches up to the current position', () => {
  const t = activate()
  t.pa.snap = { tracks: [T1], index: 0, position: 42, playing: true }
  t.pb.snap = { tracks: [T1], index: 0, position: 5, playing: false }
  t.tb.down = true
  t.tb.emitConnection(false)
  t.ta.emitPresence(false)
  vi.advanceTimersByTime(30_000)
  t.tb.down = false
  t.tb.emitConnection(true)
  t.ta.emitPresence(true)
  vi.advanceTimersByTime(10)
  expect(t.pb.applied.at(-1)).toMatchObject({ kind: 'queue', position: 42, playing: true })
  expect(t.b.getState().status).toBe('active')
})

test('if both sides were away, only the smaller id sends the snapshot', () => {
  const t = activate()
  t.pa.snap = { tracks: [T1], index: 0, position: 42, playing: true }
  t.pb.snap = { tracks: [track('stale')], index: 0, position: 9, playing: true }
  for (const tr of [t.ta, t.tb]) {
    tr.emitConnection(false)
  }
  t.tb.down = t.ta.down = true
  vi.advanceTimersByTime(5000)
  t.tb.down = t.ta.down = false
  t.ta.emitConnection(true)
  t.tb.emitConnection(true)
  vi.advanceTimersByTime(10)
  expect(t.pb.applied.at(-1)).toMatchObject({ kind: 'queue', position: 42 })
  expect(t.pa.applied).toEqual([])
})

test('a hello from a different protocol version ends the session', () => {
  const t = activate()
  t.ta.deliver(msg('b', { type: 'hello', version: PROTOCOL_VERSION + 1 }))
  expect(t.a.getState()).toMatchObject({ status: 'ended', endReason: 'version' })
})

test('the presence and connection flags are exposed in the state', () => {
  const t = setup()
  expect(t.a.getState()).toMatchObject({ connected: true, partnerHere: true })
  t.ta.emitConnection(false)
  t.ta.emitPresence(false)
  expect(t.a.getState()).toMatchObject({ connected: false, partnerHere: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: FAIL (timeout tests, rejoin tests)

- [ ] **Step 3: Extend the implementation**

Edit `src/shared/sync/session.ts`.

3a. Replace `onPresence` and `onConnection` with:

```ts
  private onPresence(here: boolean): void {
    this.set({ partnerHere: here })
    this.updateGrace()
  }

  private onConnection(up: boolean): void {
    const was = this.state.connected
    this.set({ connected: up })
    if (up && !was && this.state.status === 'active') {
      // We were away: tell the partner and wait for the current state.
      this.rejoining = true
      this.send({ type: 'hello', version: PROTOCOL_VERSION })
    }
    this.updateGrace()
  }

  /** Starts or cancels the 2-minute countdown depending on whether either side is away. */
  private updateGrace(): void {
    const away = this.state.status === 'active' && (!this.state.partnerHere || !this.state.connected)
    if (away && !this.graceTimer) {
      this.graceTimer = setTimeout(() => {
        this.graceTimer = null
        this.send({ type: 'end' }) // best effort: it is lost if we are the side that is offline
        this.finish('timeout')
      }, GRACE_MS)
    } else if (!away && this.graceTimer) {
      clearTimeout(this.graceTimer)
      this.graceTimer = null
    }
  }
```

3b. In `onMessage`, add this case directly above `default:`:

```ts
      case 'hello':
        if (this.state.status === 'active') this.onHello(m)
        return
```

3c. Add this method inside the class, directly above `private doAccept(`:

```ts
  private onHello(m: MessageOf<'hello'>): void {
    if (m.version !== PROTOCOL_VERSION) {
      this.send({ type: 'end' })
      this.finish('version')
      return
    }
    this.burstPings(3, 200) // latency may have changed with the new connection
    if (this.rejoining) {
      // Both sides were away: the smaller id's state stands, the other waits for it.
      if (this.me < m.from) {
        this.rejoining = false
        this.sendSnapshot()
      }
      return
    }
    this.sendSnapshot()
  }
```

3d. In `startActive`, add `this.updateGrace()` as the last line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sync-session.test.ts`
Expected: PASS (41 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sync/session.ts tests/sync-session.test.ts
git commit -m "feat(sync): handle partner absence, reconnect and timeout"
```

---

### Task 8: Integration test with random latency

**Files:**
- Test: `tests/sync-integration.test.ts`

No new implementation: this checks that the pieces agree under realistic, jittery latency.

- [ ] **Step 1: Write the test**

```ts
// tests/sync-integration.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SyncAction } from '../src/shared/sync/protocol'
import { SyncSession } from '../src/shared/sync/session'
import type { Track } from '../src/shared/types'
import { FakePlayer, FakeTransport } from './helpers/sync-fakes'

const track = (id: string): Track => ({ videoId: id, title: id, artist: 'x', coverUrl: '', durationSec: 200 })
const LIB = ['s1', 's2', 's3', 's4'].map(track)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(5_000_000)
})
afterEach(() => vi.useRealTimers())

/** Small deterministic random generator, so a failure can be reproduced. */
function lcg(seed: number): () => number {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
}

test.each([1, 2, 3, 4, 5])('two sessions agree after random actions over a jittery link (seed %i)', (seed) => {
  const rnd = lcg(seed)
  const ta = new FakeTransport()
  const tb = new FakeTransport()
  ta.peer = tb
  tb.peer = ta
  ta.latency = tb.latency = () => 20 + rnd() * 130
  const pa = new FakePlayer()
  const pb = new FakePlayer()
  const a = new SyncSession({ me: 'a', transport: ta, player: pa })
  const b = new SyncSession({ me: 'b', transport: tb, player: pb, now: () => Date.now() + 750 })
  for (const t of [ta, tb]) {
    t.emitConnection(true)
    t.emitPresence(true)
  }

  a.invite()
  vi.advanceTimersByTime(300)
  b.accept()
  vi.advanceTimersByTime(3000)
  expect(a.getState().status).toBe('active')
  expect(b.getState().status).toBe('active')

  const users = [
    { player: pa, session: a },
    { player: pb, session: b }
  ]
  for (let i = 0; i < 30; i++) {
    const u = users[rnd() < 0.5 ? 0 : 1]
    const pick = rnd()
    const position = Math.floor(rnd() * 180)
    const action: SyncAction =
      pick < 0.3
        ? { kind: 'queue', tracks: LIB, index: Math.floor(rnd() * LIB.length), position: 0, playing: true }
        : pick < 0.5
          ? { kind: 'play', position }
          : pick < 0.75
            ? { kind: 'pause', position }
            : { kind: 'seek', position }
    // The real player has already done this locally by the time the session hears about it.
    u.player.apply(action)
    u.session.localAction(action)
    // Gaps are longer than the worst latency, so actions never overlap.
    vi.advanceTimersByTime(400 + rnd() * 600)
  }
  vi.advanceTimersByTime(10_000)

  const ids = (p: FakePlayer): string[] => p.snap.tracks.map((t) => t.videoId)
  expect(ids(pb)).toEqual(ids(pa))
  expect(pb.snap.index).toBe(pa.snap.index)
  expect(pb.snap.playing).toBe(pa.snap.playing)
  expect(a.getState().status).toBe('active')
  expect(b.getState().status).toBe('active')
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/sync-integration.test.ts`
Expected: PASS (5 tests)

If a seed fails, the usual cause is a heartbeat-driven `play` or `pause` flipping state right after an action. Print `pa.applied` and `pb.applied` for that seed and fix the session logic, not the test.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all tests PASS (existing ones plus the new sync tests)

- [ ] **Step 4: Commit**

```bash
git add tests/sync-integration.test.ts
git commit -m "test(sync): integration test with jittery latency"
```

---

### Task 9: Realtime channel, pair lookup and IPC wiring

**Files:**
- Create: `src/main/sync/realtime.ts`
- Modify: `src/main/sync/supabase-remote.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

The Realtime adapter is the one part that needs a real Supabase project, so it is checked manually in Task 14.

- [ ] **Step 1: Add the shared type**

Append to `src/shared/types.ts`:

```ts
/** Who we can listen together with. There are only two accounts, so the partner is the other profile. */
export interface ListenInfo {
  me: string
  partnerId: string
  partnerName: string
}

/** Live state of the realtime channel, so the renderer can catch up on events it missed. */
export interface ListenStatus {
  connected: boolean
  partnerHere: boolean
}
```

- [ ] **Step 2: Write the Realtime adapter**

```ts
// src/main/sync/realtime.ts
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { SyncMessage } from '../../shared/sync/protocol'
import type { ListenStatus } from '../../shared/types'

type Emit = (channel: string, value: unknown) => void

/**
 * One Realtime channel shared by the two accounts. Only state is sent (see the spec),
 * never audio. The channel name comes from the two user ids, so no table is needed.
 */
export class PairChannel {
  private channel: RealtimeChannel | null = null
  private name: string | null = null
  private connected = false
  private partnerHere = false

  constructor(
    private readonly sb: SupabaseClient,
    private readonly emit: Emit
  ) {}

  status(): ListenStatus {
    return { connected: this.connected, partnerHere: this.partnerHere }
  }

  async open(me: string, partnerId: string): Promise<void> {
    const name = `phinas:pair:${[me, partnerId].sort().join(':')}`
    if (this.channel && this.name === name) return
    await this.close()
    const ch = this.sb.channel(name, { config: { broadcast: { self: false }, presence: { key: me } } })
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => this.emit('listen:message', payload))
    ch.on('presence', { event: 'sync' }, () => this.setHere(partnerId in ch.presenceState()))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.track({ at: Date.now() })
        this.setConnected(true)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false)
        this.setHere(false) // cannot know while we are offline; the next presence sync fixes it
      }
    })
    this.channel = ch
    this.name = name
  }

  send(msg: SyncMessage): void {
    void this.channel?.send({ type: 'broadcast', event: 'msg', payload: msg })
  }

  async close(): Promise<void> {
    const ch = this.channel
    this.channel = null
    this.name = null
    if (ch) await this.sb.removeChannel(ch)
    this.setConnected(false)
    this.setHere(false)
  }

  private setConnected(v: boolean): void {
    if (this.connected === v) return
    this.connected = v
    this.emit('listen:connection', v)
  }

  private setHere(v: boolean): void {
    if (this.partnerHere === v) return
    this.partnerHere = v
    this.emit('listen:presence', v)
  }
}
```

- [ ] **Step 3: Add the client getter and pair lookup to `SupabaseRemote`**

In `src/main/sync/supabase-remote.ts`, change the first import line to also import the list type:

```ts
import type { ListenInfo, PartnerPlaylist, PlaylistWithTracks, Track } from '../../shared/types'
```

Then add these two members inside the class, directly after `private async me()`:

```ts
  /** The raw client, for the realtime channel. */
  get client(): SupabaseClient {
    return this.sb
  }

  /** The other account (there are only two), or null when it does not exist yet. */
  async pairInfo(): Promise<ListenInfo | null> {
    const me = await this.me()
    const rows = check(
      await this.sb.from('profiles').select('id, display_name').neq('id', me).limit(1)
    ) as unknown as { id: string; display_name: string }[]
    if (rows.length === 0) return null
    return { me, partnerId: rows[0].id, partnerName: rows[0].display_name }
  }
```

- [ ] **Step 4: Extend the IPC types**

In `src/shared/ipc.ts`:

Change the first import line to:

```ts
import type { ListenInfo, ListenStatus, NotchState, PlayRecord, PlayerCommand, Recommendations, HomeFeed, ImportResult, Lyrics, PublicPlaylist, PublicPlaylistDetail, PartnerPlaylist, Playlist, PlaylistWithTracks, SyncStatus, Track } from './types'
import type { SyncMessage } from './sync/protocol'
```

Add to `PhinasApi`, after `setNotchEnabled`:

```ts
  /** Joins the pair channel. Null when not signed in, Supabase is not configured, or there is no partner yet. */
  listenOpen(): Promise<ListenInfo | null>
  listenClose(): Promise<void>
  /** Current connection and partner presence, for catching up on events fired before we subscribed. */
  listenStatus(): Promise<ListenStatus>
```

Add to `PhinasEvents`, after `onNotchLayout`:

```ts
  /** Sends a listen-together message to the partner. */
  listenSend(msg: SyncMessage): void
  /** A raw message from the partner (validate it with `parseMessage`). Returns an unsubscribe. */
  onListenMessage(cb: (raw: unknown) => void): () => void
  onListenPresence(cb: (here: boolean) => void): () => void
  onListenConnection(cb: (up: boolean) => void): () => void
```

Add to `CHANNEL_MAP`, after `setNotchEnabled: true`:

```ts
  setNotchEnabled: true,
  listenOpen: true,
  listenClose: true,
  listenStatus: true
```

(Remember the comma after the existing `setNotchEnabled: true`.)

- [ ] **Step 5: Extend the preload**

In `src/preload/index.ts`, add to the `events` object after `onNotchLayout`:

```ts
  onNotchLayout: (cb) => subscribe('notch:layout', cb),
  listenSend: (msg) => ipcRenderer.send('listen:send', msg),
  onListenMessage: (cb) => subscribe('listen:message', cb),
  onListenPresence: (cb) => subscribe('listen:presence', cb),
  onListenConnection: (cb) => subscribe('listen:connection', cb)
```

(Replace the existing last line `onNotchLayout: ...` so it ends with a comma.)

- [ ] **Step 6: Add the handlers**

In `src/main/ipc.ts`:

Add the import next to the other sync imports:

```ts
import type { PairChannel } from './sync/realtime'
```

Add to `Deps`, after `remote`:

```ts
  /** Realtime channel for listen together; null when Supabase is not configured. */
  pair: PairChannel | null
```

Replace the `syncSignOut` handler with:

```ts
    syncSignOut: async () => {
      await d.pair?.close()
      await requireRemote().signOut()
    },
```

Add before `copyPartnerPlaylist`:

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
    listenStatus: async () => d.pair?.status() ?? { connected: false, partnerHere: false },
```

- [ ] **Step 7: Wire it in the main process**

In `src/main/index.ts`:

Add the import:

```ts
import { PairChannel } from './sync/realtime'
```

Directly after the line `let mainWindow: BrowserWindow | null = null`, add:

```ts
  const pair = remote
    ? new PairChannel(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
```

In the `createHandlers({ ... })` call add `pair,` after `remote,`.

After the `for (const name of CHANNELS) { ... }` loop add:

```ts
  ipcMain.on('listen:send', (_e, msg) => pair?.send(msg))
```

- [ ] **Step 8: Type check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/main src/shared src/preload
git commit -m "feat(sync): realtime pair channel and IPC wiring"
```

---

### Task 10: Renderer transport over IPC

**Files:**
- Create: `src/renderer/src/sync/ipcTransport.ts`

- [ ] **Step 1: Write the transport**

```ts
// src/renderer/src/sync/ipcTransport.ts
import { parseMessage, type SyncMessage } from '../../../shared/sync/protocol'
import type { Transport } from '../../../shared/sync/session'

export interface IpcTransport extends Transport {
  dispose(): void
}

/** Talks to the partner through the main process, which owns the Supabase channel. */
export function createIpcTransport(): IpcTransport {
  const msg = new Set<(m: SyncMessage) => void>()
  const pres = new Set<(here: boolean) => void>()
  const conn = new Set<(up: boolean) => void>()
  let here = false
  let up = false

  const setHere = (v: boolean): void => {
    here = v
    pres.forEach((cb) => cb(v))
  }
  const setUp = (v: boolean): void => {
    up = v
    conn.forEach((cb) => cb(v))
  }

  const offs = [
    window.phinas.onListenMessage((raw) => {
      const m = parseMessage(raw)
      if (!m) {
        console.warn('[listen] ignored a malformed message')
        return
      }
      msg.forEach((cb) => cb(m))
    }),
    window.phinas.onListenPresence(setHere),
    window.phinas.onListenConnection(setUp)
  ]

  // Events fired before this transport existed would be lost, so ask for the current values.
  void window.phinas
    .listenStatus()
    .then((s) => {
      if (s.connected !== up) setUp(s.connected)
      if (s.partnerHere !== here) setHere(s.partnerHere)
    })
    .catch(() => {
      /* the next event will bring the state */
    })

  return {
    send: (m) => window.phinas.listenSend(m),
    onMessage: (cb) => {
      msg.add(cb)
      return () => msg.delete(cb)
    },
    onPartnerPresence: (cb) => {
      pres.add(cb)
      cb(here)
      return () => pres.delete(cb)
    },
    onConnection: (cb) => {
      conn.add(cb)
      cb(up)
      return () => conn.delete(cb)
    },
    dispose: () => offs.forEach((off) => off())
  }
}
```

- [ ] **Step 2: Type check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/sync/ipcTransport.ts
git commit -m "feat(sync): renderer transport over IPC"
```

---

### Task 11: PlayerProvider hooks

User actions are reported to the session; remote actions are applied without being reported back. The remote path never goes through the user-facing methods, which is what prevents echo loops.

**Files:**
- Modify: `src/renderer/src/player/PlayerProvider.tsx`

- [ ] **Step 1: Imports and types**

Add to the imports at the top:

```ts
import type { SyncAction } from '../../../shared/sync/protocol'
import type { PlayerSnapshot } from '../../../shared/sync/session'
```

Add after the `interface PlayerApi { ... }` block ends. First add this member to `PlayerApi`, after `run(cmd: PlayerCommand): void`:

```ts
  /** Listen-together bridge. User actions go out through the bound sink; remote ones come in through `apply`. */
  sync: SyncBridge
```

Then add above `const Ctx = createContext...`:

```ts
/** Where the player reports user actions and stream failures. Set by the listen-together provider. */
export interface SyncSink {
  action(a: SyncAction): void
  streamError(videoId: string): void
}

export interface SyncBridge {
  bind(sink: SyncSink | null): void
  snapshot(): PlayerSnapshot
  /** Applies a partner's action. Never reported back to the sink. */
  apply(a: SyncAction): void
  setRate(rate: number): void
}

const queueAction = (q: QueueState, position: number, playing: boolean): SyncAction => ({
  kind: 'queue',
  tracks: q.tracks,
  index: q.index,
  position,
  playing
})
```

- [ ] **Step 2: Refs**

After the line `const preMuteVolume = useRef<number | null>(null)` add:

```ts
  const sinkRef = useRef<SyncSink | null>(null)
  const queueRef = useRef(queue)
  queueRef.current = queue
  // Position and play state to restore once a track requested by the partner has loaded.
  const pendingStart = useRef<{ videoId: string; position: number; playing: boolean } | null>(null)
```

- [ ] **Step 3: Load effect**

In the effect that starts with `// Load and start whenever the current track`, replace the `skip` function and the `.then((url) => { ... })` block with:

```ts
    const skip = (): void => {
      if (cancelled) return
      tracker.finish(false)
      sinkRef.current?.streamError(track.videoId)
      setNotice(`Tidak bisa memutar "${track.title}", dilewati.`)
      advance()
    }
    window.phinas
      .streamUrl(track.videoId)
      .then((url) => {
        if (cancelled) return
        const start = pendingStart.current?.videoId === track.videoId ? pendingStart.current : null
        pendingStart.current = null
        audio.src = url
        audio.onerror = skip
        if (start && start.position > 0) {
          audio.addEventListener('loadedmetadata', () => (audio.currentTime = start.position), { once: true })
        }
        if (start && !start.playing) {
          setPlaying(false)
          return
        }
        return audio.play()
      })
      .catch(skip)
```

- [ ] **Step 4: Emit user actions**

Inside `useMemo`, add as the first lines before `const a: PlayerApi = {`:

```ts
    const emit = (action: SyncAction): void => {
      if (action.kind === 'queue' && action.tracks.length === 0) return
      sinkRef.current?.action(action)
    }
```

Then replace these members of the `a` object with the versions below. Leave `setVolume`, `cycleRepeat`, `dismissNotice`, `toggleAutoplay` and `run` as they are.

```ts
      play: (tracks, index) => {
        tracker.finish(true)
        const q = startQueue(tracks, index)
        const nq = shuffle ? shuffleOn(q) : q
        setQueue(nq)
        setToken((t) => t + 1)
        emit(queueAction(nq, 0, true))
      },
      addToQueue: (t) => {
        const had = queue.tracks.length > 0
        const nq = had ? enqueue(queue, t) : startQueue([t], 0)
        setQueue(nq)
        setNotice(`"${t.title}" ditambahkan ke antrean.`)
        emit(queueAction(nq, had ? audio.currentTime : 0, had ? !audio.paused : true))
      },
      playNext: (t) => {
        const had = queue.tracks.length > 0
        const nq = had ? insertNext(queue, t) : startQueue([t], 0)
        setQueue(nq)
        setNotice(`"${t.title}" akan diputar berikutnya.`)
        emit(queueAction(nq, had ? audio.currentTime : 0, had ? !audio.paused : true))
      },
      toggle: () => {
        if (!audio.src) return
        if (audio.paused) {
          void audio.play()
          emit({ kind: 'play', position: audio.currentTime })
        } else {
          audio.pause()
          emit({ kind: 'pause', position: audio.currentTime })
        }
      },
      next: () => {
        tracker.finish(true)
        advance()
        const n = next(queue, repeat)
        if (n) emit(queueAction(n, 0, true))
      },
      prev: () => {
        if (audio.currentTime > 3) {
          audio.currentTime = 0
          emit({ kind: 'seek', position: 0 })
        } else {
          if (queue.index > 0) tracker.finish(true)
          const p = prev(queue)
          setQueue(p)
          if (p !== queue) emit(queueAction(p, 0, true))
        }
      },
      jump: (i) => {
        tracker.finish(true)
        const j = jumpTo(queue, i)
        setQueue(j)
        emit(queueAction(j, 0, true))
      },
      seek: (s) => {
        audio.currentTime = s
        emit({ kind: 'seek', position: s })
      },
```

Replace `toggleShuffle` with:

```ts
      toggleShuffle: () => {
        const nq = shuffle ? shuffleOff(queue) : shuffleOn(queue)
        setShuffle(!shuffle)
        setQueue(nq)
        if (queue.tracks.length) emit(queueAction(nq, audio.currentTime, !audio.paused))
      },
```

Natural advance at the end of a track (`onEnded`, `advance`) is deliberately not emitted: both sides advance by themselves, and the heartbeat corrects any difference.

- [ ] **Step 5: Add the sync bridge**

Add this member to the `a` object, after `run: (cmd) => { ... }` (add a comma after the closing brace of `run`):

```ts
      sync: {
        bind: (sink) => {
          sinkRef.current = sink
        },
        snapshot: () => ({
          tracks: queueRef.current.tracks,
          index: queueRef.current.index,
          position: audio.currentTime,
          playing: !audio.paused
        }),
        setRate: (rate) => {
          audio.playbackRate = rate
        },
        apply: (action) => {
          switch (action.kind) {
            case 'play':
              if (!audio.src) return
              if (Math.abs(audio.currentTime - action.position) > 0.3) audio.currentTime = action.position
              void audio.play()
              return
            case 'pause':
              audio.pause()
              if (Math.abs(audio.currentTime - action.position) > 0.3) audio.currentTime = action.position
              return
            case 'seek':
              audio.currentTime = action.position
              return
            case 'queue': {
              const target = action.tracks[action.index]
              if (!target) return
              const nq: QueueState = { tracks: action.tracks, index: action.index }
              if (current(queueRef.current)?.videoId === target.videoId) {
                // Same song: take the new queue and only correct position and play state.
                setQueue(nq)
                if (Math.abs(audio.currentTime - action.position) > 0.5) audio.currentTime = action.position
                if (action.playing && audio.paused) void audio.play()
                if (!action.playing && !audio.paused) audio.pause()
                return
              }
              tracker.finish(true)
              pendingStart.current = { videoId: target.videoId, position: action.position, playing: action.playing }
              setQueue(nq)
              setToken((t) => t + 1)
            }
          }
        }
      }
```

- [ ] **Step 6: Type check and run the tests**

Run: `npm run typecheck && npm test`
Expected: no type errors, all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/player/PlayerProvider.tsx
git commit -m "feat(player): report user actions and apply remote ones for listen together"
```

---

### Task 12: Listen-together provider

**Files:**
- Create: `src/renderer/src/sync/ListenTogetherProvider.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write the provider**

```tsx
// src/renderer/src/sync/ListenTogetherProvider.tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { INITIAL_STATE, SyncSession, type PlayerPort, type SessionState } from '../../../shared/sync/session'
import type { ListenInfo } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { createIpcTransport } from './ipcTransport'

interface ListenApi {
  /** False until signed in and a partner account exists. */
  available: boolean
  partnerName: string | null
  state: SessionState
  invite(): void
  accept(): void
  decline(): void
  end(): void
}

const Ctx = createContext<ListenApi | null>(null)

export function useListen(): ListenApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useListen must be used inside ListenTogetherProvider')
  return v
}

const RETRY_MS = 15_000

export function ListenTogetherProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const player = usePlayer()
  const playerRef = useRef(player)
  playerRef.current = player
  const [info, setInfo] = useState<ListenInfo | null>(null)
  const [state, setState] = useState<SessionState>(INITIAL_STATE)
  const sessionRef = useRef<SyncSession | null>(null)

  // Join the pair channel. Keep trying until signed in and a partner exists.
  useEffect(() => {
    let alive = true
    let opened = false
    const tryOpen = async (): Promise<void> => {
      const i = await window.phinas.listenOpen().catch(() => null)
      if (!alive || !i) return
      opened = true
      setInfo(i)
    }
    void tryOpen()
    const t = setInterval(() => {
      if (!opened) void tryOpen()
    }, RETRY_MS)
    return () => {
      alive = false
      clearInterval(t)
      void window.phinas.listenClose()
    }
  }, [])

  // One session for as long as the channel is open.
  useEffect(() => {
    if (!info) return
    const transport = createIpcTransport()
    const port: PlayerPort = {
      snapshot: () => playerRef.current.sync.snapshot(),
      apply: (a) => playerRef.current.sync.apply(a),
      setRate: (r) => playerRef.current.sync.setRate(r)
    }
    const session = new SyncSession({ me: info.me, transport, player: port })
    sessionRef.current = session
    const off = session.subscribe(() => setState(session.getState()))
    setState(session.getState())
    playerRef.current.sync.bind({
      action: (a) => session.localAction(a),
      streamError: (id) => session.reportStreamError(id)
    })
    return () => {
      off()
      playerRef.current.sync.bind(null)
      session.dispose()
      transport.dispose()
      sessionRef.current = null
      setState(INITIAL_STATE)
    }
  }, [info])

  const api = useMemo<ListenApi>(
    () => ({
      available: info !== null,
      partnerName: info?.partnerName ?? null,
      state,
      invite: () => sessionRef.current?.invite(),
      accept: () => sessionRef.current?.accept(),
      decline: () => sessionRef.current?.decline(),
      end: () => sessionRef.current?.end()
    }),
    [info, state]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
```

- [ ] **Step 2: Add it to the app**

In `src/renderer/src/App.tsx`, add the import:

```ts
import { ListenTogetherProvider } from './sync/ListenTogetherProvider'
```

Replace the `App` function with:

```tsx
export function App(): React.JSX.Element {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <ListenTogetherProvider>
          <Shell />
        </ListenTogetherProvider>
      </PlayerProvider>
    </LibraryProvider>
  )
}
```

- [ ] **Step 3: Type check**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/sync/ListenTogetherProvider.tsx src/renderer/src/App.tsx
git commit -m "feat(sync): listen-together provider"
```

---

### Task 13: Minimal UI

Kept small on purpose: the UI redesign comes next and will restyle it.

**Files:**
- Create: `src/renderer/src/components/ListenTogether.tsx`
- Modify: `src/renderer/src/components/PlayerBar.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Write the components**

```tsx
// src/renderer/src/components/ListenTogether.tsx
import { Headphones } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { EndReason } from '../../../shared/sync/session'
import { useListen } from '../sync/ListenTogetherProvider'

const ENDED_TEXT: Record<EndReason, string> = {
  ended: 'Sesi diakhiri.',
  declined: 'Ajakan ditolak.',
  expired: 'Ajakan tidak dijawab.',
  timeout: 'Sesi berakhir karena koneksi terputus.',
  version: 'Versi app berbeda. Update app dulu supaya sama.',
  'partner-ended': 'Pasangan mengakhiri sesi.'
}

/** Player bar button: start, cancel or end a session, and show how it is going. */
export function ListenButton(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere, partnerError } = l.state
  const name = l.partnerName ?? 'pasangan'

  if (status === 'active') {
    const label = !connected ? 'Koneksi terputus' : !partnerHere ? `${name} terputus` : partnerError ? `${name}: gagal memutar` : 'Tersambung'
    return (
      <button className="icon-btn on listen-btn" onClick={l.end} title="Akhiri sesi" aria-label="Akhiri sesi dengarkan bareng">
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
  const reason = !connected ? 'Tidak bisa terhubung' : !partnerHere ? `${name} sedang offline` : `Dengarkan bareng ${name}`
  return (
    <button
      className="icon-btn listen-btn"
      onClick={l.invite}
      disabled={!connected || !partnerHere || status === 'invited'}
      title={reason}
      aria-label={reason}
    >
      <Headphones size={18} />
    </button>
  )
}

/** Shown at the top of the page: an incoming invite, or why the last session ended. */
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

  if (status === 'invited') {
    return (
      <div className="notice listen-banner" role="alertdialog">
        <span>{l.partnerName ?? 'Pasangan'} mengajak dengarkan bareng.</span>
        <button className="listen-action" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-action" onClick={l.decline}>
          Tolak
        </button>
      </div>
    )
  }
  if (shownEnd) {
    return (
      <div className="notice" role="status" onClick={() => setShownEnd(null)}>
        {ENDED_TEXT[shownEnd]}
      </div>
    )
  }
  return null
}
```

- [ ] **Step 2: Place them**

In `src/renderer/src/components/PlayerBar.tsx` add the import:

```ts
import { ListenButton } from './ListenTogether'
```

and add `<ListenButton />` as the first child of `<div className="pb-volume">`:

```tsx
      <div className="pb-volume">
        <ListenButton />
        <VolumeIcon size={18} />
```

In `src/renderer/src/App.tsx` add the import:

```ts
import { ListenBanner } from './components/ListenTogether'
```

and add `<ListenBanner />` directly above `{player.notice && (` inside `<main ...>`:

```tsx
      <main ref={mainRef} className="panel main">
        <ListenBanner />
        {player.notice && (
```

- [ ] **Step 3: Styles**

Append to `src/renderer/src/styles.css`:

```css

/* Listen together (kept minimal; the redesign will restyle it) */
.listen-btn { display: inline-flex; align-items: center; gap: 6px; }
.listen-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.listen-label { font-size: 12px; white-space: nowrap; }
.listen-banner { display: flex; align-items: center; gap: 12px; }
.listen-action {
  border: 0;
  border-radius: 999px;
  padding: 4px 14px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  background: var(--accent);
  color: #fff;
}
```

- [ ] **Step 4: Type check and test**

Run: `npm run typecheck && npm test`
Expected: no errors, all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src
git commit -m "feat(ui): minimal listen-together button and invite banner"
```

---

### Task 14: Spec sync and manual verification

**Files:**
- Modify: `docs/superpowers/specs/2026-11-17-listen-together-design.md`
- Modify: `docs/superpowers/specs/2026-11-16-phinas-design.md`

- [ ] **Step 1: Bring the spec in line with the plan**

In the listen-together spec:

1. Under `### Messages`, replace the paragraph with:

```
`invite` and `accept` and `hello` carry the protocol version. `accept` also carries the acceptor's queue, used when the inviter has nothing playing. `decline` (optional reason `version`), `end`, `action`, `heartbeat`, `resync`, `status` (`ok` or `error`), `ping`, `pong`. Every message carries `ts` from the sender's clock; the receiver converts it with the estimated offset.

Actions are `play`, `pause`, `seek` and `queue`. A `queue` action is a full snapshot (tracks, index, position, playing), so it also covers changing track. Queues over 100 tracks are windowed around the current track.
```

2. Under `## Data flow` / `### While active`, replace the heartbeat bullet with:

```
- Only the lead sends `heartbeat` every 3 s. The lead is whoever made the last action (the inviter at the start). The other side reconciles toward it. If a heartbeat shows a different track, the follower sends `resync` and the lead replies with a `queue` snapshot.
```

3. Under `### Drop and return`, replace the "On return" bullet with:

```
- A side that regains its own connection sends `hello`. The other side replies with a `queue` snapshot and the returning side jumps to it. If both were away, the smaller user id sends the snapshot.
```

4. Under `## Architecture`, after the code block add:

```
The session runs in the renderer, next to the audio element. The Realtime channel lives in the main process and is bridged over IPC.
```

- [ ] **Step 2: Update the backlog note in the v1 spec**

In `docs/superpowers/specs/2026-11-16-phinas-design.md`, change the "Listen together" bullet to say it now has a design and plan:

```
- Listen together: designed in `docs/superpowers/specs/2026-11-17-listen-together-design.md`, plan in `docs/superpowers/plans/2026-11-17-listen-together.md`.
```

and remove the five indented "Notes from the first look" sub-bullets under it.

- [ ] **Step 3: Full automated check**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests PASS, build succeeds

- [ ] **Step 4: Manual check with two accounts**

Run the app on two machines (or two Electron profiles) signed in as the two accounts. `npm run dev` on both.

- [ ] The button shows disabled with "… sedang offline" while the partner's app is closed.
- [ ] With both open, the button enables. Click it: the other side shows the invite banner.
- [ ] Decline: the inviter sees "Ajakan ditolak." Invite again and accept: both show the headphones indicator with "Tersambung".
- [ ] Play a song on one side: the other starts the same song within a couple of seconds.
- [ ] Pause, resume and seek from each side in turn: the other side follows.
- [ ] Add a song to the queue and use "play next" from the non-lead side: both queues match.
- [ ] Let it play for two minutes: the two sides stay within about half a second (listen with both speakers in one room).
- [ ] Turn Wi-Fi off on one side for 30 s, then on: the indicator shows disconnected, then catches up to the current position.
- [ ] Keep one side offline for over 2 minutes: both sides end the session with a message.
- [ ] Close the app on one side mid-session: the other ends after 2 minutes.
- [ ] Click "Akhiri sesi": the other side shows "Pasangan mengakhiri sesi."

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: sync the listen-together spec with the plan"
```

---

## Self-review

**Spec coverage**

| Spec item | Task |
|---|---|
| Control: both equal, last command wins, tie by user id | 5 |
| Manual invite, 60 s expiry, not shown late | 4 |
| Session survives a drop, catch-up on return, 2-minute end | 7 |
| Supabase Realtime broadcast + presence, no new tables | 9 |
| Clock sync and drift correction (200 ms rate, 1 s seek) | 2, 3, 6 |
| `shared/sync` with `Transport` and `PlayerPort` | 4 |
| Audio never sent | all (only state is sent) |
| Stream failure on one side | 6, 11 |
| Protocol version mismatch | 4, 7 |
| Malformed messages ignored | 1, 10 |
| Loose sync when clock is unstable | 2, 6 |
| Minimal UI | 13 |
| Testing list | 1 to 8 |
| Out of scope respected | n/a |

**Known limits, accepted on purpose**
- Two actions inside the clock-estimate error (tens of ms) can resolve differently on each side. Heartbeats only correct position, not conflicting queues. Rare for two people.
- Autoplay on each side can add different recommended songs. The next heartbeat shows a different track, which triggers `resync`, so it heals within a few seconds.
- Resuming a session after an app restart is not supported; the other side ends after 2 minutes.
- The channel is public (not private Realtime), but its name comes from two UUIDs, so it cannot be guessed.

**Placeholder scan:** none. Every code step has the code.

**Type consistency:** `SyncAction`, `SyncMessage`, `SyncPayload`, `MessageOf`, `PlayerSnapshot`, `PlayerPort`, `Transport`, `SessionState`, `INITIAL_STATE`, `EndReason`, `SyncSink`, `SyncBridge`, `ListenInfo`, `ListenStatus` are each defined once (Tasks 1, 4, 9, 11) and used by the same names later. Session methods `invite`, `accept`, `decline`, `end`, `localAction`, `reportStreamError`, `subscribe`, `getState`, `dispose` are defined in Tasks 4 to 6 and used in Task 12.
