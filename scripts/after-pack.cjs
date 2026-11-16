// electron-builder afterPack hook. Putting our icon into Phinas.exe normally needs Wine on a
// Mac, so this edits the exe's icon resources directly with `resedit` (pure JavaScript).
const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
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
