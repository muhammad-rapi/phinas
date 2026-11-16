import { app, BrowserWindow, ipcMain, session } from 'electron'
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

const here = fileURLToPath(new URL('.', import.meta.url))
const SYNC_INTERVAL_MS = 15_000

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Phinas',
    icon,
    // On Mac the traffic-light buttons sit inside our top bar instead of a separate title bar.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 20, y: 24 } }
      : {}),
    webPreferences: { preload: join(here, '../preload/index.mjs'), sandbox: false }
  })
  maybeCaptureAndQuit(win)
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(here, '../renderer/index.html'))
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

app.whenReady().then(async () => {
  app.setName('Phinas')
  app.dock?.setIcon(icon)
  applyCsp()
  const userData = app.getPath('userData')
  const library = new Library(openDb(join(userData, 'phinas.db')))
  const source = new YoutubeMusicSource(app.getLocaleCountryCode() || undefined)

  const proxy = createStreamProxy((id) => source.getStreamUrl(id))
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

  const handlers = createHandlers({
    library,
    source,
    coverData: createCoverFetcher(),
    systemVolume: createSystemVolume(),
    proxyPort: () => proxyPort,
    remote,
    engine,
    lastError
  })
  for (const name of CHANNELS) {
    ipcMain.handle(name, (_e, ...args) =>
      (handlers[name] as (...a: unknown[]) => unknown)(...args)
    )
  }

  createWindow()
})

app.on('window-all-closed', () => app.quit())
