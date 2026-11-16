import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Track } from '../../../shared/types'
import { current, empty, enqueue, jumpTo, next, prev, startQueue, type QueueState } from './queue'

interface PlayerApi {
  queue: QueueState
  track: Track | null
  playing: boolean
  time: number
  duration: number
  volume: number
  notice: string | null
  play(tracks: Track[], index: number): void
  addToQueue(track: Track): void
  toggle(): void
  next(): void
  prev(): void
  jump(index: number): void
  seek(sec: number): void
  setVolume(v: number): void
  dismissNotice(): void
}

const Ctx = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlayer must be used inside PlayerProvider')
  return v
}

export function PlayerProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [audio] = useState(() => new Audio())
  const [queue, setQueue] = useState<QueueState>(empty)
  const [token, setToken] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [notice, setNotice] = useState<string | null>(null)

  const track = current(queue)

  const advance = useCallback(() => {
    setQueue((q) => {
      const n = next(q)
      if (!n) {
        audio.pause()
        return q
      }
      return n
    })
  }, [audio])

  useEffect(() => {
    audio.volume = volume
  }, [audio, volume])

  useEffect(() => {
    const on = <K extends keyof HTMLMediaElementEventMap>(e: K, fn: () => void): (() => void) => {
      audio.addEventListener(e, fn)
      return () => audio.removeEventListener(e, fn)
    }
    const offs = [
      on('timeupdate', () => setTime(audio.currentTime)),
      on('durationchange', () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)),
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('ended', advance)
    ]
    return () => offs.forEach((off) => off())
  }, [audio, advance])

  // Load and start whenever the current track (or a replay request) changes.
  useEffect(() => {
    if (!track) return
    let cancelled = false
    const skip = (): void => {
      if (cancelled) return
      setNotice(`Tidak bisa memutar "${track.title}", dilewati.`)
      advance()
    }
    window.phinas
      .streamUrl(track.videoId)
      .then((url) => {
        if (cancelled) return
        audio.src = url
        audio.onerror = skip
        return audio.play()
      })
      .catch(skip)
    return () => {
      cancelled = true
      audio.onerror = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.videoId, queue.index, token])

  const api = useMemo<PlayerApi>(
    () => ({
      queue,
      track,
      playing,
      time,
      duration,
      volume,
      notice,
      play: (tracks, index) => {
        setQueue(startQueue(tracks, index))
        setToken((t) => t + 1)
      },
      addToQueue: (t) => setQueue((q) => (q.tracks.length ? enqueue(q, t) : startQueue([t], 0))),
      toggle: () => {
        if (!audio.src) return
        if (audio.paused) void audio.play()
        else audio.pause()
      },
      next: () => advance(),
      prev: () => {
        if (audio.currentTime > 3) audio.currentTime = 0
        else setQueue((q) => prev(q))
      },
      jump: (i) => setQueue((q) => jumpTo(q, i)),
      seek: (s) => {
        audio.currentTime = s
      },
      setVolume: setVolumeState,
      dismissNotice: () => setNotice(null)
    }),
    [queue, track, playing, time, duration, volume, notice, audio, advance]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
