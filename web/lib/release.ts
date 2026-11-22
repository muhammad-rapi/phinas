import { REPO } from './site'

export interface Download {
  name: string
  url: string
  /** Size in whole megabytes. */
  mb: number
  /** SHA-256 hex, when GitHub reports it. */
  sha256: string | null
}

export interface Release {
  version: string
  publishedAt: string
  mac: Download | null
  win: Download | null
}

interface GhAsset {
  name: string
  size: number
  browser_download_url: string
  digest?: string | null
}

interface GhRelease {
  tag_name: string
  published_at: string
  assets: GhAsset[]
}

const MAC = /^Phinas-[\d.]+-arm64\.dmg$/
const WIN = /^Phinas-Setup-[\d.]+\.exe$/
const APK = /^Phinas-[\d.]+\.apk$/

function toDownload(a: GhAsset | undefined): Download | null {
  if (!a) return null
  const sha = a.digest?.startsWith('sha256:') ? a.digest.slice(7) : null
  return { name: a.name, url: a.browser_download_url, mb: Math.round(a.size / 1024 / 1024), sha256: sha }
}

/** Picks the Mac and Windows installers out of a GitHub release (ignores blockmaps and latest.yml). */
export function pickRelease(r: GhRelease): Release {
  return {
    version: r.tag_name.replace(/^v/, ''),
    publishedAt: r.published_at,
    mac: toDownload(r.assets.find((a) => MAC.test(a.name))),
    win: toDownload(r.assets.find((a) => WIN.test(a.name)))
  }
}

/** The latest release, or null when GitHub cannot be reached. Cached for 10 minutes. */
export async function latestRelease(): Promise<Release | null> {
  try {
    const token = process.env['GITHUB_TOKEN']
    // The query only names the cache entry: bump it to drop a stale cached answer (it survives redeploys).
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest?cache=2`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      next: { revalidate: 600 }
    })
    if (!res.ok) return null
    return pickRelease((await res.json()) as GhRelease)
  } catch {
    return null
  }
}

export interface AndroidRelease {
  version: string
  apk: Download
}

/** The newest Android release (tag android-v*) that carries an APK, out of a list of GitHub releases. */
export function pickAndroid(list: GhRelease[]): AndroidRelease | null {
  for (const r of list) {
    if (!r.tag_name.startsWith('android-v')) continue
    const apk = toDownload(r.assets.find((a) => APK.test(a.name)))
    if (apk) return { version: r.tag_name.replace(/^android-v/, ''), apk }
  }
  return null
}

/** The latest Android build, or null when GitHub cannot be reached. Cached for 10 minutes. */
export async function latestAndroid(): Promise<AndroidRelease | null> {
  try {
    const token = process.env['GITHUB_TOKEN']
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      next: { revalidate: 600 }
    })
    if (!res.ok) return null
    return pickAndroid((await res.json()) as GhRelease[])
  } catch {
    return null
  }
}
