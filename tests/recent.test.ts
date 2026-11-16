import { describe, expect, test } from 'vitest'
import { addRecent, removeRecent } from '../src/renderer/src/search/recent'

describe('addRecent', () => {
  test('puts the newest search first', () => {
    expect(addRecent(['b', 'a'], 'c')).toEqual(['c', 'b', 'a'])
  })

  test('moves an existing search to the front, ignoring case and spaces', () => {
    expect(addRecent(['b', 'Daft Punk', 'a'], '  daft punk ')).toEqual(['daft punk', 'b', 'a'])
  })

  test('ignores empty queries', () => {
    expect(addRecent(['a'], '   ')).toEqual(['a'])
  })

  test('keeps at most 8 entries', () => {
    const list = ['1', '2', '3', '4', '5', '6', '7', '8']
    const next = addRecent(list, '9')
    expect(next).toHaveLength(8)
    expect(next[0]).toBe('9')
    expect(next).not.toContain('8')
  })
})

describe('removeRecent', () => {
  test('removes one entry, ignoring case', () => {
    expect(removeRecent(['a', 'B', 'c'], 'b')).toEqual(['a', 'c'])
  })
})
