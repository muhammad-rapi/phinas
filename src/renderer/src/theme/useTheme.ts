import { useEffect, useState } from 'react'
import { accentVars, dominantColor } from './color'

export type ThemeName = 'dynamic' | 'dark' | 'light'
const STORAGE_KEY = 'phinas.theme'

function readStored(): ThemeName {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dynamic' || v === 'dark' || v === 'light') return v
  } catch {
    /* storage unavailable */
  }
  return 'dynamic'
}

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

/**
 * Applies the theme to <html>. In Dynamic mode the accent colors follow the cover art
 * (given as a data URL). Returns the active theme and whether the ambient cover
 * background should show.
 */
export function useTheme(
  coverData: string | null,
  /** A mood's colours, which win over the theme's accent while set. */
  mood: { accent: string; accentText: string; gradTop: string } | null = null
): {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
} {
  const [theme, setThemeState] = useState<ThemeName>(readStored)

  const setTheme = (t: ThemeName): void => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const root = document.documentElement
    // Dynamic uses the dark base; light/dark are fixed.
    root.dataset.theme = theme === 'light' ? 'light' : 'dark'
    root.dataset.mode = theme
    const reset = (): void => {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-text')
      root.style.removeProperty('--grad-top')
    }
    if (mood) {
      root.style.setProperty('--accent', mood.accent)
      // On the light theme the lighter text tone would be too faint: use the accent itself.
      root.style.setProperty('--accent-text', theme === 'light' ? mood.accent : mood.accentText)
      if (theme === 'light') root.style.removeProperty('--grad-top')
      else root.style.setProperty('--grad-top', mood.gradTop)
      return
    }
    if (theme !== 'dynamic' || !coverData) {
      reset()
      return
    }
    let cancelled = false
    pixelsOf(coverData)
      .then((px) => {
        if (cancelled) return
        const vars = accentVars(dominantColor(px))
        root.style.setProperty('--accent', vars.accent)
        root.style.setProperty('--accent-text', vars.accentText)
        root.style.setProperty('--grad-top', vars.gradTop)
      })
      .catch((e) => {
        console.warn('[theme] could not read cover colors, using default accent:', e)
        if (!cancelled) reset()
      })
    return () => {
      cancelled = true
    }
  }, [theme, coverData, mood])

  return { theme, setTheme }
}
