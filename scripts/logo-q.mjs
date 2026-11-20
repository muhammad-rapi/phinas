// Renders non-letter logo variants to build/logo-options/. Run: node scripts/logo-q.mjs
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
  <linearGradient id="loop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a9d3ff"/></linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0b1c5c" flood-opacity="0.24"/></filter>
  <clipPath id="a"><circle cx="384" cy="512" r="282"/></clipPath>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>`

// A sine ribbon from x0 to x1, as a smooth polyline
const wave = (phase, x0 = 196, x1 = 828, amp = 150, cycles = 1.5) => {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    const x = x0 + (x1 - x0) * t
    const y = 512 + amp * Math.sin(t * cycles * 2 * Math.PI + phase)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

const grooves = (cx, color) =>
  [236, 196, 156].map((r) => `<circle cx="${cx}" cy="512" r="${r}" fill="none" stroke="${color}" stroke-width="9"/>`).join('')

const options = {
  // Q1: two records that meet; the overlap carries the equalizer
  q1: `${tile}
    <g filter="url(#soft)"><circle cx="384" cy="512" r="282" fill="url(#white)"/><circle cx="640" cy="512" r="282" fill="url(#sky)"/></g>
    ${grooves(384, '#cfe1f8')}${grooves(640, '#7db6f2')}
    <g clip-path="url(#a)"><circle cx="640" cy="512" r="282" fill="url(#deep)"/></g>
    <g fill="#fff"><rect x="416" y="436" width="48" height="152" rx="24"/><rect x="488" y="352" width="48" height="320" rx="24"/><rect x="560" y="404" width="48" height="216" rx="24"/></g>`,

  // Q2: an infinity loop of sound: two people, one endless song
  q2: `${tile}
    <g filter="url(#soft)"><path d="M512 512 C612 372 812 372 812 512 C812 652 612 652 512 512 C412 372 212 372 212 512 C212 652 412 652 512 512 Z" fill="none" stroke="url(#loop)" stroke-width="100" stroke-linejoin="round"/></g>`,

  // Q3: two sound waves, one white and one sky, crossing and carrying each other
  q3: `${tile}
    <g filter="url(#soft)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="76">
      <path d="${wave(0)}" stroke="#8ec5fb"/>
      <path d="${wave(Math.PI)}" stroke="#fff"/>
    </g>`
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
  new URL('sheet-q.png', out),
  new Resvg(sheet, { fitTo: { mode: 'width', value: sheetW }, font: { loadSystemFonts: true } }).render().asPng()
)
console.log('wrote', keys.join(', '), 'and sheet-q.png')
