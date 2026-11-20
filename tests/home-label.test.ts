import { describe, expect, test } from 'vitest'
import { dayPart, homeLabel } from '../src/renderer/src/screens/home/dayPart'

describe('dayPart', () => {
  test.each<[number, string]>([
    [0, 'malam'],
    [3, 'malam'],
    [4, 'pagi'],
    [10, 'pagi'],
    [11, 'siang'],
    [14, 'siang'],
    [15, 'sore'],
    [17, 'sore'],
    [18, 'malam'],
    [23, 'malam']
  ])('%i:00 is %s', (hour, part) => {
    expect(dayPart(hour)).toBe(part)
  })
})

describe('homeLabel', () => {
  // 19 November 2026 is a Thursday.
  const thursdayAfternoon = new Date(2026, 10, 19, 16, 30)

  test('day, day part and name, in capitals', () => {
    expect(homeLabel(thursdayAfternoon, 'Rafi')).toBe('KAMIS SORE · UNTUK RAFI')
  })
  test('without a name: UNTUKMU', () => {
    expect(homeLabel(thursdayAfternoon, '  ')).toBe('KAMIS SORE · UNTUKMU')
  })
  test('the placeholder name "Kamu" counts as no name', () => {
    expect(homeLabel(thursdayAfternoon, 'Kamu')).toBe('KAMIS SORE · UNTUKMU')
  })
  test('Sunday morning', () => {
    expect(homeLabel(new Date(2026, 10, 22, 7, 0), 'Nadia')).toBe('MINGGU PAGI · UNTUK NADIA')
  })
})
