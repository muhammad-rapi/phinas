import { describe, expect, test } from 'vitest'
import { buildProfile, pickSeeds, RECENT_WINDOW } from '../src/main/recommend/profile'
import { rank } from '../src/main/recommend/rank'
import type { LikeEntry, PlayEntry, Track } from '../src/shared/types'

const DAY = 86_400_000
const NOW = 1_000_000_000_000

const t = (id: string, artist = 'A'): Track => ({ videoId: id, title: id, artist, coverUrl: '', durationSec: 200 })
const play = (id: string, artist: string, ageDays = 0, skipped = false): PlayEntry => ({
  ...t(id, artist),
  playedAt: NOW - ageDays * DAY,
  listenedSec: 60,
  skipped
})
const like = (id: string, artist: string, ageDays = 0): LikeEntry => ({ ...t(id, artist), likedAt: NOW - ageDays * DAY })

describe('buildProfile', () => {
  test('like +3, play +1, skip -2', () => {
    const p = buildProfile([like('l1', 'Liked')], [play('p1', 'Played'), play('s1', 'Skipped', 0, true)], NOW)
    expect(p.artists.get('liked')).toBeCloseTo(3)
    expect(p.artists.get('played')).toBeCloseTo(1)
    expect(p.artists.get('skipped')).toBeCloseTo(-2)
  })

  test('old signals fade with a 30 day half life', () => {
    const p = buildProfile([], [play('p1', 'Old', 30)], NOW)
    expect(p.artists.get('old')).toBeCloseTo(0.5)
  })

  test('collaborations credit every artist', () => {
    const p = buildProfile([like('l1', 'One, Two')], [], NOW)
    expect(p.artists.get('one')).toBeCloseTo(3)
    expect(p.artists.get('two')).toBeCloseTo(3)
  })

  test('recent keeps real plays only, unique, capped', () => {
    const plays = [play('a', 'X'), play('a', 'X', 1), play('s', 'X', 0, true)]
    expect(buildProfile([], plays, NOW).recent).toEqual(['a'])
    const many = Array.from({ length: RECENT_WINDOW + 10 }, (_, i) => play(`v${i}`, 'X', i / 100))
    expect(buildProfile([], many, NOW).recent).toHaveLength(RECENT_WINDOW)
  })

  test('empty history has no known tracks', () => {
    expect(buildProfile([], [], NOW).known.size).toBe(0)
  })
})

describe('pickSeeds', () => {
  test('one seed per artist, best-liked artists first, skipped plays never seed', () => {
    const likes = [like('l1', 'Fav')]
    const plays = [play('p1', 'Meh'), play('p2', 'Fav'), play('s1', 'Hated', 0, true)]
    const profile = buildProfile(likes, plays, NOW)
    const seeds = pickSeeds(profile, likes, plays, 5).map((s) => s.videoId)
    expect(seeds[0]).toBe('p2')
    expect(seeds).not.toContain('s1')
    expect(new Set(seeds.map((id) => id)).size).toBe(seeds.length)
    expect(seeds).toHaveLength(2)
  })
})

describe('rank', () => {
  const profile = buildProfile([like('l1', 'Loved')], [], NOW)

  test('liked artists rise above unknown ones', () => {
    const out = rank([t('x', 'Unknown'), t('y', 'Loved')], profile)
    expect(out.map((o) => o.videoId)).toEqual(['y', 'x'])
  })

  test('skipped tracks fall to the bottom', () => {
    const p = buildProfile([], [play('bad', 'Same', 0, true)], NOW)
    const out = rank([t('bad', 'Other'), t('good', 'Other2')], p)
    expect(out.map((o) => o.videoId)).toEqual(['good', 'bad'])
  })

  test('drops duplicates, excluded and recently played tracks', () => {
    const p = buildProfile([], [play('seen', 'A')], NOW)
    const out = rank([t('seen'), t('keep', 'B'), t('keep', 'B'), t('no', 'C')], p, new Set(['no']))
    expect(out.map((o) => o.videoId)).toEqual(['keep'])
  })

  test('never more than 2 tracks in a row by one artist', () => {
    const cands = [t('1', 'Loved'), t('2', 'Loved'), t('3', 'Loved'), t('4', 'Other'), t('5', 'Other2')]
    const out = rank(cands, profile).map((o) => o.artist)
    for (let i = 2; i < out.length; i++) expect(!(out[i] === out[i - 1] && out[i] === out[i - 2])).toBe(true)
    expect(out).toHaveLength(5)
  })

  test('stops rather than break the artist cap when only one artist is left', () => {
    const out = rank([t('1', 'Solo'), t('2', 'Solo'), t('3', 'Solo')], profile)
    expect(out).toHaveLength(2)
  })

  test('respects limit', () => {
    expect(rank([t('1', 'A'), t('2', 'B'), t('3', 'C')], profile, new Set(), { limit: 2 })).toHaveLength(2)
  })
})
