// Logo previews built from piano key 29 (C#3 / Db3, a black key). Run: node scripts/logo-keys.mjs
// Writes build/logo-options/keys-*.png and keys-sheet.png
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dcebff"/></linearGradient>
  <linearGradient id="black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2f86"/><stop offset="1" stop-color="#0b1647"/></linearGradient>
  <linearGradient id="hit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3ff"/><stop offset="1" stop-color="#2fa0ff"/></linearGradient>
  <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1c5c" flood-opacity="0.28"/></filter>
  <filter id="glowHit" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/><rect x="76" y="76" width="872" height="872" rx="196" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="7"/>`

// K1: five white keys C D E F G with their black keys; C# (key 29) lights up
const k1 = (() => {
  const x0 = 192
  const w = 128
  const top = 292
  const h = 440
  const whites = Array.from({ length: 5 }, (_, i) => `<rect x="${x0 + w * i + 5}" y="${top}" width="${w - 10}" height="${h}" rx="26" fill="url(#white)"/>`).join('')
  const bx = (boundary) => boundary - 38
  const black = (b, fill, extra = '') => `<rect x="${bx(b)}" y="${top}" width="76" height="262" rx="20" fill="${fill}" ${extra}/>`
  return `${tile}<g filter="url(#soft)">${whites}
    ${black(x0 + w * 2, 'url(#black)')}${black(x0 + w * 4 + 0, 'url(#black)')}
  </g>
  <g filter="url(#glowHit)">${black(x0 + w, 'url(#hit)')}</g>`
})()

// K2: just C, C# and D, large. The 29 sits on the key.
const k2 = `${tile}<g filter="url(#soft)">
    <rect x="164" y="250" width="338" height="530" rx="44" fill="url(#white)"/>
    <rect x="522" y="250" width="338" height="530" rx="44" fill="url(#white)"/>
  </g>
  <g filter="url(#glowHit)"><rect x="412" y="250" width="200" height="340" rx="40" fill="url(#hit)"/></g>
  <text x="512" y="520" font-family="Helvetica, Arial, sans-serif" font-size="108" font-weight="800" fill="#0b1647" text-anchor="middle" letter-spacing="-4">29</text>`

// K3: the same key, dark, carrying the sharp sign
const k3 = `${tile}<g filter="url(#soft)">
    <rect x="164" y="250" width="338" height="530" rx="44" fill="url(#white)"/>
    <rect x="522" y="250" width="338" height="530" rx="44" fill="url(#white)"/>
    <rect x="412" y="250" width="200" height="340" rx="40" fill="url(#black)"/>
  </g>
  <g transform="translate(512 422)" stroke="#fff" stroke-linecap="round" fill="none">
    <g stroke-width="13"><path d="M-27 -92 V96"/><path d="M27 -104 V84"/></g>
    <g stroke-width="26"><path d="M-62 -26 L62 -56"/><path d="M-62 52 L62 22"/></g>
  </g>`

const options = { k1, k2, k3 }
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`keys-${k}.png`, out), pngs[k])
}

const keys = Object.keys(options)
const cell = 520
const small = 96
const sheetW = keys.length * cell
const sheetH = cell + 60 + small + 30
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
  <rect width="100%" height="100%" fill="#111318"/>
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
writeFileSync(new URL('keys-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and keys-sheet.png')
