import { describe, expect, it } from 'vitest'
import { pickRelease } from './release'

const asset = (name: string, size = 100 * 1024 * 1024, digest?: string) => ({
  name,
  size,
  browser_download_url: `https://example.test/${name}`,
  digest
})

describe('pickRelease', () => {
  it('finds both installers and skips the update files', () => {
    const r = pickRelease({
      tag_name: 'v0.5.0',
      published_at: '2026-11-21T00:00:00Z',
      assets: [
        asset('Phinas-Setup-0.5.0.exe.blockmap'),
        asset('latest.yml'),
        asset('Phinas-Setup-0.5.0.exe', 80 * 1024 * 1024, 'sha256:abc'),
        asset('Phinas-0.5.0-arm64.dmg', 120.4 * 1024 * 1024)
      ]
    })
    expect(r.version).toBe('0.5.0')
    expect(r.win).toEqual({ name: 'Phinas-Setup-0.5.0.exe', url: 'https://example.test/Phinas-Setup-0.5.0.exe', mb: 80, sha256: 'abc' })
    expect(r.mac?.mb).toBe(120)
    expect(r.mac?.sha256).toBeNull()
  })

  it('leaves a missing platform empty', () => {
    const r = pickRelease({ tag_name: 'v1.0.0', published_at: '', assets: [asset('Phinas-1.0.0-arm64.dmg')] })
    expect(r.win).toBeNull()
    expect(r.mac).not.toBeNull()
  })
})
