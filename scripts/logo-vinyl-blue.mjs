// R3 (black vinyl with a sunset-band label) recoloured blue and white, with three alternatives
// for the line accent under the disc. Run: node scripts/logo-vinyl-blue.mjs
// Writes build/logo-options/vb-*.png and vb-sheet.png
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const TILE = '#f1f6ff'
const DISC = '#12286f'
const GROOVE = '#27438f'
const LABEL = '#3a86f0'
const WHITE = '#ffffff'
const INK = '#12286f'
const CX = 512
const CY = 444
const R = 262

const disc = `<clipPath id="label"><circle cx="${CX}" cy="${CY}" r="104"/></clipPath>`

const bands = (x, y0, hs, gaps, fill) => {
  let y = y0
  return hs
    .map((h, i) => {
      const r = `<rect x="${x}" y="${y}" width="620" height="${h}" fill="${fill}"/>`
      y += h + gaps[i]
      return r
    })
    .join('')
}

const arc = (r, a0, a1) => {
  const pt = (a) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`
  return `M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}`
}

const record = `${disc}
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${DISC}"/>
  ${[222, 190, 158].map((r) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${GROOVE}" stroke-width="5"/>`).join('')}
  <path d="${arc(188, Math.PI * 1.08, Math.PI * 1.34)}" fill="none" stroke="#fff" stroke-opacity="0.34" stroke-width="9" stroke-linecap="round"/>
  <circle cx="${CX}" cy="${CY}" r="104" fill="${LABEL}"/>
  <g clip-path="url(#label)">${bands(380, CY + 26, [6, 9, 12, 16], [14, 13, 12, 0], WHITE)}</g>
  <circle cx="${CX}" cy="${CY}" r="15" fill="${WHITE}"/>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="${TILE}"/>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="none" stroke="#d3e1fa" stroke-width="4"/>`

const stroke = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>`

const options = {
  // L1: a sound-wave line: flat, then a burst, then flat again
  l1: `${tile}${record}${stroke('M312 806 H402 l16 -30 l22 62 l22 -84 l22 96 l22 -70 l16 26 H712')}`,

  // L2: three lines that shorten downwards, echoing the bands on the label
  l2: `${tile}${record}${stroke('M332 774 H692')}${stroke('M392 818 H632')}${stroke('M452 862 H572')}`,

  // L3: a curve under the disc that carries on the grooves
  l3: `${tile}${record}<path d="${arc(310, Math.PI * 0.2, Math.PI * 0.8)}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
    <path d="${arc(350, Math.PI * 0.28, Math.PI * 0.72)}" fill="none" stroke="${LABEL}" stroke-width="15" stroke-linecap="round"/>`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`vb-${k}.png`, out), pngs[k])
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
writeFileSync(new URL('vb-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and vb-sheet.png')
