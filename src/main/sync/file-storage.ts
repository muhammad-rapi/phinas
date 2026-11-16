import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Minimal localStorage-like store so Supabase can keep the login session in Node. */
export class FileStorage {
  constructor(private path: string) {}

  private read(): Record<string, string> {
    try {
      return existsSync(this.path) ? JSON.parse(readFileSync(this.path, 'utf8')) : {}
    } catch {
      return {}
    }
  }

  private write(data: Record<string, string>): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(data), { mode: 0o600 })
  }

  getItem(key: string): string | null {
    return this.read()[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.write({ ...this.read(), [key]: value })
  }

  removeItem(key: string): void {
    const data = this.read()
    delete data[key]
    this.write(data)
  }
}
