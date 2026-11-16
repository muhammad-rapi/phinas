// A "P" made of two halves: a music note (left) and the bowl of the P with sound bars (right).
// Writes build/logo-options/notep-*.png and notep-sheet.png. Run: node scripts/logo-note-p.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const tile = (fill) => `<rect x="64" y="64" width="896" height="896" rx="208" fill="${fill}"/>`

// Shared geometry. The split between the two halves is at x = SPLIT.
const SPLIT = 490
const GAP = 9

const mark = ({ tileColor, noteColor, bowlColor, barColor }) => `
  <clipPath id="right"><rect x="${SPLIT + GAP / 2}" y="0" width="600" height="1024"/></clipPath>
  <!-- left half: the note (stem + round head with a hole) -->
  <g fill="${noteColor}">
    <path d="M${SPLIT - GAP / 2} 770 V258 Q${SPLIT - GAP / 2} 232 ${SPLIT - GAP / 2 - 26} 232 H370 Q336 232 336 266 V770 Z"/>
    <ellipse cx="402" cy="742" rx="116" ry="100" transform="rotate(-22 402 742)"/>
  </g>
  <circle cx="414" cy="748" r="32" fill="${tileColor}"/>
  <!-- right half: the bowl of the P, running down into the tail -->
  <g clip-path="url(#right)" fill="${bowlColor}">
    <circle cx="568" cy="420" r="196"/>
    <rect x="${SPLIT + GAP / 2}" y="420" width="126" height="330" rx="63"/>
  </g>
  <!-- sound bars inside the bowl -->
  <g fill="${barColor}">
    <rect x="556" y="378" width="24" height="84" rx="12"/>
    <rect x="594" y="340" width="24" height="160" rx="12"/>
    <rect x="632" y="366" width="24" height="108" rx="12"/>
    <rect x="670" y="390" width="24" height="60" rx="12"/>
  </g>`

const options = {
  // A: warm white tile, like the reference
  a: `${tile('#f6f1e8')}${mark({ tileColor: '#f6f1e8', noteColor: '#111116', bowlColor: '#ff7a14', barColor: '#ffffff' })}`,
  // B: black tile, light note
  b: `${tile('#121218')}${mark({ tileColor: '#121218', noteColor: '#ffffff', bowlColor: '#ff7a14', barColor: '#121218' })}`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`notep-${k}.png`, out), pngs[k])
}

const keys = Object.keys(options)
const cell = 560
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
writeFileSync(new URL('notep-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and notep-sheet.png')
