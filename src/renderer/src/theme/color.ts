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
 * subject whose shading is spread over many colour buckets. Greyscale covers return
 * DEFAULT_ACCENT itself (the same object), which useTheme treats as "no colour".
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

/** The two editorial modes: Siang (paper) and Malam (ink). */
export type Tone = 'day' | 'night'

const hex = (h: string): Rgb => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16)
})

/** Same values as --paper and --ink in theme/tokens.css. */
export const PAPER: Record<Tone, Rgb> = { day: hex('#f4efe6'), night: hex('#1c1714') }
export const INK: Record<Tone, Rgb> = { day: hex('#2a2420'), night: hex('#efe4d4') }
/** The wash colour when nothing is playing and no mood is set. */
export const TERRACOTTA: Rgb = hex('#e7a46c')
/** The accent when nothing is playing and no mood is set (4.5:1 on the paper and on the terracotta wash). */
export const FALLBACK_ACCENT: Record<Tone, Rgb> = { day: hex('#9c4526'), night: hex('#e8a770') }
/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5
/** How much of the source colour goes into the page wash. */
export const WASH_SHARE: Record<Tone, number> = { day: 0.25, night: 0.3 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }

/** `#rrggbb` to Rgb, or null for anything else. */
export function parseHex(h: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
  return m ? hex(`#${m[1]}`) : null
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const linear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * The source colour made readable (at least 4.5:1) on both the mode's paper and its wash,
 * since accent text sits on the wash at the top of pages. Keeps hue and saturation: darkened
 * step by step for Siang, lightened for Malam.
 */
export function accentFor(source: Rgb, tone: Tone): Rgb {
  const paper = PAPER[tone]
  const wash = washFor(source, tone)
  const readable = (c: Rgb): boolean => Math.min(contrastRatio(c, paper), contrastRatio(c, wash)) >= MIN_CONTRAST
  if (readable(source)) return source
  const { h, s, l } = rgbToHsl(source)
  for (let i = 1; i <= 100; i++) {
    const x = tone === 'day' ? l - i / 100 : l + i / 100
    if (x < 0 || x > 1) break
    const c = hslToRgb(h, s, x)
    if (readable(c)) return c
  }
  return tone === 'day' ? { r: 0, g: 0, b: 0 } : WHITE
}

/** The source mixed into the paper: 25% for Siang, 30% for Malam. */
export function washFor(source: Rgb, tone: Tone): Rgb {
  const k = WASH_SHARE[tone]
  const p = PAPER[tone]
  const mix = (s: number, q: number): number => Math.round(q * (1 - k) + s * k)
  return { r: mix(source.r, p.r), g: mix(source.g, p.g), b: mix(source.b, p.b) }
}

/** Text on a filled accent: white or the paper, whichever contrasts more. */
export function onAccent(accent: Rgb, tone: Tone): Rgb {
  return contrastRatio(WHITE, accent) >= contrastRatio(PAPER[tone], accent) ? WHITE : PAPER[tone]
}

export interface Palette {
  accent: string
  onAccent: string
  wash: string
}

/** The dynamic tokens for a source colour (cover or mood), or the terracotta defaults without one. */
export function paletteFor(source: Rgb | null, tone: Tone): Palette {
  const accent = source ? accentFor(source, tone) : FALLBACK_ACCENT[tone]
  const wash = washFor(source ?? TERRACOTTA, tone)
  return { accent: toHex(accent), onAccent: toHex(onAccent(accent, tone)), wash: toHex(wash) }
}
