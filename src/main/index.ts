import { app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, Notification, session, shell } from 'electron'
import icon from '../../build/icon.png?asset'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS } from '../shared/ipc'
import { parseMessage } from '../shared/sync/protocol'
import { createHandlers, type LibraryServices } from './ipc'
import { LibraryHost } from './library/host'
import { maybeCaptureAndQuit } from './dev-shot'
import { createUpdater, electronAutoInstaller, fetchLatestRelease } from './updater'
import { createCoverFetcher } from './music/cover'
import { createStreamProxy } from './music/proxy'
import { createSystemVolume } from './system-volume'
import { YoutubeMusicSource } from './music/source'
import { engineFor } from './sync/engine'
import { SupabaseRemote } from './sync/supabase-remote'
import { PairHub } from './sync/pair-hub'
import { CacheStore } from './sync/cache'
import { PresenceHub } from './sync/presence'
import { createNotch } from './notch/window'
import { Recommender } from './recommend/service'
import { SettingsStore } from './settings'
import { registerShortcuts } from './shortcuts'
import { createTray, type TrayController } from './tray'

const here = fileURLToPath(new URL('.', import.meta.url))
const SYNC_INTERVAL_MS = 15_000
/** The account's library is pulled from the server every 20 sync ticks (5 minutes). */
const PULL_EVERY_TICKS = 20

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    // Screenshot runs (dev helper) stay hidden so they never steal keystrokes from the real app.
    show: !process.env['PHINAS_SHOT'],
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1714' : '#f4efe6',
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

// Dev only: `PHINAS_PROFILE=b npm run dev` runs a copy of the app with its own library, login,
// settings and localStorage in `userData/b`, so two accounts can be tried side by side.
const devProfile = process.env['PHINAS_PROFILE']
if (devProfile && !app.isPackaged && !process.env['PHINAS_SHOT']) {
  if (/^[A-Za-z0-9_-]+$/.test(devProfile)) {
    app.setPath('userData', join(app.getPath('userData'), devProfile))
    console.log('[dev] user data:', app.getPath('userData'))
  } else {
    console.error('[dev] PHINAS_PROFILE may only hold letters, digits, - and _; ignored:', devProfile)
  }
}

app.whenReady().then(async () => {
  app.setName('Phinas')
  app.dock?.setIcon(icon)
  applyCsp()
  const userData = app.getPath('userData')
  const settings = new SettingsStore(join(userData, 'settings.json'))
  const source = new YoutubeMusicSource(app.getLocaleCountryCode() || undefined)

  const proxy = createStreamProxy((id, fresh) => source.getStreamUrl(id, fresh))
  const proxyPort = await proxy.start()

  const url = import.meta.env.MAIN_VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.MAIN_VITE_SUPABASE_ANON_KEY as string | undefined
  const remote = url && key ? new SupabaseRemote(url, key, join(userData, 'session.json')) : null
  // From the stored session (no network), so the right library opens offline too.
  const signedInAs = remote ? await remote.session().catch(() => null) : null
  // Someone already signed in on this computer has answered the welcome screen.
  if (signedInAs && !settings.get('welcomeDone')) settings.set('welcomeDone', true)
  const host: LibraryHost<LibraryServices> = new LibraryHost<LibraryServices>({
    dir: userData,
    settings,
    userId: signedInAs?.userId ?? null,
    // Only an account's own library is synced, and only while that account is the signed-in one.
    build: (lib, owner) => ({
      engine: engineFor(lib, owner, remote, (e) => host.services.engine === e && host.userId === owner),
      recommender: new Recommender(lib, source)
    })
  })
  if (signedInAs && host.userId !== signedInAs.userId) {
    console.error('[sync] the account library could not be opened; sync stays off for this run:', host.error)
  }
  const lastError: { value?: string } = {}

  let mainWindow: BrowserWindow | null = null
  const pairs = remote
    ? new PairHub(remote.client, (channel, value) => mainWindow?.webContents.send(channel, value))
    : null
  const presence = remote
    ? new PresenceHub(remote.client, (channel, value) => {
        mainWindow?.webContents.send(channel, value)
        // Who is online decides which pair channels stay open.
        if (channel === 'friends:online') {
          void pairs?.setOnline(value as string[]).catch((e) => console.warn('[listen] reconcile failed:', e))
        }
      })
    : null
  const cache = new CacheStore(join(userData, 'social-cache.json'))

  /** Pushes, then pulls the account's library; a change reloads the renderer's copy. Never throws. */
  const pullLibrary = async (): Promise<void> => {
    const engine = host.services.engine
    // The engine itself checks that its owner is still the signed-in account.
    if (!engine) return
    try {
      if (await engine.pull()) mainWindow?.webContents.send('library:changed')
    } catch (e) {
      console.warn('[sync] pull failed, will retry:', e)
    }
  }
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
    host,
    source,
    coverData: createCoverFetcher(),
    systemVolume: createSystemVolume(),
    proxyPort: () => proxyPort,
    remote,
    pairs,
    presence,
    cache,
    openExternal: (url) => void shell.openExternal(url).catch((e) => console.warn('[openExternal]', e)),
    notifyAccountChanged: () => mainWindow?.webContents.send('account:changed'),
    pullLibrary,
    lastError,
    settings,
    setNotchEnabled: showNotch,
    updater
  })
  for (const name of CHANNELS) {
    ipcMain.handle(name, (_e, ...args) =>
      (handlers[name] as (...a: unknown[]) => unknown)(...args)
    )
  }
  if (remote) {
    let tick = 0
    setInterval(async () => {
      try {
        if (!(await remote.session())) return
        const n = tick++
        // Read the engine each time: the host rebuilds it when another account's library opens.
        const engine = host.services.engine
        if (engine) {
          const r = await engine.flush()
          // A flush that ran against a library that has since closed says nothing about the open one.
          if (host.services.engine === engine && !r.skipped) lastError.value = r.error
        }
        if (n % PULL_EVERY_TICKS === PULL_EVERY_TICKS - 1) await pullLibrary()
        // Every minute: refresh friends. listFriends hands them to presence and to the pair hub,
        // which closes the channel of any friend who may no longer listen with us.
        if (n % 4 === 0) {
          const friends = await handlers.listFriends().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e))))
          if (friends instanceof Error && friends.message.includes('phinas:account_disabled')) {
            // A disabled account may not listen together or show as online.
            await pairs?.close()
            await presence?.close()
          }
        }
      } catch (e) {
        console.warn('[sync] tick failed:', e)
      }
    }, SYNC_INTERVAL_MS)
  }
  ipcMain.on('listen:send', (_e, friendId: unknown, msg: unknown) => {
    const m = parseMessage(msg)
    if (typeof friendId === 'string' && m) pairs?.send(friendId, m)
  })
  // An invite only shows inside the app, so without this a friend in another app never sees it.
  ipcMain.on('listen:invited', (_e, name: unknown) => {
    const win = mainWindow
    if (!win || win.isFocused()) return
    const who = typeof name === 'string' && name.trim() ? name.trim() : 'Teman'
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'Dengar bareng', body: `${who} mengajak kamu dengar bareng.` })
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
  // At start, signed in: bring in what changed on other computers.
  void pullLibrary()
  // The notch sits on the display that shows Phinas, so it follows the window to another monitor.
  mainWindow.on('moved', () => notch?.reposition())
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
