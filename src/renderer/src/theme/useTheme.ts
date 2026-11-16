import { useEffect, useState } from 'react'
import type { Track } from '../../../shared/types'
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

async function coverPixels(url: string): Promise<Uint8ClampedArray> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, 32, 32)
  return ctx.getImageData(0, 0, 32, 32).data
}

/** Applies the theme to <html>. In Dynamic mode, accent colors follow the current cover. */
export function useTheme(track: Track | null): { theme: ThemeName; setTheme: (t: ThemeName) => void } {
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
    if (theme !== 'dynamic') {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--grad-top')
      return
    }
    let cancelled = false
    const apply = (vars: { accent: string; gradTop: string }): void => {
      if (cancelled) return
      root.style.setProperty('--accent', vars.accent)
      root.style.setProperty('--grad-top', vars.gradTop)
    }
    if (!track?.coverUrl) {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--grad-top')
      return
    }
    coverPixels(track.coverUrl)
      .then((px) => apply(accentVars(dominantColor(px))))
      .catch(() => {
        // CORS or decode failure: fall back to the default accent.
        if (cancelled) return
        root.style.removeProperty('--accent')
        root.style.removeProperty('--grad-top')
      })
    return () => {
      cancelled = true
    }
  }, [theme, track?.coverUrl])

  return { theme, setTheme }
}
