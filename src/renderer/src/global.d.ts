import type { PhinasApi } from '../../shared/ipc'

declare global {
  interface Window {
    phinas: PhinasApi
  }
}

export {}
