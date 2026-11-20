import { readFileSync, writeFileSync } from 'node:fs'
import type { AppConfig, Friend, MyProfile } from '../../shared/types'

/** The last social data we saw, so the app can start and render offline. */
export interface SocialCache {
  profile?: MyProfile
  friends?: Friend[]
  config?: AppConfig
}

/** Tiny JSON file in the user data folder. A missing or broken file means an empty cache. */
export class CacheStore {
  private data: SocialCache

  constructor(private path: string) {
    try {
      this.data = JSON.parse(readFileSync(path, 'utf8')) as SocialCache
    } catch {
      this.data = {}
    }
  }

  get<K extends keyof SocialCache>(key: K): SocialCache[K] {
    return this.data[key]
  }

  set<K extends keyof SocialCache>(key: K, value: SocialCache[K]): void {
    this.data[key] = value
    this.save()
  }

  /** On sign-out or account deletion. */
  clear(): void {
    this.data = {}
    this.save()
  }

  private save(): void {
    try {
      writeFileSync(this.path, JSON.stringify(this.data))
    } catch (e) {
      console.error('social cache not saved:', e)
    }
  }
}

/**
 * Fetches and caches; on a network failure returns the cached value instead.
 * A `phinas:` error is a real answer from the server (e.g. account disabled), so it is never hidden.
 */
export async function withCache<K extends keyof SocialCache>(
  cache: CacheStore,
  key: K,
  fetch: () => Promise<NonNullable<SocialCache[K]>>
): Promise<NonNullable<SocialCache[K]>> {
  try {
    const v = await fetch()
    cache.set(key, v)
    return v
  } catch (e) {
    const cached = cache.get(key)
    if (cached === undefined || (e instanceof Error && e.message.includes('phinas:'))) throw e
    return cached as NonNullable<SocialCache[K]>
  }
}
