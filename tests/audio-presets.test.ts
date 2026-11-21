import { describe, expect, it } from 'vitest'
import { DEFAULT_EFFECTS, EQ_ORDER, EQ_PRESETS, headroom, parseEffects } from '../src/renderer/src/audio/presets'

describe('equalizer presets', () => {
  it('lists every preset once, flat first', () => {
    expect(EQ_ORDER[0]).toBe('flat')
    expect(new Set(EQ_ORDER).size).toBe(Object.keys(EQ_PRESETS).length)
  })
  it('flat changes nothing and no band goes past ±12 dB', () => {
    expect(EQ_PRESETS.flat.bands).toEqual({ low: 0, mid: 0, high: 0 })
    for (const p of Object.values(EQ_PRESETS)) {
      for (const g of Object.values(p.bands)) expect(Math.abs(g)).toBeLessThanOrEqual(12)
    }
  })
})

describe('headroom', () => {
  it('is 1 (no change) for flat without the leveler', () => {
    expect(headroom(DEFAULT_EFFECTS)).toBe(1)
  })
  it('takes the loudest boost back off, so boosted bands cannot clip', () => {
    // Bass boosts the low band by 6 dB: the whole signal goes down by 6 dB (a factor of about 0.5).
    expect(headroom({ eq: 'bass', leveler: false })).toBeCloseTo(0.501, 2)
  })
  it('takes a further 4 dB off with the leveler on, and never raises the level', () => {
    expect(headroom({ eq: 'flat', leveler: true })).toBeCloseTo(0.631, 2)
    for (const eq of EQ_ORDER) for (const leveler of [false, true]) expect(headroom({ eq, leveler })).toBeLessThanOrEqual(1)
  })
})

describe('parseEffects', () => {
  it('reads saved values', () => {
    expect(parseEffects(JSON.stringify({ eq: 'bass', leveler: true }))).toEqual({ eq: 'bass', leveler: true })
  })
  it('falls back to defaults for nothing, junk or unknown values', () => {
    expect(parseEffects(null)).toEqual(DEFAULT_EFFECTS)
    expect(parseEffects('not json')).toEqual(DEFAULT_EFFECTS)
    expect(parseEffects(JSON.stringify({ eq: 'loud', leveler: 'yes' }))).toEqual(DEFAULT_EFFECTS)
  })
})
