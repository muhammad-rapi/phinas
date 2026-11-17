import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PlayTracker } from '../../../shared/playTracker'
import type { PlayerCommand, Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import {
  current,
  empty,
  enqueue,
  insertNext,
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
  autoplay: boolean
  play(tracks: Track[], index: number): void
  addToQueue(track: Track): void
  playNext(track: Track): void
  toggle(): void
  next(): void
  prev(): void
  jump(index: number): void
  seek(sec: number): void
  setVolume(v: number): void
  toggleShuffle(): void
  cycleRepeat(): void
  dismissNotice(): void
  toggleAutoplay(): void
  /** The one place that runs player commands (shortcuts, media keys, notch). */
  run(cmd: PlayerCommand): void
}

const Ctx = createContext<PlayerApi | null>(null)

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePlayer must be used inside PlayerProvider')
  return v
}

const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one']
const AUTOPLAY_KEY = 'phinas.autoplay'
const VOLUME_STEP = 0.05

function readAutoplay(): boolean {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) !== 'off'
  } catch {
    return true
  }
}

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
  const [autoplay, setAutoplay] = useState(readAutoplay)
  const lib = useLibrary()
  const libRef = useRef(lib)
  libRef.current = lib
  const preMuteVolume = useRef<number | null>(null)
  const tracker = useMemo(
    () =>
      new PlayTracker((rec) => {
        // History must never get in the way of playback.
        window.phinas.recordPlay(rec).catch((e) => console.warn('[history] not saved:', e))
      }),
    []
  )

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
    tracker.finish(false)
    if (repeat === 'one') {
      if (track) tracker.start(track)
      audio.currentTime = 0
      void audio.play()
    } else {
      advance()
    }
  }, [audio, repeat, advance, tracker, track])

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
      on('timeupdate', () => {
        setTime(audio.currentTime)
        tracker.tick(audio.currentTime)
      }),
      on('durationchange', () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)),
      on('play', () => setPlaying(true)),
      on('pause', () => setPlaying(false)),
      on('ended', onEnded)
    ]
    return () => offs.forEach((off) => off())
  }, [audio, onEnded, tracker])

  // Load and start whenever the current track (or a replay request) changes.
  useEffect(() => {
    if (!track) return
    let cancelled = false
    tracker.start(track)
    const skip = (): void => {
      if (cancelled) return
      tracker.finish(false)
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

  // Autoplay: when one track is left (or the queue is done), append ranked suggestions.
  const autoplayAsked = useRef<string | null>(null)
  useEffect(() => {
    if (!autoplay || !track || repeat === 'all') return
    if (queue.tracks.length - queue.index > 1) return
    const key = `${track.videoId}:${queue.tracks.length}`
    if (autoplayAsked.current === key) return
    autoplayAsked.current = key
    window.phinas
      .getAutoplay(track, queue.tracks.map((t) => t.videoId))
      .then((more) => {
        if (more.length === 0) return
        setQueue((q) => {
          // The user may have changed the queue meanwhile: only append to the same one.
          if (current(q)?.videoId !== track.videoId) return q
          const have = new Set(q.tracks.map((t) => t.videoId))
          return more.filter((t) => !have.has(t.videoId)).reduce(enqueue, q)
        })
      })
      .catch(() => {
        /* offline: autoplay adds nothing and shows no error */
      })
  }, [autoplay, track, queue.index, queue.tracks, repeat])

  const api = useMemo<PlayerApi>(() => {
    const a: PlayerApi = {
      queue,
      track,
      playing,
      time,
      duration,
      volume,
      shuffle,
      repeat,
      notice,
      autoplay,
      play: (tracks, index) => {
        tracker.finish(true)
        const q = startQueue(tracks, index)
        setQueue(shuffle ? shuffleOn(q) : q)
        setToken((t) => t + 1)
      },
      addToQueue: (t) => {
        setQueue((q) => (q.tracks.length ? enqueue(q, t) : startQueue([t], 0)))
        setNotice(`"${t.title}" ditambahkan ke antrean.`)
      },
      playNext: (t) => {
        setQueue((q) => (q.tracks.length ? insertNext(q, t) : startQueue([t], 0)))
        setNotice(`"${t.title}" akan diputar berikutnya.`)
      },
      toggle: () => {
        if (!audio.src) return
        if (audio.paused) void audio.play()
        else audio.pause()
      },
      next: () => {
        tracker.finish(true)
        advance()
      },
      prev: () => {
        if (audio.currentTime > 3) audio.currentTime = 0
        else {
          if (queue.index > 0) tracker.finish(true)
          setQueue((q) => prev(q))
        }
      },
      jump: (i) => {
        tracker.finish(true)
        setQueue((q) => jumpTo(q, i))
      },
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
      dismissNotice: () => setNotice(null),
      toggleAutoplay: () => {
        setAutoplay(!autoplay)
        try {
          localStorage.setItem(AUTOPLAY_KEY, autoplay ? 'off' : 'on')
        } catch {
          /* ignore */
        }
      },
      run: (cmd) => {
        switch (cmd) {
          case 'toggle':
            return a.toggle()
          case 'next':
            return a.next()
          case 'prev':
            return a.prev()
          case 'volumeUp':
            return a.setVolume(Math.min(1, volume + VOLUME_STEP))
          case 'volumeDown':
            return a.setVolume(Math.max(0, volume - VOLUME_STEP))
          case 'mute':
            if (volume > 0) {
              preMuteVolume.current = volume
              return a.setVolume(0)
            }
            return a.setVolume(preMuteVolume.current ?? 0.5)
          case 'shuffle':
            return a.toggleShuffle()
          case 'repeat':
            return a.cycleRepeat()
          case 'like': {
            if (!track) return
            const liked = libRef.current.likes.some((l) => l.videoId === track.videoId)
            void window.phinas.setLiked(track, !liked).then(() => libRef.current.refresh())
            return
          }
          case 'focusSearch':
            return document.querySelector<HTMLInputElement>('.searchpill input')?.focus()
        }
      }
    }
    return a
  }, [queue, track, playing, time, duration, volume, shuffle, repeat, notice, autoplay, audio, advance, systemMode, tracker])

  // Messages fade away on their own; a click still dismisses them sooner.
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(t)
  }, [notice])

  useMediaSession(audio, track, playing, api)

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
