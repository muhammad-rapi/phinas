import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ACCENT,
  accentVars,
  dominantColor,
  rgbToHsl,
  toAccent
} from '../src/renderer/src/theme/color'

const px = (r: number, g: number, b: number, a = 255, n = 1): number[] =>
  Array.from({ length: n }, () => [r, g, b, a]).flat()

describe('dominantColor', () => {
  test('picks the vivid color over a larger gray area', () => {
    const data = [...px(120, 120, 120, 255, 50), ...px(220, 30, 30, 255, 40)]
    const c = dominantColor(data)
    expect(c.r).toBeGreaterThan(180)
    expect(c.g).toBeLessThan(80)
  })

  test('ignores transparent pixels', () => {
    const data = [...px(0, 255, 0, 0, 100), ...px(10, 20, 200, 255, 5)]
    expect(dominantColor(data).b).toBeGreaterThan(150)
  })

  test('falls back to default when everything is transparent', () => {
    expect(dominantColor(px(1, 2, 3, 0, 10))).toEqual(DEFAULT_ACCENT)
  })
})

describe('toAccent', () => {
  test('darkens near-white colors', () => {
    const { l } = rgbToHsl(toAccent({ r: 245, g: 245, b: 240 }))
    expect(l).toBeLessThanOrEqual(0.6)
  })

  test('lightens near-black colors', () => {
    const { l } = rgbToHsl(toAccent({ r: 5, g: 5, b: 8 }))
    // 0.01 tolerance: converting back to 8-bit RGB rounds the clamped value slightly.
    expect(l).toBeGreaterThanOrEqual(0.34)
  })

  test('boosts washed-out saturation', () => {
    const { s } = rgbToHsl(toAccent({ r: 130, g: 128, b: 128 }))
    expect(s).toBeGreaterThanOrEqual(0.34)
  })
})

describe('accentVars', () => {
  test('returns css color strings', () => {
    const v = accentVars({ r: 200, g: 40, b: 40 })
    expect(v.accent).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
    expect(v.gradTop).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
  })
})
