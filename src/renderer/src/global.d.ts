import type { PhinasApi, PhinasEvents } from '../../shared/ipc'

declare global {
  interface Window {
    phinas: PhinasApi & PhinasEvents
  }
}

export {}
