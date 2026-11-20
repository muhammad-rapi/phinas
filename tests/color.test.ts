import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ACCENT,
  FALLBACK_ACCENT,
  INK,
  MIN_CONTRAST,
  PAPER,
  TERRACOTTA,
  accentFor,
  contrastRatio,
  dominantColor,
  luminance,
  onAccent,
  paletteFor,
  parseHex,
  rgbToHsl,
  toHex,
  washFor,
  type Rgb,
  type Tone
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

const SOURCES = [
  '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#e7a46c', '#2f6db5', '#8fc1f0', '#1a1a40', '#f0f0a0',
  '#5aa36b', '#808000', '#400010', '#5b8def', '#e8932a', '#64748b', '#ffffff', '#000000', '#b05bd6', '#3fae6a', '#d9a93a'
].map((h) => parseHex(h)!)
const TONES: Tone[] = ['day', 'night']
const hueDistance = (a: Rgb, b: Rgb): number => {
  const d = Math.abs(rgbToHsl(a).h - rgbToHsl(b).h)
  return Math.min(d, 1 - d)
}

describe('parseHex / toHex', () => {
  test('round trip', () => {
    expect(parseHex('#9c4526')).toEqual({ r: 156, g: 69, b: 38 })
    expect(toHex({ r: 156, g: 69, b: 38 })).toBe('#9c4526')
  })
  test('rejects anything that is not #rrggbb', () => {
    expect(parseHex('red')).toBeNull()
    expect(parseHex('#abc')).toBeNull()
  })
})

describe('contrastRatio', () => {
  test('black on white is 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5)
  })
  test('is symmetric, and a colour on itself is 1:1', () => {
    const a = parseHex('#2f6db5')!
    expect(contrastRatio(a, PAPER.day)).toBeCloseTo(contrastRatio(PAPER.day, a), 10)
    expect(contrastRatio(a, a)).toBe(1)
  })
  test('the fallback accents read on their own paper', () => {
    expect(contrastRatio(FALLBACK_ACCENT.day, PAPER.day)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(FALLBACK_ACCENT.night, PAPER.night)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})

describe('accentFor', () => {
  test('every output reaches 4.5:1 on its paper', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) expect(contrastRatio(accentFor(src, tone), PAPER[tone])).toBeGreaterThanOrEqual(4.5)
    }
  })
  test('keeps the hue of coloured sources', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) {
        if (rgbToHsl(src).s < 0.1) continue
        expect(hueDistance(accentFor(src, tone), src)).toBeLessThan(0.01)
      }
    }
  })
  test('darkens for Siang and lightens for Malam', () => {
    const warm = parseHex('#e7a46c')!
    expect(luminance(accentFor(warm, 'day'))).toBeLessThan(luminance(warm))
    const blue = parseHex('#2f6db5')!
    expect(luminance(accentFor(blue, 'night'))).toBeGreaterThan(luminance(blue))
  })
  test('leaves a source that already passes unchanged', () => {
    expect(accentFor({ r: 0, g: 0, b: 255 }, 'day')).toEqual({ r: 0, g: 0, b: 255 })
  })
})

describe('washFor', () => {
  test('mixes 25% of the source into Siang paper', () => {
    expect(washFor(TERRACOTTA, 'day')).toEqual({ r: 241, g: 220, b: 200 })
  })
  test('mixes 30% of the source into Malam paper', () => {
    expect(washFor(TERRACOTTA, 'night')).toEqual({ r: 89, g: 65, b: 46 })
  })
  test('ink stays readable on any wash', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) expect(contrastRatio(INK[tone], washFor(src, tone))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('onAccent', () => {
  test('white on the dark Siang accent, paper on the light Malam accent', () => {
    expect(onAccent(FALLBACK_ACCENT.day, 'day')).toEqual({ r: 255, g: 255, b: 255 })
    expect(onAccent(FALLBACK_ACCENT.night, 'night')).toEqual(PAPER.night)
  })
  test('always readable on what accentFor returns', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) {
        const a = accentFor(src, tone)
        expect(contrastRatio(onAccent(a, tone), a)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('paletteFor', () => {
  test('without a source: the terracotta defaults', () => {
    expect(paletteFor(null, 'day')).toEqual({ accent: '#9c4526', onAccent: '#ffffff', wash: '#f1dcc8' })
    expect(paletteFor(null, 'night')).toEqual({ accent: '#e7a46c', onAccent: '#1c1714', wash: '#59412e' })
  })
  test('with a source: hex strings built from that source', () => {
    const p = paletteFor(parseHex('#2f6db5'), 'day')
    expect(p.accent).toBe(toHex(accentFor(parseHex('#2f6db5')!, 'day')))
    expect(p.wash).toBe(toHex(washFor(parseHex('#2f6db5')!, 'day')))
    expect(p.onAccent).toMatch(/^#[0-9a-f]{6}$/)
  })
})
