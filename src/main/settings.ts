import { readFileSync, writeFileSync } from 'node:fs'

export interface Settings {
  notch: boolean
  /** The account that took the pre-account library (`phinas.db`), or null while none has. */
  claimedBy: string | null
  /** The welcome screen was answered: signed in once, or chose "Pakai tanpa akun". */
  welcomeDone: boolean
}

const DEFAULTS: Settings = { notch: true, claimedBy: null, welcomeDone: false }

/** Tiny JSON file in the user data folder. A missing or broken file means defaults. */
export class SettingsStore {
  private data: Settings

  constructor(private path: string) {
    try {
      this.data = { ...DEFAULTS, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<Settings>) }
    } catch {
      this.data = { ...DEFAULTS }
    }
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.data[key]
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data[key] = value
    try {
      writeFileSync(this.path, JSON.stringify(this.data))
    } catch (e) {
      console.error('settings not saved:', e)
    }
  }
}
