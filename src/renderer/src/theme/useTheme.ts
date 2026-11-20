import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_ACCENT, dominantColor, paletteFor, parseHex, type Rgb } from './color'
import { DARK_QUERY, browserStorage, readMode, resolveMode, writeMode, type ResolvedTheme, type ThemeMode } from './mode'

async function pixelsOf(dataUrl: string): Promise<Uint8ClampedArray> {
  // A data URL is same-origin, so the canvas is never tainted.
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, 32, 32)
  return ctx.getImageData(0, 0, 32, 32).data
}

export interface Theme {
  /** What the user picked in Profil. */
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  /** What is shown: the picked mode, or the OS's when following the system. */
  resolved: ResolvedTheme
  /** The notch is a dark pill in both modes, so it always gets the Malam accent. */
  notch: { accent: string; onAccent: string }
}

/**
 * Applies the mode to <html data-theme> and writes --accent, --on-accent and --wash from the
 * cover's dominant colour, or from the mood's colour while a mood is set.
 */
export function useTheme(coverData: string | null, moodAccent: string | null): Theme {
  const [mode, setModeState] = useState<ThemeMode>(() => readMode(browserStorage()))
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  const [coverColor, setCoverColor] = useState<Rgb | null>(null)

  // Follow the OS live when it switches between light and dark.
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // The previous colour stays until the new cover is read, so the accent glides instead of blinking.
  useEffect(() => {
    if (!coverData) {
      setCoverColor(null)
      return
    }
    let cancelled = false
    pixelsOf(coverData)
      .then((px) => {
        if (cancelled) return
        const c = dominantColor(px)
        // A greyscale cover has no colour of its own: use the terracotta defaults.
        setCoverColor(c === DEFAULT_ACCENT ? null : c)
      })
      .catch((e) => {
        console.warn('[theme] could not read cover colors, using the default accent:', e)
        if (!cancelled) setCoverColor(null)
      })
    return () => {
      cancelled = true
    }
  }, [coverData])

  const resolved = resolveMode(mode, systemDark)
  const source = (moodAccent ? parseHex(moodAccent) : null) ?? coverColor
  const palette = useMemo(() => paletteFor(source, resolved), [source, resolved])
  const notch = useMemo(() => paletteFor(source, 'night'), [source])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.setProperty('--accent', palette.accent)
    root.style.setProperty('--on-accent', palette.onAccent)
    root.style.setProperty('--wash', palette.wash)
  }, [resolved, palette.accent, palette.onAccent, palette.wash])

  const setMode = (m: ThemeMode): void => {
    setModeState(m)
    writeMode(browserStorage(), m)
  }

  return { mode, setMode, resolved, notch: { accent: notch.accent, onAccent: notch.onAccent } }
}
