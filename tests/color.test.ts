import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ACCENT,
  accentText,
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

  test('a warm off-white background does not beat a smaller vivid subject', () => {
    // Album art like a white square with a blue subject: HSL saturation of off-white is
    // misleadingly high, so vividness must be measured by chroma instead.
    const data = [...px(250, 244, 236, 255, 70), ...px(30, 40, 230, 255, 25)]
    const c = dominantColor(data)
    expect(c.b).toBeGreaterThan(180)
    expect(c.r).toBeLessThan(80)
  })

  test('a near-black background does not beat a smaller vivid subject', () => {
    const data = [...px(8, 4, 6, 255, 70), ...px(230, 40, 120, 255, 25)]
    const c = dominantColor(data)
    expect(c.r).toBeGreaterThan(180)
  })

  test('a subject shaded across many colour buckets still beats a flat grey background', () => {
    // Real covers: the subject is split over many shades, the background is one flat colour.
    const shades = [
      [30, 40, 230], [40, 50, 205], [55, 65, 175], [20, 30, 250], [70, 80, 150],
      [25, 55, 215], [45, 35, 190], [60, 45, 165], [35, 70, 225], [15, 25, 245]
    ]
    const data = [...px(225, 225, 225, 255, 70), ...shades.flatMap(([r, g, b]) => px(r, g, b, 255, 3))]
    const c = dominantColor(data)
    expect(c.b).toBeGreaterThan(c.r + 40)
  })

  test('a completely grey image falls back to the default accent', () => {
    expect(dominantColor([...px(200, 200, 200, 255, 50), ...px(30, 30, 30, 255, 50)])).toEqual(DEFAULT_ACCENT)
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

  test('a colourless input never turns red', () => {
    const { h } = rgbToHsl(toAccent({ r: 200, g: 200, b: 200 }))
    expect(h).toBeCloseTo(rgbToHsl(DEFAULT_ACCENT).h, 1)
  })

  test('boosts washed-out saturation', () => {
    const { s } = rgbToHsl(toAccent({ r: 130, g: 128, b: 128 }))
    expect(s).toBeGreaterThanOrEqual(0.34)
  })
})

describe('accentText', () => {
  test('is always light enough to read on a dark panel, whatever the cover color', () => {
    for (const c of [
      { r: 3, g: 41, b: 217 },
      { r: 20, g: 20, b: 120 },
      { r: 200, g: 40, b: 40 },
      { r: 240, g: 240, b: 120 }
    ]) {
      const { l } = rgbToHsl(accentText(c))
      expect(l).toBeGreaterThanOrEqual(0.64)
    }
  })

  test('keeps the hue of the accent', () => {
    const accent = toAccent({ r: 3, g: 41, b: 217 })
    expect(rgbToHsl(accentText({ r: 3, g: 41, b: 217 })).h).toBeCloseTo(rgbToHsl(accent).h, 1)
  })
})

describe('accentVars', () => {
  test('returns css color strings', () => {
    const v = accentVars({ r: 200, g: 40, b: 40 })
    expect(v.accent).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
    expect(v.gradTop).toMatch(/^rgb\(\d+ \d+ \d+\)$/)
  })
})
