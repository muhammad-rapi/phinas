// Writes build/icon.svg: a navy vinyl with a blue sunset-band label and a soft sound-wave line
// underneath, on a white-blue tile. Run: node scripts/gen-icon-vinyl.mjs && node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs'

const TILE = '#f1f6ff'
const DISC = '#12286f'
const GROOVE = '#27438f'
const LABEL = '#3a86f0'
const WHITE = '#ffffff'
const INK = '#12286f'
const CX = 512
const CY = 468
const R = 332
const K = R / 262 // everything inside the disc is scaled by this

// A smooth curve through the points (Catmull-Rom turned into cubic Beziers): no sharp corners
const smooth = (pts) => {
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`
  }
  return d
}

// Flat, one soft burst in the middle, flat again
const BASE = 872
const wave = smooth([
  [318, BASE],
  [410, BASE],
  [440, BASE - 28],
  [470, BASE + 32],
  [500, BASE - 46],
  [530, BASE + 24],
  [556, BASE - 14],
  [586, BASE],
  [706, BASE]
])

const arc = (r, a0, a1) => {
  const pt = (a) => `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`
  return `M${pt(a0)} A${r} ${r} 0 0 1 ${pt(a1)}`
}

const bands = (() => {
  const hs = [6, 9, 12, 16].map((h) => h * K)
  const gaps = [14, 13, 12, 0].map((g) => g * K)
  let y = CY + 26 * K
  return hs
    .map((h, i) => {
      const r = `<rect x="380" y="${y}" width="620" height="${h}" fill="${WHITE}"/>`
      y += h + gaps[i]
      return r
    })
    .join('')
})()

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <clipPath id="label"><circle cx="${CX}" cy="${CY}" r="${104 * K}"/></clipPath>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="${TILE}"/>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="none" stroke="#d3e1fa" stroke-width="4"/>

  <circle cx="${CX}" cy="${CY}" r="${R}" fill="${DISC}"/>
  ${[222, 190, 158].map((r) => `<circle cx="${CX}" cy="${CY}" r="${(r * K).toFixed(1)}" fill="none" stroke="${GROOVE}" stroke-width="6"/>`).join('\n  ')}
  <path d="${arc(188 * K, Math.PI * 1.08, Math.PI * 1.34)}" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="11" stroke-linecap="round"/>

  <circle cx="${CX}" cy="${CY}" r="${104 * K}" fill="${LABEL}"/>
  <g clip-path="url(#label)">${bands}</g>
  <circle cx="${CX}" cy="${CY}" r="${15 * K}" fill="${WHITE}"/>

  <path d="${wave}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
writeFileSync(new URL('../build/icon.svg', import.meta.url), svg)
console.log('wrote build/icon.svg')
