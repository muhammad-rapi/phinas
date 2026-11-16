import { useCallback, useState } from 'react'
import { addRecent, loadRecent, removeRecent, saveRecent } from './recent'

/** Recent searches, persisted in localStorage. */
export function useRecent(): {
  recent: string[]
  remember: (q: string) => void
  forget: (q: string) => void
} {
  const [recent, setRecent] = useState<string[]>(loadRecent)

  const remember = useCallback((q: string) => {
    setRecent((cur) => {
      const next = addRecent(cur, q)
      saveRecent(next)
      return next
    })
  }, [])

  const forget = useCallback((q: string) => {
    setRecent((cur) => {
      const next = removeRecent(cur, q)
      saveRecent(next)
      return next
    })
  }, [])

  return { recent, remember, forget }
}
