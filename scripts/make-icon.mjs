// Renders build/icon.svg to build/icon.png (1024x1024) and build/icon.ico (Windows, 16-256 px).
// Run: node scripts/make-icon.mjs
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('../build/icon.svg', import.meta.url))
const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

const png = render(1024)
writeFileSync(new URL('../build/icon.png', import.meta.url), png)
console.log(`wrote build/icon.png (${png.length} bytes)`)

// An .ico is a small header plus one directory entry per size; modern Windows accepts PNG data.
const sizes = [16, 24, 32, 48, 64, 128, 256]
const images = sizes.map((s) => ({ size: s, data: render(s) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(images.length, 4)
let offset = 6 + 16 * images.length
const entries = images.map(({ size, data }) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(size === 256 ? 0 : size, 0) // width (0 means 256)
  e.writeUInt8(size === 256 ? 0 : size, 1) // height
  e.writeUInt8(0, 2) // palette
  e.writeUInt8(0, 3)
  e.writeUInt16LE(1, 4) // colour planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(data.length, 8)
  e.writeUInt32LE(offset, 12)
  offset += data.length
  return e
})
const ico = Buffer.concat([header, ...entries, ...images.map((i) => i.data)])
writeFileSync(new URL('../build/icon.ico', import.meta.url), ico)
console.log(`wrote build/icon.ico (${ico.length} bytes, sizes ${sizes.join('/')})`)
