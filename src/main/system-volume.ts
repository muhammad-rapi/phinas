import { execFile } from 'node:child_process'

export type Run = (cmd: string, args: string[]) => Promise<string>

export interface SystemVolume {
  /** False on platforms where reading/writing the OS volume is not implemented. */
  supported: boolean
  get(): Promise<number | null>
  set(level: number): Promise<void>
}

const defaultRun: Run = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 3000 }, (err, stdout) => (err ? reject(err) : resolve(stdout)))
  })

/** osascript prints the volume as an integer 0-100. Returns 0-1, or null if unreadable. */
export function parseVolume(out: string): number | null {
  const n = Number.parseInt(out.trim(), 10)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n)) / 100
}

export function createSystemVolume(platform: string = process.platform, run: Run = defaultRun): SystemVolume {
  if (platform !== 'darwin') {
    return { supported: false, get: async () => null, set: async () => {} }
  }
  return {
    supported: true,
    get: async () => {
      try {
        return parseVolume(await run('osascript', ['-e', 'output volume of (get volume settings)']))
      } catch {
        return null
      }
    },
    set: async (level) => {
      const pct = Math.round(Math.min(1, Math.max(0, level)) * 100)
      await run('osascript', ['-e', `set volume output volume ${pct}`])
    }
  }
}
