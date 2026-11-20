import { useEffect, useRef } from 'react'
import type { Track } from '../../../shared/types'

interface Controls {
  toggle(): void
  next(): void
  prev(): void
  seek(sec: number): void
}

/**
 * Tells the OS what is playing (macOS "Now Playing", Windows media overlay) and wires the
 * keyboard media keys and the system controls to the player.
 */
export function useMediaSession(audio: HTMLAudioElement, track: Track | null, playing: boolean, controls: Controls): void {
  const latest = useRef(controls)
  latest.current = controls

  // What is playing: title, artist and cover.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!track) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'Phinas',
      artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512' }] : []
    })
  }, [track])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = !track ? 'none' : playing ? 'playing' : 'paused'
  }, [track, playing])

  // Media keys and the controls in the system widget.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null): void => {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        /* this platform does not support the action */
      }
    }
    set('play', () => void audio.play())
    set('pause', () => audio.pause())
    set('previoustrack', () => latest.current.prev())
    set('nexttrack', () => latest.current.next())
    set('seekto', (d) => {
      if (typeof d.seekTime === 'number') latest.current.seek(d.seekTime)
    })
    set('seekbackward', (d) => latest.current.seek(Math.max(0, audio.currentTime - (d.seekOffset ?? 10))))
    set('seekforward', (d) => latest.current.seek(audio.currentTime + (d.seekOffset ?? 10)))
    return () => {
      for (const a of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'] as const) {
        set(a, null)
      }
    }
  }, [audio])

  // Position, so the system progress bar moves and can be dragged.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    let last = 0
    const update = (): void => {
      const now = Date.now()
      if (now - last < 1000) return
      last = now
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          position: Math.min(audio.currentTime, audio.duration),
          playbackRate: audio.playbackRate
        })
      } catch {
        /* position state is optional */
      }
    }
    audio.addEventListener('timeupdate', update)
    audio.addEventListener('durationchange', update)
    return () => {
      audio.removeEventListener('timeupdate', update)
      audio.removeEventListener('durationchange', update)
    }
  }, [audio])
}
