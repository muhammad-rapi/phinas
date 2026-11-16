// The note-P logo (black tile) with a piano-key accent on the stem. Three ways to do it.
// Writes build/logo-options/notep2-*.png and notep2-sheet.png. Run: node scripts/logo-note-p2.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const TILE = '#121218'
const WHITE = '#ffffff'
const ORANGE = '#ff7a14'
const SPLIT = 490
const GAP = 9
const STEM_L = 336
const STEM_R = SPLIT - GAP / 2

const base = (decor) => `
  <rect x="64" y="64" width="896" height="896" rx="208" fill="${TILE}"/>
  <clipPath id="right"><rect x="${SPLIT + GAP / 2}" y="0" width="600" height="1024"/></clipPath>
  <clipPath id="stem"><path d="M${STEM_R} 770 V258 Q${STEM_R} 232 ${STEM_R - 26} 232 H370 Q${STEM_L} 232 ${STEM_L} 266 V770 Z"/></clipPath>
  <!-- the note: white stem and head -->
  <g fill="${WHITE}">
    <path d="M${STEM_R} 770 V258 Q${STEM_R} 232 ${STEM_R - 26} 232 H370 Q${STEM_L} 232 ${STEM_L} 266 V770 Z"/>
    <ellipse cx="402" cy="742" rx="116" ry="100" transform="rotate(-22 402 742)"/>
  </g>
  <circle cx="414" cy="748" r="32" fill="${TILE}"/>
  <!-- the piano-key accent, cut into the stem -->
  <g clip-path="url(#stem)">${decor}</g>
  <!-- the bowl of the P with sound bars -->
  <g clip-path="url(#right)" fill="${ORANGE}">
    <circle cx="568" cy="420" r="196"/>
    <rect x="${SPLIT + GAP / 2}" y="420" width="126" height="330" rx="63"/>
  </g>
  <g fill="${TILE}">
    <rect x="556" y="378" width="24" height="84" rx="12"/>
    <rect x="594" y="340" width="24" height="160" rx="12"/>
    <rect x="632" y="366" width="24" height="108" rx="12"/>
    <rect x="670" y="390" width="24" height="60" rx="12"/>
  </g>`

const midX = (STEM_L + STEM_R) / 2

const options = {
  // 1: two white keys side by side with a black key at the top (like C, C#, D)
  v1: base(`
    <rect x="${midX - 3}" y="430" width="6" height="400" fill="${TILE}"/>
    <rect x="${midX - 38}" y="200" width="76" height="236" rx="16" fill="${TILE}"/>`),

  // 2: the stem is a column of keys seen from the side: seams plus black keys cut in from the left
  v2: base(
    [316, 408, 592]
      .map((y) => `<rect x="${STEM_L - 10}" y="${y - 27}" width="98" height="54" rx="10" fill="${TILE}"/>`)
      .join('') +
      [316, 408, 500, 592].map((y) => `<rect x="${STEM_L - 4}" y="${y - 3}" width="${STEM_R - STEM_L + 8}" height="6" fill="${TILE}"/>`).join('')
  ),

  // 3: like 1, but the black key is lit orange: key 29 (C#3)
  v3: base(`
    <rect x="${midX - 3}" y="430" width="6" height="400" fill="${TILE}"/>
    <rect x="${midX - 38}" y="200" width="76" height="236" rx="16" fill="${ORANGE}"/>`)
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`notep2-${k}.png`, out), pngs[k])
}

const keys = Object.keys(options)
const cell = 520
const small = 96
const sheetW = keys.length * cell
const sheetH = cell + 60 + small + 30
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
  <rect width="100%" height="100%" fill="#6b6f78"/>
  ${keys
    .map((k, i) => {
      const x = i * cell
      const b64 = Buffer.from(pngs[k]).toString('base64')
      return `<image x="${x + 20}" y="10" width="${cell - 40}" height="${cell - 40}" href="data:image/png;base64,${b64}"/>
      <text x="${x + cell / 2}" y="${cell + 36}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${k.toUpperCase()}</text>
      <image x="${x + cell / 2 - small / 2}" y="${cell + 52}" width="${small}" height="${small}" href="data:image/png;base64,${b64}"/>`
    })
    .join('')}
</svg>`
writeFileSync(new URL('notep2-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and notep2-sheet.png')
