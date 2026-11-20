import { describe, expect, test, vi } from 'vitest'
import { createUpdater, isNewer, pickAsset, releaseFromTag, type Release } from '../src/main/updater'
import type { UpdateStatus } from '../src/shared/types'

describe('isNewer', () => {
  test('compares numerically, with or without a v', () => {
    expect(isNewer('v0.4.0', '0.3.0')).toBe(true)
    expect(isNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isNewer('v0.3.0', '0.3.0')).toBe(false)
    expect(isNewer('0.2.9', '0.3.0')).toBe(false)
    expect(isNewer('1.0', '0.9.9')).toBe(true)
  })
  test('ignores pre-release suffixes', () => {
    expect(isNewer('v0.3.0-beta', '0.3.0')).toBe(false)
  })
})

const assets = [
  { name: 'Phinas-0.4.0-arm64.dmg', browser_download_url: 'https://x/mac-arm.dmg' },
  { name: 'Phinas-0.4.0-x64.dmg', browser_download_url: 'https://x/mac-x64.dmg' },
  { name: 'Phinas-Setup-0.4.0.exe', browser_download_url: 'https://x/setup.exe' },
  { name: 'Phinas-Setup-0.4.0.exe.blockmap', browser_download_url: 'https://x/setup.exe.blockmap' },
  { name: 'latest.yml', browser_download_url: 'https://x/latest.yml' }
]

describe('pickAsset', () => {
  test('mac: the dmg for this architecture', () => {
    expect(pickAsset(assets, 'darwin', 'x64')?.browser_download_url).toBe('https://x/mac-x64.dmg')
    expect(pickAsset(assets, 'darwin', 'arm64')?.browser_download_url).toBe('https://x/mac-arm.dmg')
  })
  test('windows: the setup exe, not its blockmap', () => {
    expect(pickAsset(assets, 'win32', 'x64')?.browser_download_url).toBe('https://x/setup.exe')
  })
})

const release = (tag: string): Release => ({ tag_name: tag, html_url: 'https://x/release', assets })

function setup(tag: string, extra: Partial<Parameters<typeof createUpdater>[0]> = {}) {
  const sent: UpdateStatus[] = []
  const openExternal = vi.fn()
  const u = createUpdater({
    currentVersion: '0.3.0',
    platform: 'darwin',
    arch: 'arm64',
    fetchRelease: async () => release(tag),
    openExternal,
    send: (s) => sent.push(s),
    ...extra
  })
  return { u, sent, openExternal }
}

describe('createUpdater', () => {
  test('up to date: stays idle', async () => {
    const { u } = setup('v0.3.0')
    expect((await u.check()).state).toBe('idle')
  })

  test('mac: a newer version is offered as its dmg download', async () => {
    const { u, openExternal } = setup('v0.4.0')
    const s = await u.check()
    expect(s).toMatchObject({ state: 'available', latest: '0.4.0', url: 'https://x/mac-arm.dmg' })
    u.install()
    expect(openExternal).toHaveBeenCalledWith('https://x/mac-arm.dmg')
  })

  test('offline: no error shown, status unchanged', async () => {
    const { u, sent } = setup('v0.4.0', { fetchRelease: async () => Promise.reject(new Error('offline')) })
    expect((await u.check()).state).toBe('idle')
    expect(sent).toHaveLength(0)
  })

  test('windows: downloads in the background, then installs on request', async () => {
    const install = vi.fn()
    const { u, sent } = setup('v0.4.0', {
      platform: 'win32',
      autoInstaller: async () => ({
        download: async (onProgress) => onProgress(50),
        install
      })
    })
    const s = await u.check()
    expect(s.state).toBe('ready')
    expect(sent.map((x) => x.state)).toEqual(['downloading', 'downloading', 'ready'])
    expect(sent[1].progress).toBe(50)
    u.install()
    expect(install).toHaveBeenCalled()
  })

  test('windows: a failed download falls back to the installer link', async () => {
    const { u } = setup('v0.4.0', {
      platform: 'win32',
      autoInstaller: async () => ({ download: async () => Promise.reject(new Error('no latest.yml')), install: vi.fn() })
    })
    expect(await u.check()).toMatchObject({ state: 'available', url: 'https://x/setup.exe' })
  })

  test('checks running at the same time share one request', async () => {
    const fetchRelease = vi.fn(async () => release('v0.3.0'))
    const { u } = setup('v0.3.0', { fetchRelease })
    await Promise.all([u.check(), u.check()])
    expect(fetchRelease).toHaveBeenCalledTimes(1)
  })
})

describe('releaseFromTag (when the API is rate-limited)', () => {
  test('builds the installer links from the tag', () => {
    const r = releaseFromTag('v0.4.0')
    expect(pickAsset(r.assets, 'darwin', 'arm64')?.browser_download_url).toBe(
      'https://github.com/muhammad-rapi/phinas/releases/download/v0.4.0/Phinas-0.4.0-arm64.dmg'
    )
    expect(pickAsset(r.assets, 'win32', 'x64')?.browser_download_url).toBe(
      'https://github.com/muhammad-rapi/phinas/releases/download/v0.4.0/Phinas-Setup-0.4.0.exe'
    )
  })
})
