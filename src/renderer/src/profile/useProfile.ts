import { useState } from 'react'

const KEY = 'phinas.name'
const DEFAULT_NAME = 'Kamu'

function read(): string {
  try {
    return localStorage.getItem(KEY)?.trim() || DEFAULT_NAME
  } catch {
    return DEFAULT_NAME
  }
}

/** The display name shown on the profile, kept in localStorage. */
export function useProfile(): { name: string; setName: (n: string) => void; initial: string } {
  const [name, setNameState] = useState(read)
  const setName = (n: string): void => {
    setNameState(n)
    try {
      localStorage.setItem(KEY, n.trim())
    } catch {
      /* storage unavailable */
    }
  }
  return { name, setName, initial: (name.trim()[0] ?? DEFAULT_NAME[0]).toUpperCase() }
}
