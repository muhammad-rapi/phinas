import type { UpdateStatus } from '../shared/types'

const REPO = 'muhammad-rapi/phinas'
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`
/** First check shortly after start (not during it), then a few times a day. */
const FIRST_CHECK_MS = 15_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

interface ReleaseAsset {
  name: string
  browser_download_url: string
}
export interface Release {
  tag_name: string
  html_url: string
  assets: ReleaseAsset[]
}

const parts = (v: string): number[] =>
  v
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0)

/** True when `latest` is a higher version than `current` ("v0.4.0" > "0.3.0"). Pre-release tags are ignored. */
export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** The installer for this platform: the .dmg on a Mac, the setup .exe on Windows. */
export function pickAsset(assets: ReleaseAsset[], platform: string, arch: string): ReleaseAsset | undefined {
  if (platform === 'darwin') {
    const dmgs = assets.filter((a) => a.name.endsWith('.dmg'))
    return dmgs.find((a) => a.name.includes(arch)) ?? dmgs[0]
  }
  if (platform === 'win32') return assets.find((a) => /setup.*\.exe$/i.test(a.name)) ?? assets.find((a) => a.name.endsWith('.exe'))
  return undefined
}

/** The part of electron-updater we use (Windows only). */
export interface AutoInstaller {
  /** Downloads the update; resolves once it is ready to install. Reports progress 0-100. */
  download(onProgress: (pct: number) => void): Promise<void>
  install(): void
}

export interface UpdaterDeps {
  currentVersion: string
  platform: string
  arch: string
  fetchRelease: () => Promise<Release>
  /** Present on Windows builds: installs in place. Elsewhere the user downloads the installer. */
  autoInstaller?: () => Promise<AutoInstaller>
  openExternal: (url: string) => void
  send: (status: UpdateStatus) => void
}

export interface Updater {
  status(): UpdateStatus
  check(): Promise<UpdateStatus>
  install(): void
  /** Checks on a schedule. Returns a stop function. */
  start(): () => void
}

export function createUpdater(d: UpdaterDeps): Updater {
  let status: UpdateStatus = { state: 'idle', current: d.currentVersion }
  let installer: AutoInstaller | null = null
  let checking: Promise<UpdateStatus> | null = null

  const set = (s: Partial<UpdateStatus>): UpdateStatus => {
    status = { ...status, ...s }
    d.send(status)
    return status
  }

  const run = async (): Promise<UpdateStatus> => {
    // A download in progress or waiting to install is not interrupted by another check.
    if (status.state === 'downloading' || status.state === 'ready') return status
    let release: Release
    try {
      release = await d.fetchRelease()
    } catch {
      // Offline or rate-limited: try again next time, without bothering the user.
      return status
    }
    if (!isNewer(release.tag_name, d.currentVersion)) return set({ state: 'idle', latest: release.tag_name.replace(/^v/, '') })
    const latest = release.tag_name.replace(/^v/, '')
    const url = pickAsset(release.assets, d.platform, d.arch)?.browser_download_url ?? release.html_url
    if (!d.autoInstaller) return set({ state: 'available', latest, url })
    try {
      installer = await d.autoInstaller()
      set({ state: 'downloading', latest, url, progress: 0 })
      await installer.download((pct) => set({ progress: Math.round(pct) }))
      return set({ state: 'ready' })
    } catch (e) {
      console.warn('[update] automatic download failed, offering the installer instead:', e)
      installer = null
      return set({ state: 'available', latest, url, progress: undefined })
    }
  }

  const check = (): Promise<UpdateStatus> => {
    checking ??= run().finally(() => {
      checking = null
    })
    return checking
  }

  return {
    status: () => status,
    check,
    install: () => {
      if (status.state === 'ready' && installer) installer.install()
      else if (status.url) d.openExternal(status.url)
    },
    start: () => {
      const first = setTimeout(() => void check(), FIRST_CHECK_MS)
      const every = setInterval(() => void check(), CHECK_EVERY_MS)
      return () => {
        clearTimeout(first)
        clearInterval(every)
      }
    }
  }
}

/**
 * The release a "latest" page redirect points at, without the API. Asset names follow the
 * electron-builder config (Phinas-<v>-arm64.dmg, Phinas-Setup-<v>.exe).
 */
export function releaseFromTag(tag: string): Release {
  const v = tag.replace(/^v/, '')
  const base = `https://github.com/${REPO}/releases/download/${tag}`
  return {
    tag_name: tag,
    html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
    assets: [`Phinas-${v}-arm64.dmg`, `Phinas-Setup-${v}.exe`].map((name) => ({ name, browser_download_url: `${base}/${name}` }))
  }
}

/**
 * GitHub's latest release (public, no token, no user data sent). The API allows only 60 calls an
 * hour per IP, which a shared network can use up; then the releases page redirect is used instead.
 */
export async function fetchLatestRelease(): Promise<Release> {
  const headers = { 'User-Agent': 'Phinas-Updater' }
  try {
    const res = await fetch(LATEST_URL, { headers: { ...headers, Accept: 'application/vnd.github+json' } })
    if (res.ok) return (await res.json()) as Release
  } catch {
    /* fall through to the page redirect */
  }
  const page = await fetch(`https://github.com/${REPO}/releases/latest`, { headers, redirect: 'manual' })
  const tag = page.headers.get('location')?.match(/\/releases\/tag\/([^/?#]+)/)?.[1]
  if (!tag) throw new Error(`no latest release (${page.status})`)
  return releaseFromTag(decodeURIComponent(tag))
}

/** electron-updater, loaded only where it is used (Windows): it downloads and runs the new installer. */
export async function electronAutoInstaller(): Promise<AutoInstaller> {
  const mod = (await import('electron-updater')) as unknown as {
    autoUpdater?: import('electron-updater').AppUpdater
    default?: { autoUpdater: import('electron-updater').AppUpdater }
  }
  const updater = mod.autoUpdater ?? mod.default!.autoUpdater
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true
  return {
    download: async (onProgress) => {
      const onProg = (p: { percent: number }): void => onProgress(p.percent)
      updater.on('download-progress', onProg)
      try {
        const found = await updater.checkForUpdates()
        if (!found?.isUpdateAvailable) throw new Error('no update in latest.yml')
        await updater.downloadUpdate()
      } finally {
        updater.off('download-progress', onProg)
      }
    },
    install: () => updater.quitAndInstall()
  }
}
