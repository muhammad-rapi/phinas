import { useEffect, useState } from 'react'
import type { Track } from '../../../shared/types'

/**
 * Cover art of a track as a same-origin data URL (fetched by the main process).
 * Used for the ambient background and for reading the Dynamic theme colors.
 */
export function useCover(track: Track | null): string | null {
  const [data, setData] = useState<string | null>(null)
  const url = track?.coverUrl

  useEffect(() => {
    if (!url) {
      setData(null)
      return
    }
    let cancelled = false
    window.phinas
      .coverData(url)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        console.warn('[cover] could not load cover art:', e)
        if (!cancelled) setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return data
}
