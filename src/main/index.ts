import { app, BrowserWindow, globalShortcut, ipcMain, Notification, session, shell } from 'electron'
import icon from '../../build/icon.png?asset'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS } from '../shared/ipc'
import { createHandlers } from './ipc'
import { openDb } from './library/db'
import { Library } from './library/library'
import { maybeCaptureAndQuit } from './dev-shot'
import { createUpdater, electronAutoInstaller, fetchLatestRelease } from './updater'
import { createCoverFetcher } from './music/cover'
import { createStreamProxy } from './music/proxy'
import { createSystemVolume } from './system-volume'
import { YoutubeMusicSource } from './music/source'
import { SyncEngine } from './sync/engine'
import { SupabaseRemote } from './sync/supabase-remote'
import { PairChannel } from './sync/realtime'
import { CacheStore } from './sync/cache'
import { PresenceHub } from './sync/presence'
import { createNotch } from './notch/window'
import { Recommender } from './recommend/service'
import { SettingsStore } from './settings'
import { registerShortcuts } from './shortcuts'
import { createTray, type TrayController } from './tray'

const here = fileURLToPath(new URL('.', import.meta.url))
const SYNC_INTERVAL_MS = 15_000

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    // Screenshot runs (dev helper) stay hidden so they never steal keystrokes from the real app.
    show: !process.env['PHINAS_SHOT'],
    backgroundColor: '#000000',
    title: 'Phinas',
    // Windows and Linux: no File/Edit/View bar (Alt shows it); F11 still toggles fullscreen.
    autoHideMenuBar: true,
    icon,
    // On Mac the traffic-light buttons sit inside our top bar instead of a separate title bar.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 20, y: 24 } }
      : {}),
    webPreferences: {
      preload: join(here, '../preload/index.mjs'),
      sandbox: false,
      backgroundThrottling: !process.env['PHINAS_SHOT']
    }
  })
  maybeCaptureAndQuit(win)
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(here, '../renderer/index.html'))
  return win
}

function applyCsp(): void {
  if (!app.isPackaged) return
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' https: data:; media-src http://127.0.0.1:*; style-src 'self' 'unsafe-inline'; script-src 'self'"
        ]
      }
    })
  })
}

// Screenshot runs use a throwaway profile, so nothing of the real library or login is captured.
if (process.env['PHINAS_SHOT'] && process.env['PHINAS_SHOT_PROFILE']) {
  app.setPath('userData', process.env['PHINAS_SHOT_PROFILE'])
}

app.whenReady().then(async () => {
  app.setName('Phinas')
  app.dock?.setIcon(icon)
  applyCsp()
  const userData = app.getPath('userData')
  const library = new Library(openDb(join(userData, 'phinas.db')))
  const source = new YoutubeMusicSource(app.getLocaleCountryCode() || undefined)

  const proxy = createStreamProxy((id, fresh) => source.getStreamUrl(id, fresh))
  const proxyPort = await proxy.start()

  const url = import.meta.env.MAIN_VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.MAIN_VITE_SUPABASE_ANON_KEY as string | undefined
  const remote = url && key ? new SupabaseRemote(url, key, join(userData, 'session.json')) : null
  const engine = remote ? new SyncEngine(library, remote) : null
  const lastError: { value?: string } = {}

  const settings = new SettingsStore(join(userData, 'settings.json'))
  const recommender = new Recommender(library, source)
  let mainWindow: BrowserWindow | null = null
  const pair = remote
    ? new PairChannel(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const presence = remote
    ? new PresenceHub(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const cache = new CacheStore(join(userData, 'social-cache.json'))
  const shot = Boolean(process.env['PHINAS_SHOT'])
  const notch = shot
    ? null
    : createNotch({
        here,
        enabled: settings.get('notch'),
        mainWindow: () => mainWindow,
        loadPage: (w) => {
          if (process.env['ELECTRON_RENDERER_URL']) w.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/notch.html`)
          else w.loadFile(join(here, '../renderer/notch.html'))
        }
      })

  let tray: TrayController | null = null
  /** Shows or hides the notch, wherever that was asked (Profil, player bar, the notch, the menu bar). */
  const showNotch = (enabled: boolean): void => {
    settings.set('notch', enabled)
    notch?.setEnabled(enabled)
    mainWindow?.webContents.send('notch:enabled', enabled)
    tray?.refresh()
  }

  const updater = createUpdater({
    currentVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    fetchRelease: fetchLatestRelease,
    // Unsigned Mac apps cannot replace themselves, so only Windows installs in place.
    autoInstaller: process.platform === 'win32' && app.isPackaged ? electronAutoInstaller : undefined,
    openExternal: (url) => void shell.openExternal(url),
    send: (status) => mainWindow?.webContents.send('update:status', status)
  })

  const handlers = createHandlers({
    library,
    source,
    coverData: createCoverFetcher(),
    systemVolume: createSystemVolume(),
    proxyPort: () => proxyPort,
    remote,
    pair,
    presence,
    cache,
    openExternal: (url) => void shell.openExternal(url),
    engine,
    lastError,
    recommender,
    settings,
    setNotchEnabled: showNotch,
    updater
  })
  for (const name of CHANNELS) {
    ipcMain.handle(name, (_e, ...args) =>
      (handlers[name] as (...a: unknown[]) => unknown)(...args)
    )
  }
  if (engine && remote) {
    let tick = 0
    setInterval(async () => {
      if (!(await remote.session())) return
      const r = await engine.flush()
      lastError.value = r.error
      // Every minute: refresh friends (keeps presence in step) and leave a pair that is no longer allowed.
      if (tick++ % 4 === 0) {
        const friends = await handlers.listFriends().catch(() => null)
        if (friends && !friends.some((f) => f.isPartner && f.canListen)) await pair?.close()
      }
    }, SYNC_INTERVAL_MS)
  }
  ipcMain.on('listen:send', (_e, msg) => pair?.send(msg))
  // An invite only shows inside the app, so without this a partner in another app never sees it.
  ipcMain.on('listen:invited', (_e, name: unknown) => {
    const win = mainWindow
    if (!win || win.isFocused()) return
    const who = typeof name === 'string' && name.trim() ? name.trim() : 'Pasangan'
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Dengarkan bareng', body: `${who} mengajak kamu dengarkan bareng.` })
      n.on('click', () => {
        mainWindow?.show()
        mainWindow?.focus()
        app.focus({ steal: true })
      })
      n.show()
    }
    if (process.platform === 'darwin') app.dock?.bounce('informational')
    else win.flashFrame(true)
  })

  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
    // The notch is a window too: without this the app would never see window-all-closed.
    notch?.destroy()
    tray?.destroy()
    tray = null
  })

  if (!shot && process.platform === 'darwin') {
    try {
      tray = createTray({
        notchEnabled: () => settings.get('notch'),
        setNotchEnabled: showNotch,
        showApp: () => {
          mainWindow?.show()
          mainWindow?.focus()
          app.focus({ steal: true })
        },
        quit: () => app.quit()
      })
    } catch (e) {
      console.error('menu bar icon could not be created, running without it:', e)
    }
  }

  if (!shot) {
    registerShortcuts(globalShortcut, (cmd) => mainWindow?.webContents.send('player:command', cmd))
  }
  // Installed builds look for updates on their own; dev runs only when asked from Profil.
  if (!shot && app.isPackaged) updater.start()
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => app.quit())
