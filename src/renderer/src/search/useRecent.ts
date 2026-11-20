import { useCallback, useState } from 'react'
import type { Track } from '../../../shared/types'
import { addRecent, loadRecent, removeQuery, removeRecent, saveRecent, type RecentEntry } from './recent'

/** Recent searches (typed text and picked songs), persisted in localStorage. */
export function useRecent(): {
  recent: RecentEntry[]
  rememberQuery: (q: string) => void
  /** A song the user picked from search results; replaces the text they typed to find it. */
  rememberTrack: (track: Track, typed: string) => void
  forget: (entry: RecentEntry) => void
} {
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent)

  const update = useCallback((fn: (cur: RecentEntry[]) => RecentEntry[]) => {
    setRecent((cur) => {
      const next = fn(cur)
      saveRecent(next)
      return next
    })
  }, [])

  const rememberQuery = useCallback((q: string) => update((cur) => addRecent(cur, { kind: 'query', text: q })), [update])
  const rememberTrack = useCallback(
    (track: Track, typed: string) => update((cur) => addRecent(removeQuery(cur, typed), { kind: 'track', track })),
    [update]
  )
  const forget = useCallback((entry: RecentEntry) => update((cur) => removeRecent(cur, entry)), [update])

  return { recent, rememberQuery, rememberTrack, forget }
}
