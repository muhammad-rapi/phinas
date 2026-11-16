import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type PhinasApi } from '../shared/ipc'

const api = Object.fromEntries(
  CHANNELS.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(name, ...args)])
) as unknown as PhinasApi

contextBridge.exposeInMainWorld('phinas', api)
