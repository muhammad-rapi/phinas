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

test("the inviter's queue is the starting state when it is already playing", () => {
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

test("the acceptor's queue is used when the inviter has nothing playing", () => {
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
