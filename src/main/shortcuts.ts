import type { PlayerCommand } from '../shared/types'

/**
 * Global shortcuts: they work while the app is in the background.
 * The hardware media keys are not here on purpose: Chromium already routes them through the
 * Media Session (see useMediaSession), and registering them twice would toggle twice.
 */
export const GLOBAL_SHORTCUTS: { accelerator: string; command: PlayerCommand }[] = [
  { accelerator: 'CommandOrControl+Alt+Space', command: 'toggle' },
  { accelerator: 'CommandOrControl+Alt+Right', command: 'next' },
  { accelerator: 'CommandOrControl+Alt+Left', command: 'prev' }
]

export interface ShortcutRegistry {
  register(accelerator: string, callback: () => void): boolean
  unregisterAll(): void
}

/** Registers every global shortcut. A key another app already owns is skipped and logged. */
export function registerShortcuts(
  registry: ShortcutRegistry,
  send: (cmd: PlayerCommand) => void,
  log: (msg: string) => void = console.warn
): string[] {
  const done: string[] = []
  for (const { accelerator, command } of GLOBAL_SHORTCUTS) {
    try {
      if (registry.register(accelerator, () => send(command))) done.push(accelerator)
      else log(`shortcut ${accelerator} is taken by another app, skipped`)
    } catch (e) {
      log(`shortcut ${accelerator} failed: ${String(e)}`)
    }
  }
  return done
}
