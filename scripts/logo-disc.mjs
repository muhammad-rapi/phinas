// The note-P logo with line accents that form a record (vinyl) disc. Three placements.
// Writes build/logo-options/disc-*.png and disc-sheet.png. Run: node scripts/logo-disc.mjs
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
const BOWL = { cx: 568, cy: 420 }

const stem = `<path d="M${STEM_R} 770 V258 Q${STEM_R} 232 ${STEM_R - 26} 232 H370 Q${STEM_L} 232 ${STEM_L} 266 V770 Z" fill="${WHITE}"/>`
const bowl = `
  <clipPath id="right"><rect x="${SPLIT + GAP / 2}" y="0" width="600" height="1024"/></clipPath>
  <g clip-path="url(#right)" fill="${ORANGE}">
    <circle cx="${BOWL.cx}" cy="${BOWL.cy}" r="196"/>
    <rect x="${SPLIT + GAP / 2}" y="420" width="126" height="330" rx="63"/>
  </g>
  <g fill="${TILE}">
    <rect x="556" y="378" width="24" height="84" rx="12"/><rect x="594" y="340" width="24" height="160" rx="12"/>
    <rect x="632" y="366" width="24" height="108" rx="12"/><rect x="670" y="390" width="24" height="60" rx="12"/>
  </g>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="${TILE}"/>`
const clipTile = `<clipPath id="tile"><rect x="64" y="64" width="896" height="896" rx="208"/></clipPath>`

const rings = (cx, cy, radii, opacities, width) =>
  radii.map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${WHITE}" stroke-opacity="${opacities[i]}" stroke-width="${width}"/>`).join('')

const options = {
  // D1: the note head is a record: a disc with fine grooves and a spindle hole
  d1: `${tile}${stem}
    <circle cx="402" cy="742" r="116" fill="${WHITE}"/>
    ${[90, 66].map((r) => `<circle cx="402" cy="742" r="${r}" fill="none" stroke="${TILE}" stroke-width="5"/>`).join('')}
    <circle cx="402" cy="742" r="26" fill="${TILE}"/>${bowl}`,

  // D2: concentric lines behind the whole mark, like a record under the letter
  d2: `${clipTile}${tile}
    <g clip-path="url(#tile)">${rings(512, 512, [150, 190, 230, 270, 310, 350, 390, 430], [0.16, 0.14, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06], 4)}</g>
    ${stem}<ellipse cx="402" cy="742" rx="116" ry="100" transform="rotate(-22 402 742)" fill="${WHITE}"/>
    <circle cx="414" cy="748" r="32" fill="${TILE}"/>${bowl}`,

  // D3: grooves wrap around the bowl, so the orange bowl reads as the label of a record
  d3: `${clipTile}${tile}
    <g clip-path="url(#tile)">${rings(BOWL.cx, BOWL.cy, [236, 276, 316, 356], [0.5, 0.36, 0.24, 0.14], 6)}</g>
    ${stem}<ellipse cx="402" cy="742" rx="116" ry="100" transform="rotate(-22 402 742)" fill="${WHITE}"/>
    <circle cx="414" cy="748" r="32" fill="${TILE}"/>${bowl}`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`disc-${k}.png`, out), pngs[k])
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
writeFileSync(new URL('disc-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and disc-sheet.png')
