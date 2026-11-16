import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    backgroundColor: '#000000',
    webPreferences: { preload: join(here, '../preload/index.mjs'), sandbox: false }
  })
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(here, '../renderer/index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
