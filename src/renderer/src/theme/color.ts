export interface Rgb {
  r: number
  g: number
  b: number
}

export const DEFAULT_ACCENT: Rgb = { r: 139, g: 92, b: 246 }

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h / 6, s, l }
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number): number => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return {
    r: Math.round(f(h + 1 / 3) * 255),
    g: Math.round(f(h) * 255),
    b: Math.round(f(h - 1 / 3) * 255)
  }
}

/** Pixels with less chroma than this look grey/white/black and carry no theme colour. */
const MIN_CHROMA = 0.15
/** If fewer than this share of pixels are coloured, the cover is effectively greyscale. */
const MIN_COLOURED_SHARE = 0.02

/**
 * RGBA flat array (like ImageData.data). Picks the most prominent *coloured* area.
 * Grey, white and black pixels are ignored: a flat background would otherwise outweigh a
 * subject whose shading is spread over many colour buckets. Greyscale covers fall back to
 * the default accent.
 */
export function dominantColor(data: ArrayLike<number>): Rgb {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; score: number }>()
  let opaque = 0
  let coloured = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    opaque++
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // Chroma (max - min), not HSL saturation: near-white and near-black pixels have a high
    // HSL saturation even though they look colorless.
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    if (chroma < MIN_CHROMA) continue
    coloured++
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, score: 0 }
    e.n++
    e.r += r
    e.g += g
    e.b += b
    e.score += chroma
    buckets.set(key, e)
  }
  if (opaque === 0 || coloured / opaque < MIN_COLOURED_SHARE) return DEFAULT_ACCENT
  let best: { n: number; r: number; g: number; b: number; score: number } | null = null
  for (const e of buckets.values()) if (!best || e.score > best.score) best = e
  if (!best) return DEFAULT_ACCENT
  return { r: Math.round(best.r / best.n), g: Math.round(best.g / best.n), b: Math.round(best.b / best.n) }
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Keep the accent readable on dark panels: lightness 0.35-0.6, saturation at least 0.35. */
export function toAccent(c: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(c)
  // A colourless input has no real hue (it reads as 0, i.e. red), so borrow the default's.
  const hue = s < 0.05 ? rgbToHsl(DEFAULT_ACCENT).h : h
  return hslToRgb(hue, Math.max(s, 0.35), clamp(l, 0.35, 0.6))
}

const css = ({ r, g, b }: Rgb): string => `rgb(${r} ${g} ${b})`

/**
 * The accent lightened for use as TEXT or thin icons on a dark panel. The plain accent can be
 * a deep colour that works for buttons but disappears as text on a dark background.
 */
export function accentText(c: Rgb): Rgb {
  const { h, s } = rgbToHsl(toAccent(c))
  return hslToRgb(h, clamp(s, 0.5, 0.95), 0.7)
}

export function accentVars(c: Rgb): { accent: string; accentText: string; gradTop: string } {
  const a = toAccent(c)
  const { h, s } = rgbToHsl(a)
  return { accent: css(a), accentText: css(accentText(c)), gradTop: css(hslToRgb(h, s, 0.28)) }
}
