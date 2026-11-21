/** The equalizer is three bands: low shelf, mid peak and high shelf. Gains are in dB. */
export type EqPreset = 'flat' | 'bass' | 'vocal' | 'treble'

export interface Bands {
  low: number
  mid: number
  high: number
}

export const EQ_PRESETS: Record<EqPreset, { label: string; hint: string; bands: Bands }> = {
  flat: { label: 'Datar', hint: 'Suara apa adanya', bands: { low: 0, mid: 0, high: 0 } },
  bass: { label: 'Bass', hint: 'Dentum lebih tebal', bands: { low: 6, mid: -1, high: 1 } },
  vocal: { label: 'Vokal', hint: 'Suara penyanyi lebih jelas', bands: { low: -2, mid: 4, high: 2 } },
  treble: { label: 'Treble', hint: 'Suara lebih terang', bands: { low: -2, mid: 0, high: 6 } }
}

export const EQ_ORDER: EqPreset[] = ['flat', 'bass', 'vocal', 'treble']

export interface Effects {
  eq: EqPreset
  /** Evens out loud and quiet parts (a compressor). */
  leveler: boolean
}

/**
 * How far to turn the whole signal down (a linear gain below 1) so that boosted bands cannot push
 * the sound past full scale and distort: the loudest boost is taken back off first. With the leveler
 * on, a further step takes off the make-up gain the compressor adds.
 */
export function headroom(e: Effects): number {
  const b = EQ_PRESETS[e.eq].bands
  const boost = Math.max(0, b.low, b.mid, b.high)
  const db = -boost - (e.leveler ? 4 : 0)
  return Math.pow(10, db / 20)
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
