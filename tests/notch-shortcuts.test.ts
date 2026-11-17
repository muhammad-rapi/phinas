import { describe, expect, test } from 'vitest'
import { computeBounds, detectNotch, FLOAT_GAP } from '../src/main/notch/detect'
import { GLOBAL_SHORTCUTS, registerShortcuts } from '../src/main/shortcuts'
import { seekFromPointer } from '../src/renderer/src/notch/seek'
import { keyToCommand, type KeyLike } from '../src/renderer/src/player/keymap'
import type { PlayerCommand } from '../src/shared/types'

const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

describe('detectNotch', () => {
  test('mac with a tall menu bar has a notch', () => {
    const r = detectNotch('darwin', rect(0, 0, 1728, 1117), rect(0, 38, 1728, 1079))
    expect(r).toMatchObject({ hasNotch: true, barHeight: 38 })
    expect(r.notchWidth).toBeGreaterThan(0)
    expect(r.compact.w).toBeGreaterThan(r.notchWidth)
  })
  test('mac with a normal menu bar has none', () => {
    expect(detectNotch('darwin', rect(0, 0, 1920, 1080), rect(0, 25, 1920, 1055)).hasNotch).toBe(false)
  })
  test('windows never has a notch, even if the work area starts lower', () => {
    expect(detectNotch('win32', rect(0, 0, 1920, 1080), rect(0, 48, 1920, 1032)).hasNotch).toBe(false)
  })
})

describe('computeBounds', () => {
  const win = detectNotch('win32', rect(0, 0, 1920, 1080), rect(0, 0, 1920, 1040))
  const mac = detectNotch('darwin', rect(0, 0, 1728, 1117), rect(0, 38, 1728, 1079))

  test('windows: centred, a few px below the top edge, window fits pill plus margin', () => {
    const b = computeBounds('win32', rect(0, 0, 1920, 1080), rect(0, 0, 1920, 1040), win, false)
    expect(b.width).toBe(win.compact.w + win.pad * 2)
    expect(b.height).toBe(win.compact.h + win.pad)
    expect(b.x + b.width / 2).toBe(960)
    expect(b.y).toBe(FLOAT_GAP)
  })

  test('windows with the taskbar at the top: the pill starts below it', () => {
    const b = computeBounds('win32', rect(0, 0, 1920, 1080), rect(0, 48, 1920, 1032), win, false)
    expect(b.y).toBe(48 + FLOAT_GAP)
  })

  test('windows second monitor to the left (negative x) stays centred on it', () => {
    const b = computeBounds('win32', rect(-1920, 0, 1920, 1080), rect(-1920, 0, 1920, 1040), win, true)
    expect(b.x + b.width / 2).toBe(-960)
    expect(b.width).toBe(win.expanded.w + win.pad * 2)
  })

  test('mac with a notch sits flush against the top edge', () => {
    const b = computeBounds('darwin', rect(0, 0, 1728, 1117), rect(0, 38, 1728, 1079), mac, false)
    expect(b.y).toBe(0)
    expect(b.x + b.width / 2).toBe(864)
  })

  test('expanded is bigger than compact', () => {
    const c = computeBounds('win32', rect(0, 0, 1920, 1080), rect(0, 0, 1920, 1040), win, false)
    const e = computeBounds('win32', rect(0, 0, 1920, 1080), rect(0, 0, 1920, 1040), win, true)
    expect(e.width).toBeGreaterThan(c.width)
    expect(e.height).toBeGreaterThan(c.height)
  })
})

describe('registerShortcuts', () => {
  test('registers each global shortcut and sends its command', () => {
    const handlers = new Map<string, () => void>()
    const sent: PlayerCommand[] = []
    const done = registerShortcuts(
      { register: (a, cb) => (handlers.set(a, cb), true), unregisterAll: () => {} },
      (c) => sent.push(c)
    )
    expect(done).toHaveLength(GLOBAL_SHORTCUTS.length)
    handlers.get('CommandOrControl+Alt+Right')!()
    expect(sent).toEqual(['next'])
  })

  test('a taken or throwing key is skipped and logged, others still register', () => {
    const logs: string[] = []
    let n = 0
    const done = registerShortcuts(
      {
        register: () => {
          n++
          if (n === 1) return false
          if (n === 2) throw new Error('boom')
          return true
        },
        unregisterAll: () => {}
      },
      () => {},
      (m) => logs.push(m)
    )
    expect(done).toHaveLength(1)
    expect(logs).toHaveLength(2)
  })
})

const key = (k: string, o: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  code: k === ' ' ? 'Space' : `Key${k.toUpperCase()}`,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...o
})

describe('keyToCommand', () => {
  test.each([
    [key(' '), 'toggle'],
    [key('ArrowRight', { shiftKey: true }), 'next'],
    [key('ArrowLeft', { shiftKey: true }), 'prev'],
    [key('ArrowRight', { metaKey: true }), 'next'],
    [key('ArrowUp'), 'volumeUp'],
    [key('ArrowDown'), 'volumeDown'],
    [key('m'), 'mute'],
    [key('L'), 'like'],
    [key('s'), 'shuffle'],
    [key('r'), 'repeat'],
    [key('/'), 'focusSearch']
  ])('%o -> %s', (e, cmd) => expect(keyToCommand(e)).toBe(cmd))

  test('unmapped keys and alt combos do nothing', () => {
    expect(keyToCommand(key('x'))).toBeNull()
    expect(keyToCommand(key('m', { altKey: true }))).toBeNull()
    expect(keyToCommand(key('m', { metaKey: true }))).toBeNull()
  })
})

describe('seekFromPointer', () => {
  test('maps the pointer position on the bar to seconds', () => {
    expect(seekFromPointer(150, 100, 200, 240)).toBe(60)
  })
  test('clamps outside the bar and ignores an unknown duration', () => {
    expect(seekFromPointer(0, 100, 200, 240)).toBe(0)
    expect(seekFromPointer(999, 100, 200, 240)).toBe(240)
    expect(seekFromPointer(150, 100, 200, 0)).toBe(0)
    expect(seekFromPointer(150, 100, 0, 240)).toBe(0)
  })
})
