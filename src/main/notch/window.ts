import { BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import type { NotchLayout } from '../../shared/ipc'
import type { NotchState, PlayerCommand } from '../../shared/types'
import { computeBounds, detectNotch } from './detect'


export interface NotchController {
  /** Shows or hides according to the settings toggle. */
  setEnabled(enabled: boolean): void
  destroy(): void
}

/**
 * One small frameless, transparent, always-on-top window at the top centre of the primary display.
 * It appears only while a track is loaded. If it cannot be created the app runs without it.
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
  let expanded = false
  let lastState: NotchState | null = null
  let layout: NotchLayout = detectNotch(platform, { x: 0, y: 0, width: 1440, height: 900 }, { x: 0, y: 0, width: 1440, height: 900 })
  let win: BrowserWindow | null = null

  const place = (): void => {
    if (!win) return
    const d = screen.getPrimaryDisplay()
    layout = detectNotch(platform, d.bounds, d.workArea)
    win.setBounds(computeBounds(platform, d.bounds, d.workArea, layout, expanded))
    win.webContents.send('notch:layout', layout)
  }

  const sync = (): void => {
    if (!win || win.isDestroyed()) return
    if (enabled && hasTrack) {
      place()
      if (!win.isVisible()) win.showInactive()
    } else if (win.isVisible()) {
      win.hide()
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
      win.setAlwaysOnTop(true, 'screen-saver')
      if (platform === 'darwin') win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
      opts.loadPage(win)
      win.webContents.on('did-finish-load', () => {
        win?.webContents.send('notch:layout', layout)
        if (lastState) win?.webContents.send('notch:state', lastState)
      })
      win.on('closed', () => {
        win = null
      })
    } catch (e) {
      console.error('notch window could not be created, running without it:', e)
      win = null
    }
  }

  ipcMain.on('notch:state', (_e, state: NotchState) => {
    lastState = state
    const had = hasTrack
    hasTrack = state.track !== null
    if (!win || win.isDestroyed()) return
    win.webContents.send('notch:state', state)
    if (had !== hasTrack) sync()
  })
  ipcMain.on('notch:expanded', (_e, value: boolean) => {
    expanded = value
    place()
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
  screen.on('display-metrics-changed', place)

  create()

  return {
    setEnabled(value) {
      enabled = value
      sync()
    },
    destroy() {
      win?.destroy()
    }
  }
}
