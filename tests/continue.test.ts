import { describe, expect, test } from 'vitest'
import { continueTrack } from '../src/renderer/src/screens/home/continue'
import type { Track } from '../src/shared/types'

const t = (id: string): Track => ({ videoId: id, title: id, artist: 'A', coverUrl: '', durationSec: 200 })

describe('continueTrack', () => {
  test('the current track wins', () => {
    expect(continueTrack(t('now'), [t('old')])).toEqual({ track: t('now'), isCurrent: true })
  })
  test('without a current track, the most recent play', () => {
    expect(continueTrack(null, [t('a'), t('b')])).toEqual({ track: t('a'), isCurrent: false })
  })
  test('nothing to continue', () => {
    expect(continueTrack(null, [])).toBeNull()
  })
})
