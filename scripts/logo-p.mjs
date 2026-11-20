// Renders "P" logo variants (the two-circles idea folded into the letter) to build/logo-options/.
// Run: node scripts/logo-p.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2447bd"/><stop offset="1" stop-color="#172a7a"/></linearGradient>
  <linearGradient id="white" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e6f1ff"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#8ec5fb"/></linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0b1c5c" flood-opacity="0.24"/></filter>
  <clipPath id="stem"><rect x="316" y="236" width="128" height="552" rx="64"/></clipPath>
  <clipPath id="lensA"><circle cx="538" cy="430" r="132"/></clipPath>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>`
const stem = (fill) => `<rect x="316" y="236" width="128" height="552" rx="64" fill="${fill}"/>`

const options = {
  // P1: a white stem (one person) and a sky-blue bowl (the other); where they meet is deep blue
  p1: `${tile}<g filter="url(#soft)">${stem('url(#white)')}<circle cx="570" cy="430" r="204" fill="url(#sky)"/></g>
    <g clip-path="url(#stem)"><circle cx="570" cy="430" r="204" fill="url(#deep)"/></g>`,

  // P2: ring bowl; the equalizer bars sit in the counter of the P
  p2: `${tile}<g filter="url(#soft)">${stem('url(#white)')}<circle cx="570" cy="430" r="168" fill="none" stroke="url(#sky)" stroke-width="104"/></g>
    <g clip-path="url(#stem)"><circle cx="570" cy="430" r="168" fill="none" stroke="url(#deep)" stroke-width="104"/></g>
    <g fill="#fff"><rect x="526" y="396" width="30" height="68" rx="15"/><rect x="570" y="352" width="30" height="156" rx="15"/><rect x="614" y="382" width="30" height="96" rx="15"/></g>`,

  // P3: solid white P whose counter is the "overlap" lens from the circles logo, holding the bars
  p3: `${tile}<g filter="url(#soft)">${stem('url(#white)')}<circle cx="572" cy="430" r="208" fill="url(#white)"/></g>
    <g clip-path="url(#lensA)"><circle cx="606" cy="430" r="132" fill="url(#deep)"/></g>
    <g fill="#fff"><rect x="526" y="398" width="28" height="64" rx="14"/><rect x="568" y="360" width="28" height="140" rx="14"/><rect x="610" y="384" width="28" height="92" rx="14"/></g>`
}

const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`

for (const [key, body] of Object.entries(options)) {
  const svg = wrap(body)
  writeFileSync(new URL(`${key}.svg`, out), svg)
  writeFileSync(new URL(`${key}.png`, out), new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng())
}

const keys = Object.keys(options)
const cell = 520
const small = 96
const sheetW = keys.length * cell
const sheetH = cell + 60 + small + 40
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}"><defs>${defs}</defs>
  <rect width="100%" height="100%" fill="#111318"/>
  ${keys
    .map((k, i) => {
      const x = i * cell
      return `<g transform="translate(${x + 20} 10) scale(${(cell - 40) / 1024})">${options[k]}</g>
        <text x="${x + cell / 2}" y="${cell + 44}" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${k.toUpperCase()}</text>
        <g transform="translate(${x + cell / 2 - small / 2} ${cell + 70}) scale(${small / 1024})">${options[k]}</g>`
    })
    .join('')}
</svg>`
writeFileSync(
  new URL('sheet-p.png', out),
  new Resvg(sheet, { fitTo: { mode: 'width', value: sheetW }, font: { loadSystemFonts: true } }).render().asPng()
)
console.log('wrote', keys.join(', '), 'and sheet-p.png')
