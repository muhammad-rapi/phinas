import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type PhinasApi, type PhinasEvents } from '../shared/ipc'

const invoke = Object.fromEntries(
  CHANNELS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(name, ...args)])
) as unknown as PhinasApi

const subscribe = <T>(channel: string, cb: (v: T) => void): (() => void) => {
  const fn = (_e: unknown, v: T): void => cb(v)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

const events: PhinasEvents = {
  onPlayerCommand: (cb) => subscribe('player:command', cb),
  pushNotchState: (state) => ipcRenderer.send('notch:state', state),
  onNotchState: (cb) => subscribe('notch:state', cb),
  sendPlayerCommand: (cmd) => ipcRenderer.send('player:command', cmd),
  sendSeek: (sec) => ipcRenderer.send('player:seek', sec),
  onPlayerSeek: (cb) => subscribe('player:seek', cb),
  notifyLibraryChanged: () => ipcRenderer.send('library:changed'),
  onLibraryChanged: (cb) => subscribe('library:changed', () => cb()),
  setNotchExpanded: (expanded) => ipcRenderer.send('notch:expanded', expanded),
  onNotchLayout: (cb) => subscribe('notch:layout', cb)
}

contextBridge.exposeInMainWorld('phinas', { ...invoke, ...events })
