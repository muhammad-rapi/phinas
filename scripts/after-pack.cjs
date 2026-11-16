// electron-builder afterPack hook. Putting our icon into Phinas.exe normally needs Wine on a
// Mac, so this edits the exe's icon resources directly with `resedit` (pure JavaScript).
const fs = require('node:fs')
const path = require('node:path')

const { execFileSync } = require('node:child_process')

/**
 * macOS: packaging renames and re-icons Electron.app, which breaks its code signature, and
 * Apple Silicon Macs refuse a downloaded app with a broken signature ("is damaged"). Without a
 * paid Developer ID we sign ad-hoc ("-"): the signature is valid, so macOS shows the normal
 * "cannot verify the developer" prompt instead, which can be dismissed in System Settings.
 */
function signMacAdHoc(context) {
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' })
  console.log(`  • afterPack: ${path.basename(app)} signed ad-hoc and verified`)
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') return signMacAdHoc(context)
  if (context.electronPlatformName !== 'win32') return
  const ResEdit = await import('resedit')
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const icoPath = path.join(context.packager.projectDir, 'build', 'icon.ico')

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(exe)
  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath))

  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  if (groups.length === 0) throw new Error('afterPack: no icon group found in ' + exePath)
  const group = groups[0]
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    group.id,
    group.lang,
    icon.icons.map((i) => i.data)
  )
  res.outputResource(exe)
  fs.writeFileSync(exePath, Buffer.from(exe.generate()))
  console.log(`  • afterPack: icon of ${path.basename(exePath)} replaced (${icon.icons.length} sizes)`)
}
