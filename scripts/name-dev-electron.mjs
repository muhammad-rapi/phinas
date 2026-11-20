// Dev only: `npm run dev` runs the stock Electron.app, so the Mac menu bar and Cmd+Tab say
// "Electron". This renames that local copy to "Phinas". Packaged builds already use the right
// name (productName in electron-builder.yml). Reinstalling node_modules undoes it, harmlessly.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const plist = new URL('../node_modules/electron/dist/Electron.app/Contents/Info.plist', import.meta.url)
if (process.platform === 'darwin' && existsSync(plist)) {
  const before = readFileSync(plist, 'utf8')
  const after = before.replace(/(<key>(?:CFBundleName|CFBundleDisplayName)<\/key>\s*<string>)Electron(<\/string>)/g, '$1Phinas$2')
  if (after !== before) writeFileSync(plist, after)
}
