import { describe, expect, it } from 'vitest'
import { DEFAULT_EFFECTS, EQ_ORDER, EQ_PRESETS, outputTrim, parseEffects } from '../src/renderer/src/audio/presets'

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

describe('presets are strong enough to hear', () => {
  it('each non-flat preset moves its band by at least 5 dB', () => {
    expect(EQ_PRESETS.bass.bands.low).toBeGreaterThanOrEqual(5)
    expect(EQ_PRESETS.vocal.bands.mid).toBeGreaterThanOrEqual(5)
    expect(EQ_PRESETS.treble.bands.high).toBeGreaterThanOrEqual(5)
  })
})

describe('outputTrim', () => {
  it('leaves the level alone without the leveler, whatever the equalizer does', () => {
    for (const eq of EQ_ORDER) expect(outputTrim({ eq, leveler: false })).toBe(1)
  })
  it('takes 3 dB off with the leveler on, to cancel the compressor make-up gain', () => {
    expect(outputTrim({ eq: 'flat', leveler: true })).toBeCloseTo(0.708, 2)
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
