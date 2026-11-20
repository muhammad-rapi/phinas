import { describe, expect, test, vi } from 'vitest'
import { createSystemVolume, parseVolume } from '../src/main/system-volume'

describe('parseVolume', () => {
  test('parses a 0-100 integer into 0-1', () => {
    expect(parseVolume('55\n')).toBeCloseTo(0.55)
    expect(parseVolume('0')).toBe(0)
    expect(parseVolume('100')).toBe(1)
  })
  test('clamps and rejects garbage', () => {
    expect(parseVolume('150')).toBe(1)
    expect(parseVolume('-4')).toBe(0)
    expect(parseVolume('missing value')).toBeNull()
    expect(parseVolume('')).toBeNull()
  })
})

describe('createSystemVolume', () => {
  test('on macOS reads and writes through osascript', async () => {
    const run = vi.fn(async (_cmd: string, args: string[]) =>
      args.join(' ').includes('output volume of') ? '40\n' : ''
    )
    const sv = createSystemVolume('darwin', run)
    expect(sv.supported).toBe(true)
    expect(await sv.get()).toBeCloseTo(0.4)
    await sv.set(0.73)
    const last = run.mock.calls.at(-1)!
    expect(last[0]).toBe('osascript')
    expect(last[1].join(' ')).toContain('set volume output volume 73')
  })

  test('set clamps out-of-range values', async () => {
    const run = vi.fn(async (_cmd: string, _args: string[]) => '')
    const sv = createSystemVolume('darwin', run)
    await sv.set(2)
    await sv.set(-1)
    expect(run.mock.calls[0][1].join(' ')).toContain('output volume 100')
    expect(run.mock.calls[1][1].join(' ')).toContain('output volume 0')
  })

  test('on other platforms it reports unsupported and does nothing', async () => {
    const run = vi.fn(async () => '')
    const sv = createSystemVolume('win32', run)
    expect(sv.supported).toBe(false)
    expect(await sv.get()).toBeNull()
    await sv.set(0.5)
    expect(run).not.toHaveBeenCalled()
  })
})
