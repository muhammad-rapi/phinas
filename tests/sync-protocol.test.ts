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
