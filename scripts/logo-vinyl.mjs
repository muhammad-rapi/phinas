// Retro flat logos in the spirit of a sunset-stripe mark, but built as a record disc.
// Writes build/logo-options/vinyl-*.png and vinyl-sheet.png. Run: node scripts/logo-vinyl.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const CREAM = '#f3eee3'
const ORANGE = '#ee6a22'
const INK = '#17171b'
const CX = 512
const CY = 444
const R = 262

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="${CREAM}"/>`

// The line and the little wave under the disc
const under = `
  <path d="M340 770 H684" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
  <path d="M392 838 q30 -38 60 0 t60 0 t60 0 t60 0" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`

const disc = `<clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>`
const label = `<clipPath id="label"><circle cx="${CX}" cy="${CY}" r="104"/></clipPath>`

// Horizontal bands that get thicker towards the bottom, like a sunset
const bands = (x, y0, hs, gaps, fill, clip) => {
  let y = y0
  return hs
    .map((h, i) => {
      const r = `<rect x="${x}" y="${y}" width="620" height="${h}" fill="${fill}"/>`
      y += h + gaps[i]
      return r
    })
    .join('')
}

const options = {
  // R1: an orange disc cut by sunset bands in its lower half, with a spindle hole
  r1: `${tile}${disc}
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${ORANGE}"/>
    <g clip-path="url(#disc)">${bands(200, CY + 56, [9, 13, 18, 24, 32], [30, 28, 26, 24, 0], CREAM)}</g>
    <circle cx="${CX}" cy="${CY}" r="38" fill="${CREAM}"/><circle cx="${CX}" cy="${CY}" r="11" fill="${INK}"/>${under}`,

  // R2: an orange record with cream grooves, a label and a spindle hole
  r2: `${tile}
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${ORANGE}"/>
    ${[216, 172, 128].map((r) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${CREAM}" stroke-width="10"/>`).join('')}
    <circle cx="${CX}" cy="${CY}" r="76" fill="${CREAM}"/><circle cx="${CX}" cy="${CY}" r="16" fill="${INK}"/>${under}`,

  // R3: a black vinyl whose orange label carries the sunset bands
  r3: `${tile}${label}
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${INK}"/>
    ${[222, 190, 158].map((r) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#2b2b31" stroke-width="5"/>`).join('')}
    <path d="M${CX + 188 * Math.cos(Math.PI * 1.08)} ${CY + 188 * Math.sin(Math.PI * 1.08)} A188 188 0 0 1 ${CX + 188 * Math.cos(Math.PI * 1.34)} ${CY + 188 * Math.sin(Math.PI * 1.34)}" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="9" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="104" fill="${ORANGE}"/>
    <g clip-path="url(#label)">${bands(380, CY + 26, [6, 9, 12, 16], [14, 13, 12, 0], CREAM)}</g>
    <circle cx="${CX}" cy="${CY}" r="15" fill="${CREAM}"/>${under}`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`vinyl-${k}.png`, out), pngs[k])
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
writeFileSync(new URL('vinyl-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and vinyl-sheet.png')
