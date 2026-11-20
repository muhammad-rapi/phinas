// Preview of the icon with radiating arcs (broadcast rings) around the waves.
// Writes build/logo-options/arcs-*.png and arcs-sheet.png. Run: node scripts/logo-arcs.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const out = new URL('../build/logo-options/', import.meta.url)
mkdirSync(out, { recursive: true })

const X0 = 150
const X1 = 874
const AMP = 128
const CYCLES = 1.5
const wave = (phase) => {
  const pts = []
  for (let i = 0; i <= 160; i++) {
    const t = i / 160
    pts.push(`${i === 0 ? 'M' : 'L'}${(X0 + (X1 - X0) * t).toFixed(1)} ${(512 + AMP * Math.sin(t * CYCLES * 2 * Math.PI + phase)).toFixed(1)}`)
  }
  return pts.join(' ')
}

// Concentric rings, with a gap around the middle where the waves pass through
const rings = (stroke, widths = [16, 14, 12], radii = [418, 356, 294], opacities = [1, 0.75, 0.5]) =>
  radii
    .map((r, i) => `<circle cx="512" cy="512" r="${r}" fill="none" stroke="${stroke}" stroke-width="${widths[i]}" stroke-opacity="${opacities[i]}" stroke-linecap="round"/>`)
    .join('')

const common = (bgId, arcStroke, waveBack, waveFront, glow) => `
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4fd6"/><stop offset="1" stop-color="#3d97f2"/></linearGradient>
    <linearGradient id="navy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1747"/><stop offset="1" stop-color="#1c3790"/></linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="0.55" stop-color="#ff5f8f"/><stop offset="1" stop-color="#9b4fe0"/></linearGradient>
    <linearGradient id="warmH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8f5c"/><stop offset="1" stop-color="#ff5f9e"/></linearGradient>
    <linearGradient id="coolArc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9cc9ff"/></linearGradient>
    <linearGradient id="fade" x1="${X0}" y1="0" x2="${X1}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.28" stop-color="#fff"/><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="ends" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="url(#fade)"/></mask>
    <mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/><rect x="0" y="${512 - 92}" width="1024" height="184" fill="#000"/>
    </mask>
    <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0b1c5c" flood-opacity="0.22"/></filter>
    <filter id="neon" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><feGaussianBlur stdDeviation="${glow}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="tile"><rect x="64" y="64" width="896" height="896" rx="208"/></clipPath>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#${bgId})"/>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>
  <g clip-path="url(#tile)"><g mask="url(#gap)" filter="url(#neon)">${rings(arcStroke)}</g></g>
  <rect x="76" y="76" width="872" height="872" rx="196" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="7"/>
  <g mask="url(#ends)"><g filter="url(#soft)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="66">
    <path d="${wave(0)}" stroke="${waveBack}"/><path d="${wave(Math.PI)}" stroke="${waveFront}"/>
  </g></g>`

const options = {
  // Blue, like the current icon, with white rings
  cool: common('blue', 'url(#coolArc)', '#8ec5fb', '#ffffff', 0),
  // Warm neon on navy, closer to the reference
  warm: common('navy', 'url(#warm)', '#ff9a5c', '#ffffff', 5)
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`
for (const [k, body] of Object.entries(options)) {
  writeFileSync(new URL(`arcs-${k}.png`, out), new Resvg(wrap(body), { fitTo: { mode: 'width', value: 1024 } }).render().asPng())
}

const keys = Object.keys(options)
const cell = 560
const small = 96
const sheetW = keys.length * cell
const sheetH = cell + 60 + small + 30
const inner = (k) => options[k].replace(/<defs>[\s\S]*?<\/defs>/, '')
// ids must be unique per sheet, so render each full icon to PNG and place the images
const sheet = new Resvg(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}">
  <rect width="100%" height="100%" fill="#111318"/>
  ${keys
    .map((k, i) => {
      const x = i * cell
      const svg = wrap(options[k])
      const b64 = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()).toString('base64')
      return `<image x="${x + 20}" y="10" width="${cell - 40}" height="${cell - 40}" href="data:image/png;base64,${b64}"/>
      <text x="${x + cell / 2}" y="${cell + 38}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff" text-anchor="middle">${k.toUpperCase()}</text>
      <image x="${x + cell / 2 - small / 2}" y="${cell + 55}" width="${small}" height="${small}" href="data:image/png;base64,${b64}"/>`
    })
    .join('')}
</svg>`,
  { fitTo: { mode: 'width', value: sheetW }, font: { loadSystemFonts: true } }
)
writeFileSync(new URL('arcs-sheet.png', out), sheet.render().asPng())
void inner
console.log('wrote arcs-cool.png, arcs-warm.png, arcs-sheet.png')
