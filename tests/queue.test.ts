import { describe, expect, test } from 'vitest'
import { current, empty, enqueue, jumpTo, next, prev, startQueue } from '../src/renderer/src/player/queue'
import type { Track } from '../src/shared/types'

const t = (n: number): Track => ({
  videoId: `v${n}`.padEnd(11, '0'),
  title: `T${n}`,
  artist: 'A',
  coverUrl: '',
  durationSec: 1
})

describe('queue', () => {
  test('empty has no current', () => {
    expect(current(empty)).toBeNull()
  })

  test('startQueue sets index and current', () => {
    const q = startQueue([t(1), t(2), t(3)], 1)
    expect(current(q)?.title).toBe('T2')
  })

  test('next advances and returns null at the end', () => {
    let q = startQueue([t(1), t(2)], 0)
    q = next(q)!
    expect(current(q)?.title).toBe('T2')
    expect(next(q)).toBeNull()
  })

  test('prev goes back but stays on the first track', () => {
    const q = startQueue([t(1), t(2)], 1)
    expect(current(prev(q))?.title).toBe('T1')
    expect(current(prev(prev(q)))?.title).toBe('T1')
  })

  test('enqueue appends without changing current', () => {
    const q = enqueue(startQueue([t(1)], 0), t(2))
    expect(q.tracks).toHaveLength(2)
    expect(current(q)?.title).toBe('T1')
  })

  test('jumpTo ignores invalid indexes', () => {
    const q = startQueue([t(1), t(2)], 0)
    expect(current(jumpTo(q, 1))?.title).toBe('T2')
    expect(jumpTo(q, 5)).toBe(q)
  })
})
