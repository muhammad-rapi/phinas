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

/** RGBA flat array (like ImageData.data). Prefers vivid colors over gray areas. */
export function dominantColor(data: ArrayLike<number>): Rgb {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number; score: number }>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const { s } = rgbToHsl({ r, g, b })
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0, score: 0 }
    e.n++
    e.r += r
    e.g += g
    e.b += b
    e.score += 1 + s * 4
    buckets.set(key, e)
  }
  let best: { n: number; r: number; g: number; b: number; score: number } | null = null
  for (const e of buckets.values()) if (!best || e.score > best.score) best = e
  if (!best) return DEFAULT_ACCENT
  return { r: Math.round(best.r / best.n), g: Math.round(best.g / best.n), b: Math.round(best.b / best.n) }
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Keep the accent readable on dark panels: lightness 0.35-0.6, saturation at least 0.35. */
export function toAccent(c: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(c)
  return hslToRgb(h, Math.max(s, 0.35), clamp(l, 0.35, 0.6))
}

const css = ({ r, g, b }: Rgb): string => `rgb(${r} ${g} ${b})`

export function accentVars(c: Rgb): { accent: string; gradTop: string } {
  const a = toAccent(c)
  const { h, s } = rgbToHsl(a)
  return { accent: css(a), gradTop: css(hslToRgb(h, s, 0.28)) }
}
