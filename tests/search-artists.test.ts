import { describe, expect, it } from 'vitest'
import { searchArtists } from '../src/renderer/src/search/artists'
import type { Track } from '../src/shared/types'

const t = (artist: string): Track => ({ videoId: artist, title: "t", artist, durationSec: 0, coverUrl: "" })

describe('searchArtists', () => {
  it('lists each artist once, in order, splitting collaborations', () => {
    expect(searchArtists([t('Tulus'), t('Tulus, BCL'), t('tulus'), t('Raisa & Isyana')])).toEqual(['Tulus', 'BCL', 'Raisa', 'Isyana'])
  })
  it('stops at the limit and skips unknown artists', () => {
    expect(searchArtists([t('A'), t('Unknown artist'), t('B'), t('C')], 2)).toEqual(['A', 'B'])
  })
})
