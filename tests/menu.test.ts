import { describe, expect, test } from 'vitest'
import { menuKey, menuTarget } from '../src/renderer/src/components/useMenu'
import { clearPlaylists, rememberPlaylist, rememberedPlaylist } from '../src/renderer/src/social/playlistCache'
import type { PartnerPlaylist } from '../src/shared/types'

describe('menuKey', () => {
  test('maps keys to actions', () => {
    expect(menuKey('Escape')).toBe('close')
    expect(menuKey('ArrowDown')).toBe('next')
    expect(menuKey('ArrowUp')).toBe('prev')
    expect(menuKey('Home')).toBe('first')
    expect(menuKey('End')).toBe('last')
    expect(menuKey('a')).toBeNull()
  })
})

describe('menuTarget', () => {
  test('wraps around', () => {
    expect(menuTarget('next', 2, 3)).toBe(0)
    expect(menuTarget('prev', 0, 3)).toBe(2)
    expect(menuTarget('next', -1, 3)).toBe(0)
    expect(menuTarget('prev', -1, 3)).toBe(2)
    expect(menuTarget('first', 1, 3)).toBe(0)
    expect(menuTarget('last', 0, 3)).toBe(2)
  })
  test('nothing to focus', () => {
    expect(menuTarget('next', -1, 0)).toBe(-1)
  })
})

describe('playlistCache', () => {
  test('clearPlaylists forgets remembered playlists', () => {
    rememberPlaylist({ id: 'p1' } as PartnerPlaylist)
    expect(rememberedPlaylist('p1')).toBeDefined()
    clearPlaylists()
    expect(rememberedPlaylist('p1')).toBeUndefined()
  })
})
