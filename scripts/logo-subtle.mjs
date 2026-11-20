// Abstract logo previews with only a hint of music (no notes or equalizer bars).
// Writes build/logo-options/subtle-*.png and subtle-sheet.png. Run: node scripts/logo-subtle.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="white" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e4f0ff"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#86bffa"/></linearGradient>
  <linearGradient id="spiral" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a9d3ff"/></linearGradient>
  <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1c5c" flood-opacity="0.24"/></filter>
  <clipPath id="orb"><circle cx="512" cy="512" r="300"/></clipPath>
  <clipPath id="lower"><rect x="0" y="512" width="1024" height="512"/></clipPath>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/><rect x="76" y="76" width="872" height="872" rx="196" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="7"/>`

// S1: a round orb split by a soft wave line into two tones (two sides, one sound)
const splitWave = (() => {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push(`${(200 + 624 * t).toFixed(1)} ${(512 + 70 * Math.sin(t * 2 * Math.PI)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} L824 900 L200 900 Z`
})()

// S2: a single groove spiralling out like the track of a record
const spiral = (() => {
  const pts = []
  const turns = 3.1
  for (let i = 0; i <= 400; i++) {
    const t = i / 400
    const a = t * turns * 2 * Math.PI - Math.PI / 2
    const r = 34 + 262 * t
    pts.push(`${(512 + r * Math.cos(a)).toFixed(1)} ${(512 + r * Math.sin(a)).toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
})()

const options = {
  s1: `${tile}<g filter="url(#soft)"><circle cx="512" cy="512" r="300" fill="url(#white)"/></g>
    <g clip-path="url(#orb)"><path d="${splitWave}" fill="url(#sky)"/></g>`,

  s2: `${tile}<g filter="url(#soft)"><path d="${spiral}" fill="none" stroke="url(#spiral)" stroke-width="40" stroke-linecap="round"/></g>
    <circle cx="512" cy="512" r="26" fill="#fff"/>`,

  // S3: a record-like ring with a smaller circle resting against it (two, together)
  s3: `${tile}<g filter="url(#soft)"><circle cx="470" cy="560" r="236" fill="none" stroke="url(#white)" stroke-width="96"/>
    <circle cx="742" cy="316" r="96" fill="url(#sky)"/></g>`,

  // S4: two rings linked like a chain, one over and one under at each crossing
  s4: `${tile}<g filter="url(#soft)" fill="none" stroke-width="74">
      <circle cx="396" cy="512" r="196" stroke="url(#white)"/>
      <circle cx="628" cy="512" r="196" stroke="url(#sky)"/>
      <g clip-path="url(#lower)"><circle cx="396" cy="512" r="196" stroke="url(#white)"/></g>
    </g>`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = new Resvg(wrap(body), { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
  writeFileSync(new URL(`subtle-${k}.png`, out), pngs[k])
}

const keys = Object.keys(options)
const cell = 500
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
writeFileSync(new URL('subtle-sheet.png', out), new Resvg(sheet, { fitTo: { mode: 'width', value: sheetW }, font: { loadSystemFonts: true } }).render().asPng())
console.log('wrote', keys.join(', '), 'and subtle-sheet.png')
