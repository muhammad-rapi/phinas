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
