/** The equalizer is three bands: low shelf, mid peak and high shelf. Gains are in dB. */
export type EqPreset = 'flat' | 'bass' | 'vocal' | 'treble'

export interface Bands {
  low: number
  mid: number
  high: number
}

export const EQ_PRESETS: Record<EqPreset, { label: string; hint: string; bands: Bands }> = {
  flat: { label: 'Datar', hint: 'Suara apa adanya', bands: { low: 0, mid: 0, high: 0 } },
  bass: { label: 'Bass', hint: 'Dentum lebih tebal', bands: { low: 9, mid: -1, high: 1 } },
  vocal: { label: 'Vokal', hint: 'Suara penyanyi lebih jelas', bands: { low: -3, mid: 5, high: 2 } },
  treble: { label: 'Treble', hint: 'Suara lebih terang', bands: { low: -2, mid: 0, high: 8 } }
}

export const EQ_ORDER: EqPreset[] = ['flat', 'bass', 'vocal', 'treble']

export interface Effects {
  eq: EqPreset
  /** Evens out loud and quiet parts (a compressor). */
  leveler: boolean
}

/**
 * The level (a linear gain) applied after the leveler. The compressor adds make-up gain of its own, so
 * with the leveler on the signal is brought back down 3 dB, between what two measurements asked for:
 * a loud/quiet noise test (4.5 dB too quiet at -4.5) and a loud song (2.5 dB too loud at -2).
 * Otherwise it is left alone.
 * Boosted equalizer bands are NOT turned down: a limiter at the end of the chain (see fx.ts) catches
 * the peaks instead, so a boost is heard as a boost.
 */
export function outputTrim(e: Effects): number {
  return e.leveler ? Math.pow(10, -3 / 20) : 1
}

export const DEFAULT_EFFECTS: Effects = { eq: 'flat', leveler: false }

export const isPreset = (v: unknown): v is EqPreset => typeof v === 'string' && v in EQ_PRESETS

/** Reads saved effects, ignoring anything that is not a known value. */
export function parseEffects(raw: string | null): Effects {
  try {
    const v = JSON.parse(raw ?? '{}') as Partial<Effects>
    return { eq: isPreset(v.eq) ? v.eq : DEFAULT_EFFECTS.eq, leveler: v.leveler === true }
  } catch {
    return { ...DEFAULT_EFFECTS }
  }
}
