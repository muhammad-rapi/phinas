import { app, BrowserWindow, globalShortcut, ipcMain, session } from 'electron'
import icon from '../../build/icon.png?asset'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS } from '../shared/ipc'
import { createHandlers } from './ipc'
import { openDb } from './library/db'
import { Library } from './library/library'
import { maybeCaptureAndQuit } from './dev-shot'
import { createCoverFetcher } from './music/cover'
import { createStreamProxy } from './music/proxy'
import { createSystemVolume } from './system-volume'
import { YoutubeMusicSource } from './music/source'
import { SyncEngine } from './sync/engine'
import { SupabaseRemote } from './sync/supabase-remote'
import { PairChannel } from './sync/realtime'
import { createNotch } from './notch/window'
import { Recommender } from './recommend/service'
import { SettingsStore } from './settings'
import { registerShortcuts } from './shortcuts'

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

  if (engine && remote) {
    setInterval(async () => {
      if (!(await remote.session())) return
      const r = await engine.flush()
      lastError.value = r.error
    }, SYNC_INTERVAL_MS)
  }

  const settings = new SettingsStore(join(userData, 'settings.json'))
  const recommender = new Recommender(library, source)
  let mainWindow: BrowserWindow | null = null
  const pair = remote
    ? new PairChannel(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
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

  const handlers = createHandlers({
    library,
    source,
    coverData: createCoverFetcher(),
    systemVolume: createSystemVolume(),
    proxyPort: () => proxyPort,
    remote,
    pair,
    engine,
    lastError,
    recommender,
    settings,
    setNotchEnabled: (enabled) => notch?.setEnabled(enabled)
  })
  for (const name of CHANNELS) {
    ipcMain.handle(name, (_e, ...args) =>
      (handlers[name] as (...a: unknown[]) => unknown)(...args)
    )
  }
  ipcMain.on('listen:send', (_e, msg) => pair?.send(msg))

  mainWindow = createWindow()
  mainWindow.on('closed', () => {
    mainWindow = null
    // The notch is a window too: without this the app would never see window-all-closed.
    notch?.destroy()
  })

  if (!shot) {
    registerShortcuts(globalShortcut, (cmd) => mainWindow?.webContents.send('player:command', cmd))
  }
})

app.on('will-quit', () => globalShortcut.unregisterAll())

app.on('window-all-closed', () => app.quit())
