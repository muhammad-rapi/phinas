import { Menu, Tray, nativeImage } from 'electron'
import { readFileSync } from 'node:fs'
import icon1x from '../../build/tray/trayTemplate.png?asset'
import icon2x from '../../build/tray/trayTemplate@2x.png?asset'

export interface TrayController {
  /** Rebuilds the menu, e.g. after the notch was shown or hidden somewhere else. */
  refresh(): void
  destroy(): void
}

/**
 * Mac menu bar icon. Its menu shows or hides the notch and brings the app forward, so the notch
 * can be turned back on after it was hidden from the notch itself, even with the app in the back.
 */
export function createTray(opts: {
  notchEnabled: () => boolean
  setNotchEnabled: (enabled: boolean) => void
  showApp: () => void
  quit: () => void
}): TrayController {
  // A template image is black with alpha; macOS recolours it for light and dark menu bars.
  const image = nativeImage.createFromPath(icon1x)
  image.addRepresentation({ scaleFactor: 2, buffer: readFileSync(icon2x) })
  image.setTemplateImage(true)

  const tray = new Tray(image)
  tray.setToolTip('Phinas')

  const refresh = (): void => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Tampilkan notch',
          type: 'checkbox',
          checked: opts.notchEnabled(),
          click: (item) => opts.setNotchEnabled(item.checked)
        },
        { type: 'separator' },
        { label: 'Buka Phinas', click: opts.showApp },
        { label: 'Keluar', click: opts.quit }
      ])
    )
  }
  refresh()

  return { refresh, destroy: () => tray.destroy() }
}
