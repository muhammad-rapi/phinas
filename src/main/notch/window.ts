import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { NotchLayout } from '../../shared/ipc'
import type { NotchState, PlayerCommand } from '../../shared/types'
import { computeBounds, detectNotch } from './detect'


export interface NotchController {
  /** Shows or hides according to the settings toggle. */
  setEnabled(enabled: boolean): void
  /** Moves the notch to the display of the main window (call after the main window moves). */
  reposition(): void
  destroy(): void
}

/**
 * One small frameless, transparent, always-on-top window at the top centre of the primary display.
 * It appears only while a track is loaded. If it cannot be created the app runs without it.
 * The window (and its renderer process, about 85 MB) exists only while it is wanted: it is created
 * when the notch is on and a track is loaded, and destroyed when the notch is switched off.
 */
export function createNotch(opts: {
  here: string
  loadPage: (win: BrowserWindow) => void
  mainWindow: () => BrowserWindow | null
  enabled: boolean
  platform?: string
}): NotchController {
  const platform = opts.platform ?? process.platform
  let enabled = opts.enabled
  let hasTrack = false
  /** True while the pill is open: only then does the window take mouse clicks. */
  let interactive = false
  let lastState: NotchState | null = null
  let layout: NotchLayout = detectNotch(platform, { x: 0, y: 0, width: 1440, height: 900 }, { x: 0, y: 0, width: 1440, height: 900 })
  let win: BrowserWindow | null = null

  /** The display showing the main window, so the notch follows Phinas across monitors. */
  const targetDisplay = (): Electron.Display => {
    const mw = opts.mainWindow()
    return mw && !mw.isDestroyed() ? screen.getDisplayMatching(mw.getBounds()) : screen.getPrimaryDisplay()
  }

  const place = (): void => {
    if (!win || win.isDestroyed()) return
    const d = targetDisplay()
    layout = detectNotch(platform, d.bounds, d.workArea)
    // Always the open size: resizing a transparent window mid-animation shows a torn frame on macOS.
    win.setBounds(computeBounds(platform, d.bounds, d.workArea, layout, true))
    win.webContents.send('notch:layout', layout)
  }

  /** Creates or destroys the window so it exists exactly while the notch is wanted. */
  const sync = (): void => {
    const wanted = enabled && hasTrack
    if (wanted && !win) create()
    else if (!wanted && win) {
      win.destroy()
      win = null
      interactive = false
    }
  }

  const create = (): void => {
    try {
      win = new BrowserWindow({
        width: 320,
        height: 60,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        hasShadow: false,
        focusable: false,
        // A click on the buttons must act at once. Without this, the first click on a window of an
        // inactive app only activates the app, which brings the main window to the front.
        acceptFirstMouse: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        fullscreenable: false,
        backgroundColor: '#00000000',
        ...(platform === 'darwin' ? { type: 'panel' as const } : {}),
        webPreferences: {
          preload: join(opts.here, '../preload/index.mjs'),
          sandbox: false,
          backgroundThrottling: false
        }
      })
      // The transparent area passes clicks to the apps below; mouse moves still reach the pill (hover).
      win.setIgnoreMouseEvents(true, { forward: true })
      win.setAlwaysOnTop(true, 'screen-saver')
      if (platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
      opts.loadPage(win)
      win.webContents.on('did-finish-load', () => {
        if (!win || win.isDestroyed()) return
        // Position first, then show: the window never appears blank or in the wrong place.
        place()
        if (lastState) win.webContents.send('notch:state', lastState)
        win.showInactive()
      })
      const created = win
      created.on('closed', () => {
        // A newer window may already have replaced this one.
        if (win === created) win = null
      })
    } catch (e) {
      console.error('notch window could not be created, running without it:', e)
      win = null
    }
  }

  ipcMain.on('notch:state', (_e, state: NotchState) => {
    lastState = state
    hasTrack = state.track !== null
    sync()
    if (win && !win.isDestroyed()) win.webContents.send('notch:state', state)
  })
  ipcMain.on('notch:expanded', (_e, value: boolean) => {
    interactive = value === true
    if (!win || win.isDestroyed()) return
    if (interactive) win.setIgnoreMouseEvents(false)
    else win.setIgnoreMouseEvents(true, { forward: true })
  })
  ipcMain.on('library:changed', () => {
    opts.mainWindow()?.webContents.send('library:changed')
  })
  ipcMain.on('player:seek', (_e, sec: unknown) => {
    if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 0) return
    opts.mainWindow()?.webContents.send('player:seek', sec)
  })
  ipcMain.on('player:command', (_e, cmd: PlayerCommand) => {
    opts.mainWindow()?.webContents.send('player:command', cmd)
  })
  screen.on('display-metrics-changed', () => {
    if (win && !win.isDestroyed()) place()
  })

  return {
    setEnabled(value) {
      enabled = value
      sync()
    },
    reposition() {
      if (win && !win.isDestroyed()) place()
    },
    destroy() {
      win?.destroy()
      win = null
    }
  }
}
