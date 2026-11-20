import { describe, expect, test } from 'vitest'
import { PlayTracker, playThreshold } from '../src/shared/playTracker'
import type { PlayRecord, Track } from '../src/shared/types'

const track = (durationSec = 200): Track => ({ videoId: 'v1', title: 'T', artist: 'A', coverUrl: '', durationSec })

function setup() {
  const out: PlayRecord[] = []
  return { out, tr: new PlayTracker((r) => out.push(r)) }
}

describe('playThreshold', () => {
  test('30 seconds, or half of a short track', () => {
    expect(playThreshold(200)).toBe(30)
    expect(playThreshold(40)).toBe(20)
    expect(playThreshold(0)).toBe(30)
  })
})

describe('PlayTracker', () => {
  test('counts as played at 30 s, once', () => {
    const { out, tr } = setup()
    tr.start(track())
    tr.tick(29)
    expect(out).toHaveLength(0)
    tr.tick(30)
    tr.tick(60)
    tr.finish(true)
    expect(out).toEqual([{ track: track(), listenedSec: 30, skipped: false }])
  })

  test('short track counts at 50%', () => {
    const { out, tr } = setup()
    tr.start(track(20))
    tr.tick(10)
    expect(out).toHaveLength(1)
  })

  test('manual move before the threshold is a skip', () => {
    const { out, tr } = setup()
    tr.start(track())
    tr.tick(5)
    tr.finish(true)
    expect(out).toEqual([{ track: track(), listenedSec: 5, skipped: true }])
  })

  test('an error or ending before the threshold records nothing', () => {
    const { out, tr } = setup()
    tr.start(track())
    tr.tick(2)
    tr.finish(false)
    expect(out).toHaveLength(0)
  })

  test('finish is safe to call twice and without a track', () => {
    const { out, tr } = setup()
    tr.finish(true)
    tr.start(track())
    tr.finish(true)
    tr.finish(true)
    expect(out).toHaveLength(1)
  })
})
