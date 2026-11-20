import { describe, expect, test } from 'vitest'
import { splitLastWord } from '../src/renderer/src/components/titleParts'

describe('splitLastWord', () => {
  test('splits off the last word', () => {
    expect(splitLastWord('playlist rafi')).toEqual(['playlist', 'rafi'])
    expect(splitLastWord('Lagu yang disukai')).toEqual(['Lagu yang', 'disukai'])
  })
  test('a single word is all last word', () => {
    expect(splitLastWord('Falling')).toEqual(['', 'Falling'])
  })
  test('ignores surrounding and repeated spaces', () => {
    expect(splitLastWord('  spaced   out  ')).toEqual(['spaced', 'out'])
  })
  test('empty stays empty', () => {
    expect(splitLastWord('')).toEqual(['', ''])
  })
})
