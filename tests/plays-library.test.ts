import { beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { Library } from '../src/main/library/library'
import type { Track } from '../src/shared/types'

const t = (id: string, artist = 'A'): Track => ({ videoId: id, title: id, artist, coverUrl: 'c', durationSec: 100 })

let lib: Library
beforeEach(() => {
  lib = new Library(openDb(':memory:'))
})

describe('play history', () => {
  test('recentPlays is unique, newest first, without skips', () => {
    lib.recordPlay({ track: t('a'), listenedSec: 40, skipped: false }, 1)
    lib.recordPlay({ track: t('b'), listenedSec: 40, skipped: false }, 2)
    lib.recordPlay({ track: t('s'), listenedSec: 3, skipped: true }, 3)
    lib.recordPlay({ track: t('a'), listenedSec: 40, skipped: false }, 4)
    expect(lib.recentPlays().map((x) => x.videoId)).toEqual(['a', 'b'])
  })

  test('recentPlays honours the limit', () => {
    for (let i = 0; i < 5; i++) lib.recordPlay({ track: t(`v${i}`), listenedSec: 40, skipped: false }, i)
    expect(lib.recentPlays(3)).toHaveLength(3)
  })

  test('topArtists, trackStats', () => {
    lib.recordPlay({ track: t('a', 'X'), listenedSec: 40, skipped: false }, 1)
    lib.recordPlay({ track: t('b', 'X'), listenedSec: 40, skipped: false }, 2)
    lib.recordPlay({ track: t('c', 'Y'), listenedSec: 40, skipped: false }, 3)
    lib.recordPlay({ track: t('c', 'Y'), listenedSec: 2, skipped: true }, 4)
    expect(lib.topArtists(5)).toEqual([
      { artist: 'X', plays: 2 },
      { artist: 'Y', plays: 1 }
    ])
    expect(lib.trackStats().get('c')).toEqual({ plays: 1, skips: 1 })
  })

  test('history is never queued for sync', () => {
    lib.recordPlay({ track: t('a'), listenedSec: 40, skipped: false })
    expect(lib.pendingKeys()).toEqual([])
  })

  test('playEntries keeps skip flag and time', () => {
    lib.recordPlay({ track: t('a'), listenedSec: 3, skipped: true }, 99)
    expect(lib.playEntries()[0]).toMatchObject({ videoId: 'a', skipped: true, playedAt: 99, listenedSec: 3 })
  })
})
