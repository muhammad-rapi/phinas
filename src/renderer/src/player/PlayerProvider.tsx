import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Track } from '../../../shared/types'
import {
  current,
  empty,
  enqueue,
  jumpTo,
  next,
  prev,
  shuffleOff,
  shuffleOn,
  startQueue,
  type QueueState,
  type RepeatMode
} from './queue'
import { useMediaSession } from './useMediaSession'

interface PlayerApi {
  queue: QueueState
  track: Track | null
  playing: boolean
  time: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  notice: string | null
  play(tracks: Track[], index: number): void
  addToQueue(track: Track): void
  toggle(): void
  next(): void
  prev(): void
  jump(index: number): void
  seek(sec: number): void
  setVolume(v: number): void
  toggleShuffle(): void
  cycleRepeat(): void
  dismissNotice(): void
}

const Ctx = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlayer must be used inside PlayerProvider')
  return v
}

const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one']

export function PlayerProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [audio] = useState(() => new Audio())
  const [queue, setQueue] = useState<QueueState>(empty)
  const [token, setToken] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  // true when the slider drives the OS volume (macOS); otherwise it scales this app only.
  const [systemMode, setSystemMode] = useState(false)
  const [lastUserVolumeAt, setLastUserVolumeAt] = useState(0)
  // Shuffle is a standing preference: it stays on when a new list starts playing.
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [notice, setNotice] = useState<string | null>(null)

  const track = current(queue)

  const advance = useCallback(() => {
    setQueue((q) => {
      const n = next(q, repeat)
      if (!n) {
        audio.pause()
        return q
      }
      return n
    })
    // Wrapping onto the same single track (repeat all, one-song list) would not change the
    // effect's dependencies, so ask for a restart explicitly.
    setToken((t) => t + 1)
  }, [audio, repeat])

  const onEnded = useCallback(() => {
    if (repeat === 'one') {
      audio.currentTime = 0
      void audio.play()
    } else {
      advance()
    }
  }, [audio, repeat, advance])

  useEffect(() => {
    audio.volume = systemMode ? 1 : volume
  }, [audio, volume, systemMode])

  // Follow the OS volume (keyboard keys, menu bar) while the app is open.
  useEffect(() => {
    let alive = true
    const poll = async (): Promise<void> => {
      const v = await window.phinas.getSystemVolume().catch(() => null)
      if (!alive) return
      if (v === null) {
        setSystemMode(false)
        return
      }
      setSystemMode(true)
      // Do not fight the user's slider drag for a moment after they move it.
      if (Date.now() - lastUserVolumeAt > 1500) setVolumeState(v)
    }
    void poll()
    const t = setInterval(poll, 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [lastUserVolumeAt])

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
      on('ended', onEnded)
    ]
    return () => offs.forEach((off) => off())
  }, [audio, onEnded])

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
      shuffle,
      repeat,
      notice,
      play: (tracks, index) => {
        const q = startQueue(tracks, index)
        setQueue(shuffle ? shuffleOn(q) : q)
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
      setVolume: (v) => {
        setVolumeState(v)
        setLastUserVolumeAt(Date.now())
        if (systemMode) void window.phinas.setSystemVolume(v)
      },
      toggleShuffle: () => {
        setShuffle(!shuffle)
        setQueue((q) => (shuffle ? shuffleOff(q) : shuffleOn(q)))
      },
      cycleRepeat: () => setRepeat((r) => REPEAT_ORDER[(REPEAT_ORDER.indexOf(r) + 1) % REPEAT_ORDER.length]),
      dismissNotice: () => setNotice(null)
    }),
    [queue, track, playing, time, duration, volume, shuffle, repeat, notice, audio, advance, systemMode]
  )

  useMediaSession(audio, track, playing, api)

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
