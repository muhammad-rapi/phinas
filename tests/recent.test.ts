import { describe, expect, test } from 'vitest'
import { addRecent, removeQuery, removeRecent, type RecentEntry } from '../src/renderer/src/search/recent'

const q = (text: string): RecentEntry => ({ kind: 'query', text })
const song = (videoId: string): RecentEntry => ({
  kind: 'track',
  track: { videoId, title: videoId, artist: 'A', coverUrl: '', durationSec: 1 }
})

describe('addRecent', () => {
  test('puts the newest entry first', () => {
    expect(addRecent([q('b'), q('a')], q('c'))).toEqual([q('c'), q('b'), q('a')])
  })

  test('moves an existing search to the front, ignoring case and spaces', () => {
    expect(addRecent([q('b'), q('Daft Punk'), q('a')], q('  daft punk '))).toEqual([q('daft punk'), q('b'), q('a')])
  })

  test('ignores empty queries', () => {
    expect(addRecent([q('a')], q('   '))).toEqual([q('a')])
  })

  test('keeps at most 8 entries', () => {
    const list = ['1', '2', '3', '4', '5', '6', '7', '8'].map(q)
    const next = addRecent(list, q('9'))
    expect(next).toHaveLength(8)
    expect(next[0]).toEqual(q('9'))
    expect(next).not.toContainEqual(q('8'))
  })

  test('the same song is listed once, moved to the front', () => {
    expect(addRecent([song('x'), song('y')], song('y')).map((e) => (e.kind === 'track' ? e.track.videoId : ''))).toEqual([
      'y',
      'x'
    ])
  })

  test('a song and a query with the same text are different entries', () => {
    expect(addRecent([q('x')], song('x'))).toHaveLength(2)
  })
})

describe('removeRecent / removeQuery', () => {
  test('removes one entry, ignoring case', () => {
    expect(removeRecent([q('a'), q('B'), q('c')], q('b'))).toEqual([q('a'), q('c')])
  })

  test('removeQuery leaves songs alone', () => {
    expect(removeQuery([song('shape'), q('shape')], 'Shape')).toEqual([song('shape')])
  })
})
