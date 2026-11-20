import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { CacheStore, withCache } from '../src/main/sync/cache'
import type { AppConfig } from '../src/shared/types'

const config: AppConfig = { listenTogetherEnabled: true, registrationOpen: true, inviteQuota: 3 }
let path: string

beforeEach(() => {
  path = join(mkdtempSync(join(tmpdir(), 'phinas-cache-')), 'social-cache.json')
})

test('stores values on disk and reads them back in a new instance', () => {
  new CacheStore(path).set('config', config)
  expect(new CacheStore(path).get('config')).toEqual(config)
})

test('a broken file means an empty cache', () => {
  writeFileSync(path, '{not json')
  expect(new CacheStore(path).get('config')).toBeUndefined()
})

test('clear empties memory and disk', () => {
  const c = new CacheStore(path)
  c.set('config', config)
  c.clear()
  expect(c.get('config')).toBeUndefined()
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({})
})

test('withCache saves a fresh value', async () => {
  const c = new CacheStore(path)
  const v = await withCache(c, 'config', async () => config)
  expect(v).toEqual(config)
  expect(c.get('config')).toEqual(config)
})

test('withCache falls back to the cache when offline', async () => {
  const c = new CacheStore(path)
  c.set('config', config)
  const v = await withCache(c, 'config', async () => {
    throw new Error('fetch failed')
  })
  expect(v).toEqual(config)
})

test('withCache rethrows when nothing is cached', async () => {
  const c = new CacheStore(path)
  await expect(
    withCache(c, 'config', async () => {
      throw new Error('fetch failed')
    })
  ).rejects.toThrow('fetch failed')
})

test('withCache never hides a server refusal behind the cache', async () => {
  const c = new CacheStore(path)
  c.set('config', config)
  await expect(
    withCache(c, 'config', async () => {
      throw new Error('phinas:account_disabled')
    })
  ).rejects.toThrow('phinas:account_disabled')
})
