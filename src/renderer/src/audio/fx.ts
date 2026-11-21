import { DEFAULT_EFFECTS, EQ_PRESETS, headroom, parseEffects, type Effects } from './presets'

const KEY = 'phinas.effects'
type Listener = (e: Effects) => void

let current: Effects = DEFAULT_EFFECTS
const listeners = new Set<Listener>()

try {
  current = parseEffects(localStorage.getItem(KEY))
} catch {
  /* no storage: defaults */
}

export const getEffects = (): Effects => current

export function setEffects(next: Effects): void {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* kept for this session only */
  }
  listeners.forEach((l) => l(next))
}

export function onEffects(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * Routes the player's <audio> through the equalizer and the leveler:
 * audio → low shelf → mid peak → high shelf → compressor → headroom → speakers.
 * Flat and "off" are transparent, so the graph is always connected. If the browser refuses (no
 * Web Audio), the audio plays untouched.
 */
export function attachEffects(audio: HTMLMediaElement): { resume: () => void; analyser: AnalyserNode | null } | null {
  try {
    const ctx = new AudioContext()
    const src = ctx.createMediaElementSource(audio)
    const low = ctx.createBiquadFilter()
    low.type = 'lowshelf'
    low.frequency.value = 120
    const mid = ctx.createBiquadFilter()
    mid.type = 'peaking'
    mid.frequency.value = 1000
    mid.Q.value = 0.9
    const high = ctx.createBiquadFilter()
    high.type = 'highshelf'
    high.frequency.value = 8000
    const comp = ctx.createDynamicsCompressor()
    const trim = ctx.createGain()
    const analyser = ctx.createAnalyser()
    src.connect(low).connect(mid).connect(high).connect(comp).connect(trim).connect(ctx.destination)
    trim.connect(analyser)

    const apply = (e: Effects): void => {
      const b = EQ_PRESETS[e.eq].bands
      const t = ctx.currentTime
      low.gain.setTargetAtTime(b.low, t, 0.05)
      mid.gain.setTargetAtTime(b.mid, t, 0.05)
      high.gain.setTargetAtTime(b.high, t, 0.05)
      // Off = ratio 1 (does nothing); on = a gentle 3:1 over -26 dB.
      trim.gain.setTargetAtTime(headroom(e), t, 0.05)
      comp.threshold.setTargetAtTime(e.leveler ? -26 : 0, t, 0.05)
      comp.ratio.setTargetAtTime(e.leveler ? 3 : 1, t, 0.05)
      comp.knee.value = 24
      comp.attack.value = 0.01
      comp.release.value = 0.25
    }
    apply(current)
    onEffects(apply)
    return { resume: () => void (ctx.state === 'suspended' && ctx.resume()), analyser }
  } catch (e) {
    console.warn('[audio] effects unavailable:', e)
    return null
  }
}
