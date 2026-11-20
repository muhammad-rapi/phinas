// Renders several candidate app icons to build/logo-options/ plus a contact sheet.
// Run: node scripts/logo-options.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
  <linearGradient id="bgDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1b4d"/><stop offset="1" stop-color="#1d3a9a"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#0b1c5c" flood-opacity="0.28"/></filter>`

const tile = (fill = 'url(#bg)') =>
  `<rect x="64" y="64" width="896" height="896" rx="208" fill="${fill}"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>`

const options = {
  // A: two circles that meet; the overlap holds equalizer bars
  a: `${tile()}
    <clipPath id="ca"><circle cx="396" cy="512" r="262"/></clipPath>
    <g filter="url(#soft)"><circle cx="396" cy="512" r="262" fill="#fff"/><circle cx="628" cy="512" r="262" fill="#b9dcff"/></g>
    <g clip-path="url(#ca)"><circle cx="628" cy="512" r="262" fill="#1e3fae"/></g>
    <g fill="#fff"><rect x="436" y="432" width="44" height="160" rx="22"/><rect x="496" y="372" width="44" height="280" rx="22"/><rect x="556" y="412" width="44" height="200" rx="22"/></g>`,

  // B: monogram P: a stem and a ring, with a dot inside the ring (the listener)
  b: `${tile()}
    <g filter="url(#soft)">
      <rect x="316" y="238" width="124" height="548" rx="62" fill="#fff"/>
      <circle cx="560" cy="428" r="196" fill="none" stroke="#fff" stroke-width="124"/>
    </g>
    <circle cx="560" cy="428" r="40" fill="#b9dcff"/>`,

  // C: two sets of sound arcs facing each other, meeting at a point
  c: `${tile('url(#bgDark)')}
    <g fill="none" stroke-linecap="round" stroke-width="48">
      <g stroke="#fff"><path d="M392 372 A190 190 0 0 0 392 652"/><path d="M296 292 A310 310 0 0 0 296 732" opacity="0.55"/></g>
      <g stroke="#7cc0ff"><path d="M632 372 A190 190 0 0 1 632 652"/><path d="M728 292 A310 310 0 0 1 728 732" opacity="0.55"/></g>
    </g>
    <circle cx="512" cy="512" r="58" fill="#fff"/>`,

  // D: minimal headphones, the band and cups doubling as a pair; a note in the middle
  d: `${tile()}
    <g filter="url(#soft)">
      <path d="M272 566 V512 A240 240 0 0 1 752 512 V566" fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round"/>
      <rect x="226" y="520" width="136" height="236" rx="68" fill="#fff"/>
      <rect x="662" y="520" width="136" height="236" rx="68" fill="#b9dcff"/>
    </g>
    <g fill="#fff"><ellipse cx="482" cy="640" rx="40" ry="31" transform="rotate(-22 482 640)"/><rect x="509" y="470" width="18" height="168"/><path d="M527 470 C566 484 594 506 590 550 C578 524 558 514 527 508 Z"/></g>`,

  // E: two play triangles, one in front of the other
  e: `${tile()}
    <g filter="url(#soft)">
      <path d="M330 262 L742 512 L330 762 Z" fill="#b9dcff" stroke="#b9dcff" stroke-width="64" stroke-linejoin="round" transform="translate(150 0)"/>
      <path d="M262 262 L674 512 L262 762 Z" fill="#fff" stroke="#fff" stroke-width="64" stroke-linejoin="round"/>
    </g>`
}

const wrap = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`

for (const [key, body] of Object.entries(options)) {
  const svg = wrap(body)
  writeFileSync(new URL(`${key}.svg`, out), svg)
  writeFileSync(new URL(`${key}.png`, out), new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng())
}

// Contact sheet: every option large, then the same at dock size.
const keys = Object.keys(options)
const cell = 420
const small = 96
const label = (k, x) =>
  `<text x="${x + cell / 2}" y="${cell + 44}" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${k.toUpperCase()}</text>`
const sheetW = keys.length * cell
const sheetH = cell + 60 + small + 40
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><defs>${defs}</defs>
  <rect width="100%" height="100%" fill="#111318"/>
  ${keys
    .map((k, i) => {
      const x = i * cell
      const s = (cell - 40) / 1024
      const ss = small / 1024
      return `<g transform="translate(${x + 20} 10) scale(${s})">${options[k]}</g>${label(k, x)}
        <g transform="translate(${x + cell / 2 - small / 2} ${cell + 70}) scale(${ss})">${options[k]}</g>`
    })
    .join('')}
</svg>`
writeFileSync(new URL('sheet.svg', out), sheet)
writeFileSync(
  new URL('sheet.png', out),
  new Resvg(sheet, { fitTo: { mode: 'width', value: sheetW }, font: { loadSystemFonts: true } }).render().asPng()
)
console.log('wrote', keys.join(', '), 'and sheet.png')
