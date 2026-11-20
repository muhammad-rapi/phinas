// Combines the wave-split orb (S1) with piano key 29 (C#3). Run: node scripts/logo-merge.mjs
// Writes build/logo-options/merge-*.png and merge-sheet.png
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
  <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.24"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <linearGradient id="white" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e4f0ff"/></linearGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe0ff"/><stop offset="1" stop-color="#86bffa"/></linearGradient>
  <linearGradient id="black" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2f86"/><stop offset="1" stop-color="#0b1647"/></linearGradient>
  <linearGradient id="hit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fe3ff"/><stop offset="1" stop-color="#2fa0ff"/></linearGradient>
  <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1c5c" flood-opacity="0.26"/></filter>
  <clipPath id="orb"><circle cx="512" cy="512" r="300"/></clipPath>`

const tile = `<rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/><rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/><rect x="76" y="76" width="872" height="872" rx="196" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="7"/>`

const waveRegion = (() => {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push(`${(200 + 624 * t).toFixed(1)} ${(512 + 70 * Math.sin(t * 2 * Math.PI)).toFixed(1)}`)
  }
  return `M${pts.join(' L')} L824 900 L200 900 Z`
})()

const orb = `<g filter="url(#soft)"><circle cx="512" cy="512" r="300" fill="url(#white)"/></g>`
const sea = (opacity = 1) => `<g clip-path="url(#orb)"><path d="${waveRegion}" fill="url(#sky)" fill-opacity="${opacity}"/></g>`

const options = {
  // M1: the C# key stands in the orb and sinks into the wave
  m1: `${tile}${orb}
    <g clip-path="url(#orb)"><rect x="438" y="260" width="148" height="400" rx="34" fill="url(#black)"/></g>
    ${sea(0.88)}`,

  // M2: the top of the orb is a keyboard (C D E F G); C# lights up, the wave is the lower half
  m2: (() => {
    const w = 100
    const x0 = 262
    const seams = [1, 2, 3, 4].map((i) => `<path d="M${x0 + w * i} 200 V820" stroke="#c9defa" stroke-width="6"/>`).join('')
    const black = (b, fill) => `<rect x="${b - 31}" y="200" width="62" height="232" rx="16" fill="${fill}"/>`
    return `${tile}${orb}
      <g clip-path="url(#orb)">${seams}${black(x0 + w * 2, 'url(#black)')}${black(x0 + w * 4, 'url(#black)')}${black(x0 + w, 'url(#hit)')}</g>
      ${sea(0.92)}`
  })(),

  // M3: like M1, with the key lit and numbered
  m3: `${tile}${orb}
    <g clip-path="url(#orb)"><rect x="428" y="250" width="168" height="410" rx="38" fill="url(#hit)"/></g>
    ${sea(0.88)}
    <text x="512" y="440" font-family="Helvetica, Arial, sans-serif" font-size="98" font-weight="800" fill="#0b1647" text-anchor="middle" letter-spacing="-3">29</text>`
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`
const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
const pngs = {}
for (const [k, body] of Object.entries(options)) {
  pngs[k] = render(wrap(body), 1024)
  writeFileSync(new URL(`merge-${k}.png`, out), pngs[k])
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
writeFileSync(new URL('merge-sheet.png', out), render(sheet, sheetW))
console.log('wrote', keys.join(', '), 'and merge-sheet.png')
