// Writes build/icon.svg: two sound waves (white and sky blue) crossing on a blue tile.
// Run: node scripts/gen-icon-svg.mjs && node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs'

const X0 = 140
const X1 = 884
const AMP = 140
const CYCLES = 1.5

const wave = (phase) => {
  const pts = []
  for (let i = 0; i <= 160; i++) {
    const t = i / 160
    const x = X0 + (X1 - X0) * t
    const y = 512 + AMP * Math.sin(t * CYCLES * 2 * Math.PI + phase)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1f4fd6"/>
      <stop offset="1" stop-color="#3d97f2"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.28" cy="0.12" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <!-- the ends of the waves fade out instead of stopping abruptly -->
    <linearGradient id="fade" x1="${X0}" y1="0" x2="${X1}" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.3" stop-color="#fff" stop-opacity="1"/>
      <stop offset="0.7" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="ends" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="url(#fade)"/>
    </mask>
    <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1c5c" flood-opacity="0.22"/>
    </filter>
  </defs>

  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>

  <g mask="url(#ends)">
    <g filter="url(#soft)" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="76">
      <path d="${wave(0)}" stroke="#8ec5fb"/>
      <path d="${wave(Math.PI)}" stroke="#ffffff"/>
    </g>
  </g>
</svg>
`
writeFileSync(new URL('../build/icon.svg', import.meta.url), svg)
console.log('wrote build/icon.svg')
