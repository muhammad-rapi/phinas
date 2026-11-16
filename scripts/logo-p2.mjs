// Bold "P" logos with a music accent, kept clear of the Instagram and Adobe looks.
// Writes build/logo-options/p2-*.png and p2-sheet.png. Run: node scripts/logo-p2.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const tile = (fill) => `<rect x="64" y="64" width="896" height="896" rx="208" fill="${fill}"/>`

// The P: a pill-shaped stem plus a ring for the bowl. The counter (hole) is 88 px in radius.
const BOWL = { cx: 566, cy: 440 }
const p = (fill) => `
  <rect x="312" y="236" width="132" height="560" rx="66" fill="${fill}"/>
  <circle cx="${BOWL.cx}" cy="${BOWL.cy}" r="150" fill="none" stroke="${fill}" stroke-width="124"/>`

// A small eighth note that sits in the counter of the P
const note = (fill) => {
  const { cx, cy } = BOWL
  return `<g fill="${fill}" transform="translate(${cx - 26} ${cy - 6})">
    <ellipse cx="0" cy="38" rx="34" ry="26" transform="rotate(-22 0 38)"/>
    <rect x="22" y="-62" width="14" height="100"/>
    <path d="M36 -62 C70 -52 92 -30 86 6 C78 -14 62 -22 36 -28 Z"/>
  </g>`
}

// Radiating arcs on the right of the bowl, as sound leaving the P
const arcs = (stroke) => {
  const { cx, cy } = BOWL
  const arc = (r, a0, a1, w) => {
    const pt = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
    return `<path d="M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`
  }
  const d = Math.PI / 180
  return arc(262, -48 * d, 40 * d, 26) + arc(318, -44 * d, 36 * d, 22)
}

const options = {
  // A: orange tile, black P, black note in the counter
  a: `${tile('#ff7a14')}${p('#0c0c10')}${note('#0c0c10')}`,

  // B: black tile, white P, orange note in the counter
  b: `${tile('#121218')}${p('#ffffff')}${note('#ff7a14')}`,

  // C: warm white tile, black P, orange sound arcs leaving the bowl
  c: `${tile('#f6f1e8')}${p('#0c0c10')}${arcs('#ff7a14')}`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`p2-${k}.png`, out), pngs[k])
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
writeFileSync(new URL('p2-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and p2-sheet.png')
