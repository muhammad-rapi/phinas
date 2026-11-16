import { describe, expect, test } from 'vitest'
import {
  current,
  empty,
  enqueue,
  isShuffled,
  jumpTo,
  next,
  prev,
  shuffleOff,
  shuffleOn,
  startQueue
} from '../src/renderer/src/player/queue'
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

  test('next wraps to the start with repeat all, ends otherwise', () => {
    const q = startQueue([t(1), t(2)], 1)
    expect(current(next(q, 'all')!)?.title).toBe('T1')
    expect(next(q, 'off')).toBeNull()
    expect(next(q, 'one')).toBeNull()
    expect(next(startQueue([], -1), 'all')).toBeNull()
  })

  describe('shuffle', () => {
    const five = [t(1), t(2), t(3), t(4), t(5)]
    // Deterministic "random": always picks the first remaining slot.
    const rand = () => 0

    test('keeps the current track in place and only reorders what is upcoming', () => {
      const q = shuffleOn(startQueue(five, 1), rand)
      expect(isShuffled(q)).toBe(true)
      expect(q.index).toBe(1)
      expect(current(q)?.title).toBe('T2')
      expect(q.tracks[0].title).toBe('T1')
      expect(q.tracks.map((x) => x.title).sort()).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    })

    test('actually reorders the upcoming tracks', () => {
      const q = shuffleOn(startQueue(five, 0), () => 0)
      expect(q.tracks.slice(1).map((x) => x.title)).not.toEqual(['T2', 'T3', 'T4', 'T5'])
    })

    test('shuffleOff restores the original order and keeps the same track playing', () => {
      let q = shuffleOn(startQueue(five, 0), () => 0)
      expect(q.tracks.map((x) => x.title)).not.toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
      q = next(q)!
      const playing = current(q)!.title
      const back = shuffleOff(q)
      expect(isShuffled(back)).toBe(false)
      expect(back.tracks.map((x) => x.title)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
      expect(current(back)?.title).toBe(playing)
    })

    test('a track added while shuffled survives turning shuffle off', () => {
      let q = shuffleOn(startQueue(five, 0), rand)
      q = enqueue(q, t(6))
      expect(q.tracks).toHaveLength(6)
      expect(shuffleOff(q).tracks.map((x) => x.title)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6'])
    })

    test('shuffleOff on an unshuffled queue changes nothing', () => {
      const q = startQueue(five, 2)
      expect(shuffleOff(q)).toBe(q)
    })
  })

  test('jumpTo ignores invalid indexes', () => {
    const q = startQueue([t(1), t(2)], 0)
    expect(current(jumpTo(q, 1))?.title).toBe('T2')
    expect(jumpTo(q, 5)).toBe(q)
  })
})
