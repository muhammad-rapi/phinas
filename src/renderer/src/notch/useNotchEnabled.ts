import { useEffect, useState } from 'react'

/** Whether the notch is shown, kept in step wherever it is changed. Null until loaded. */
export function useNotchEnabled(): [boolean | null, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    window.phinas.getNotchEnabled().then(setEnabled).catch(() => setEnabled(null))
    return window.phinas.onNotchEnabled(setEnabled)
  }, [])
  const set = (value: boolean): void => {
    setEnabled(value)
    void window.phinas.setNotchEnabled(value)
  }
  return [enabled, set]
}
