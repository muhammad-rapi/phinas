// Writes build/icon.svg: a wave-split orb whose top half is a keyboard. The lit orange key is
// piano key 29 (C#3 / Db3). Run: node scripts/gen-icon-svg.mjs && node scripts/make-icon.mjs
import { writeFileSync } from 'node:fs'

const CX = 512
const CY = 512
const R = 300

// White keys are 150 wide; the seam between C and D sits at the centre, so C# is the middle key.
const KEY_W = 150
const SEAMS = [CX - KEY_W, CX, CX + KEY_W]
const BLACK_W = 88
const BLACK_H = 268
const TOP = CY - R

// The wave that separates the keyboard (top) from the "sea" (bottom)
const wavePoints = []
for (let i = 0; i <= 120; i++) {
  const t = i / 120
  wavePoints.push(`${(CX - R - 12 + (2 * R + 24) * t).toFixed(1)} ${(CY + 70 * Math.sin(t * 2 * Math.PI)).toFixed(1)}`)
}
const sea = `M${wavePoints.join(' L')} L${CX + R + 12} ${CY + R + 20} L${CX - R - 12} ${CY + R + 20} Z`

const seams = SEAMS.map((x) => `<path d="M${x} ${TOP} V${CY + R}" stroke="#c9defa" stroke-width="6"/>`).join('')
const blackKey = (x, fill, extra = '') =>
  `<rect ${extra} x="${x - BLACK_W / 2}" y="${TOP}" width="${BLACK_W}" height="${BLACK_H}" rx="22" fill="${fill}"/>`

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
    <linearGradient id="white" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e4f0ff"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#bfe0ff"/>
      <stop offset="1" stop-color="#86bffa"/>
    </linearGradient>
    <linearGradient id="black" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#23232c"/>
      <stop offset="1" stop-color="#07070a"/>
    </linearGradient>
    <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb42e"/>
      <stop offset="1" stop-color="#ff6d12"/>
    </linearGradient>
    <filter id="soft" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b1c5c" flood-opacity="0.26"/>
    </filter>
    <filter id="lit" filterUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="orb"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  </defs>

  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)"/>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#glow)"/>
  <rect x="76" y="76" width="872" height="872" rx="196" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="7"/>

  <g filter="url(#soft)"><circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#white)"/></g>

  <g clip-path="url(#orb)">
    ${seams}
    ${blackKey(SEAMS[2], 'url(#black)')}
    ${blackKey(SEAMS[1], 'url(#orange)', 'filter="url(#lit)"')}
  </g>

  <!-- the wave: the keys sink into it -->
  <g clip-path="url(#orb)"><path d="${sea}" fill="url(#sky)" fill-opacity="0.92"/></g>
</svg>
`
writeFileSync(new URL('../build/icon.svg', import.meta.url), svg)
console.log('wrote build/icon.svg')
