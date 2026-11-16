// Renders build/icon.svg to build/icon.png (1024x1024). Run: node scripts/make-icon.mjs
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('../build/icon.svg', import.meta.url))
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng()
writeFileSync(new URL('../build/icon.png', import.meta.url), png)
console.log(`wrote build/icon.png (${png.length} bytes)`)
