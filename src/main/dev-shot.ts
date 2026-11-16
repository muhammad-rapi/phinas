import { app, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Developer helper: when PHINAS_SHOT is set, wait for the page, optionally run the JS in
 * PHINAS_SHOT_SCRIPT (to click around), save a PNG of the window to PHINAS_SHOT, then quit.
 * Does nothing in normal use.
 */
export function maybeCaptureAndQuit(win: BrowserWindow): void {
  const out = process.env['PHINAS_SHOT']
  if (!out) return
  const script = process.env['PHINAS_SHOT_SCRIPT']
  const settle = Number(process.env['PHINAS_SHOT_DELAY'] ?? 2500)
  win.webContents.once('did-finish-load', async () => {
    try {
      await sleep(settle)
      if (script) {
        await win.webContents.executeJavaScript(readFileSync(script, 'utf8'))
        await sleep(settle)
      }
      const image = await win.webContents.capturePage()
      writeFileSync(out, image.toPNG())
      console.log(`[dev-shot] wrote ${out}`)
    } catch (e) {
      console.error('[dev-shot] failed:', e)
    } finally {
      app.quit()
    }
  })
}
