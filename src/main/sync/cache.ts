import { readFileSync, writeFileSync } from 'node:fs'
import type { AppConfig, Friend, MyProfile } from '../../shared/types'

/** The last social data we saw, so the app can start and render offline. */
export interface SocialCache {
  /** The user id the cached values belong to. */
  owner?: string
  profile?: MyProfile
  friends?: Friend[]
  config?: AppConfig
}

/** Tiny JSON file in the user data folder. A missing or broken file means an empty cache. */
export class CacheStore {
  private data: SocialCache
  private gen = 0

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

  /** Bumped by every clear(), so a fetch that started before it can tell its result is stale. */
  get generation(): number {
    return this.gen
  }

  /** On sign-in, sign-out or account deletion. */
  clear(): void {
    this.gen++
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

type CachedKey = Exclude<keyof SocialCache, 'owner'>

/**
 * Fetches and caches for user `uid`; on any non-phinas failure (offline, expired token) returns
 * the cached value instead, but only when it belongs to the same user.
 * A `phinas:` error is a real answer from the server (e.g. account disabled), so it is never hidden.
 * A cache cleared while the fetch was in flight (sign-out, another sign-in) is not written to.
 */
export async function withCache<K extends CachedKey>(
  cache: CacheStore,
  uid: string,
  key: K,
  fetch: () => Promise<NonNullable<SocialCache[K]>>
): Promise<NonNullable<SocialCache[K]>> {
  const owner = cache.get('owner')
  if (owner !== undefined && owner !== uid) cache.clear()
  const gen = cache.generation
  try {
    const v = await fetch()
    if (cache.generation === gen) {
      if (cache.get('owner') !== uid) cache.set('owner', uid)
      cache.set(key, v)
    }
    return v
  } catch (e) {
    const cached = cache.get('owner') === uid ? cache.get(key) : undefined
    if (cached === undefined || (e instanceof Error && e.message.includes('phinas:'))) throw e
    return cached as NonNullable<SocialCache[K]>
  }
}
