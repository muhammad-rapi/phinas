import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../../shared/types'

/** The app update status, kept current by the main process. */
export function useUpdate(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    let alive = true
    window.phinas
      .getUpdateStatus()
      .then((s) => alive && setStatus(s))
      .catch(() => {})
    const off = window.phinas.onUpdateStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}
