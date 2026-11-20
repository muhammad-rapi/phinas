// Dev helper for the C1 redesign: deletes top-level rules from styles/legacy.css whose selector
// matches a regex, as each area is rebuilt. Deleted together with legacy.css at the end.
// Usage: node scripts/prune-legacy-css.mjs '<regex tested against each top-level selector>'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('../src/renderer/src/styles/legacy.css', import.meta.url))
const re = new RegExp(process.argv[2])
const css = readFileSync(file, 'utf8')
const out = []
let i = 0
let removed = 0
while (i < css.length) {
  const ws = css.slice(i).match(/^\s*/)[0]
  if (ws) {
    out.push(ws)
    i += ws.length
    continue
  }
  if (css.startsWith('/*', i)) {
    const end = css.indexOf('*/', i) + 2
    out.push(css.slice(i, end))
    i = end
    continue
  }
  const open = css.indexOf('{', i)
  if (open === -1) {
    out.push(css.slice(i))
    break
  }
  // Find the matching close brace (handles @container blocks and multi-line rules).
  let depth = 0
  let j = open
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}' && --depth === 0) break
  }
  const selector = css.slice(i, open).trim()
  if (re.test(selector)) {
    removed++
    i = j + 1
    if (css[i] === '\n') i++
  } else {
    out.push(css.slice(i, j + 1))
    i = j + 1
  }
}
writeFileSync(file, out.join(''))
console.log(`prune-legacy-css: removed ${removed} rule(s)`)
