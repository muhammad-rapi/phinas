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
