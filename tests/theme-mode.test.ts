import { describe, expect, test } from 'vitest'
import { THEME_KEY, parseMode, readMode, resolveMode, writeMode } from '../src/renderer/src/theme/mode'

const store = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string): string | null => map.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      map.set(k, v)
    }
  }
}

describe('parseMode', () => {
  test('current values stay', () => {
    expect(parseMode('system')).toBe('system')
    expect(parseMode('day')).toBe('day')
    expect(parseMode('night')).toBe('night')
  })
  test('old values migrate', () => {
    expect(parseMode('light')).toBe('day')
    expect(parseMode('dark')).toBe('night')
    expect(parseMode('dynamic')).toBe('system')
  })
  test('missing or unknown values follow the system', () => {
    expect(parseMode(null)).toBe('system')
    expect(parseMode('purple')).toBe('system')
    expect(parseMode('toString')).toBe('system')
  })
})

describe('readMode', () => {
  test('nothing stored: system, and nothing is written', () => {
    const s = store()
    expect(readMode(s)).toBe('system')
    expect(s.map.has(THEME_KEY)).toBe(false)
  })
  test('an old value is migrated and stored back', () => {
    const s = store({ [THEME_KEY]: 'dark' })
    expect(readMode(s)).toBe('night')
    expect(s.map.get(THEME_KEY)).toBe('night')
  })
  test('a current value is read as is', () => {
    expect(readMode(store({ [THEME_KEY]: 'day' }))).toBe('day')
  })
  test('no storage, or storage that throws, reads as system', () => {
    expect(readMode(null)).toBe('system')
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked')
      },
      setItem: (): void => {}
    }
    expect(readMode(broken)).toBe('system')
  })
})

describe('writeMode', () => {
  test('stores the mode under phinas.theme', () => {
    const s = store()
    writeMode(s, 'night')
    expect(s.map.get('phinas.theme')).toBe('night')
  })
  test('ignores storage errors', () => {
    const broken = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error('full')
      }
    }
    expect(() => writeMode(broken, 'day')).not.toThrow()
  })
})

describe('resolveMode', () => {
  test('system follows the OS', () => {
    expect(resolveMode('system', true)).toBe('night')
    expect(resolveMode('system', false)).toBe('day')
  })
  test('a forced mode ignores the OS', () => {
    expect(resolveMode('day', true)).toBe('day')
    expect(resolveMode('night', false)).toBe('night')
  })
})
