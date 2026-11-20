import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { openDb } from '../src/main/library/db'
import { LibraryHost, planAccount, planGuest } from '../src/main/library/host'
import { Library } from '../src/main/library/library'
import { SettingsStore } from '../src/main/settings'

describe('claim rules', () => {
  test('an account with its own file opens it', () => {
    expect(planAccount({ accountDbExists: true, legacyDbExists: true, claimedBy: null })).toBe('open')
  })
  test('the first account to sign in claims the pre-account library', () => {
    expect(planAccount({ accountDbExists: false, legacyDbExists: true, claimedBy: null })).toBe('claim')
  })
  test('any later account starts empty', () => {
    expect(planAccount({ accountDbExists: false, legacyDbExists: true, claimedBy: 'u1' })).toBe('create')
    expect(planAccount({ accountDbExists: false, legacyDbExists: false, claimedBy: null })).toBe('create')
  })
  test('signed out uses the pre-account library until it is claimed', () => {
    expect(planGuest(null)).toBe('legacy')
    expect(planGuest('u1')).toBe('guest')
  })
})

describe('LibraryHost', () => {
  let dir: string
  let settings: SettingsStore
  let hosts: LibraryHost<number>[]
  let builds = 0

  const host = (userId: string | null, open?: (path: string) => Library): LibraryHost<number> => {
    const h = new LibraryHost({ dir, settings, userId, build: () => ++builds, open })
    hosts.push(h)
    return h
  }
  const names = (h: LibraryHost<number>): string[] => h.library.listPlaylists().map((p) => p.name).sort()
  const seedLegacy = (name: string): void => {
    const lib = new Library(openDb(join(dir, 'phinas.db')))
    lib.createPlaylist(name)
    lib.close()
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'phinas-host-'))
    settings = new SettingsStore(join(dir, 'settings.json'))
    hosts = []
    builds = 0
  })

  afterEach(() => {
    for (const h of hosts) {
      try {
        h.close()
      } catch {
        // already closed
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })

  test('the first sign-in claims the pre-account library', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    expect(h.useAccount('u1')).toBe(true)
    expect(names(h)).toEqual(['Lama'])
    expect(existsSync(join(dir, 'phinas.db'))).toBe(false)
    expect(existsSync(join(dir, 'libraries', 'u1.db'))).toBe(true)
    expect(settings.get('claimedBy')).toBe('u1')
    expect(h.userId).toBe('u1')
  })

  test('a second account starts empty, and each account keeps its own library', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    h.useAccount('u1')
    h.useAccount('u2')
    expect(names(h)).toEqual([])
    h.library.createPlaylist('Punya u2')
    h.useAccount('u1')
    expect(names(h)).toEqual(['Lama'])
    h.useAccount('u2')
    expect(names(h)).toEqual(['Punya u2'])
  })

  test('after a claim, signing out gives an empty guest library, emptied again on the next sign-out', () => {
    const h = host(null)
    h.library.createPlaylist('Lama')
    h.useAccount('u1')
    h.useGuest()
    expect(h.userId).toBeNull()
    expect(names(h)).toEqual([])
    h.library.createPlaylist('Tamu')
    h.useAccount('u1')
    h.useGuest()
    expect(names(h)).toEqual([])
  })

  test('without a claim, signing out returns to the pre-account library', () => {
    seedLegacy('Lama')
    mkdirSync(join(dir, 'libraries'))
    new Library(openDb(join(dir, 'libraries', 'u1.db'))).close()
    const h = host('u1')
    expect(names(h)).toEqual([])
    expect(settings.get('claimedBy')).toBeNull()
    h.useGuest()
    expect(names(h)).toEqual(['Lama'])
  })

  test('starting signed in claims the pre-account library too', () => {
    seedLegacy('Lama')
    const h = host('u1')
    expect(names(h)).toEqual(['Lama'])
    expect(settings.get('claimedBy')).toBe('u1')
  })

  test('a failed switch keeps the previous library and records why', () => {
    const open = (path: string): Library => {
      if (path.endsWith('u2.db')) throw new Error('disk full')
      return new Library(openDb(path))
    }
    const h = host('u1', open)
    h.library.createPlaylist('Punya u1')
    expect(h.useAccount('u2')).toBe(false)
    expect(h.error).toBe('disk full')
    expect(h.userId).toBe('u1')
    expect(names(h)).toEqual(['Punya u1'])
    expect(h.useGuest()).toBe(true)
    expect(h.error).toBeNull()
  })

  test('a user id that is not an id is refused', () => {
    const h = host(null)
    expect(h.useAccount('../escape')).toBe(false)
    expect(h.userId).toBeNull()
  })

  test('the services are rebuilt for every library that opens', () => {
    const h = host(null)
    expect(h.services).toBe(1)
    h.useAccount('u1')
    expect(h.services).toBe(2)
    h.useAccount('u1')
    expect(h.services).toBe(2)
  })
})
