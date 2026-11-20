import type { Track } from '../types'

export const PROTOCOL_VERSION = 1
/** An invite nobody answers expires after this long. */
export const INVITE_TTL_MS = 60_000
/** A side that is away longer than this ends the session on both sides. */
export const GRACE_MS = 120_000
export const HEARTBEAT_MS = 3_000
export const CLOCK_RESYNC_MS = 30_000
/** Largest queue sent in one message. Longer queues are windowed around the current track. */
export const MAX_QUEUE = 100

export type SyncAction =
  | { kind: 'play'; position: number }
  | { kind: 'pause'; position: number }
  | { kind: 'seek'; position: number }
  | { kind: 'queue'; tracks: Track[]; index: number; position: number; playing: boolean }

export type SyncPayload =
  | { type: 'invite'; version: number }
  /** `snapshot` is the acceptor's queue, used when the inviter has nothing playing. */
  | { type: 'accept'; version: number; snapshot: SyncAction | null }
  | { type: 'decline'; reason?: 'version' }
  | { type: 'end' }
  /** Sent by a side that lost and regained its own connection. */
  | { type: 'hello'; version: number }
  | { type: 'action'; action: SyncAction }
  | { type: 'heartbeat'; videoId: string | null; position: number; playing: boolean }
  | { type: 'resync' }
  | { type: 'status'; state: 'ok' | 'error' }
  | { type: 'ping'; id: string }
  /** `t0` echoes the `ts` of the ping; this message's own `ts` is the peer clock when it answered. */
  | { type: 'pong'; id: string; t0: number }

/** `ts` is the sender's own clock (ms). The receiver converts it with the clock offset. */
export type SyncMessage = SyncPayload & { from: string; ts: number }

export type MessageOf<T extends SyncPayload['type']> = Extract<SyncMessage, { type: T }>

const TYPES = new Set<string>([
  'invite', 'accept', 'decline', 'end', 'hello', 'action', 'heartbeat', 'resync', 'status', 'ping', 'pong'
])

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validAction(a: unknown): a is SyncAction {
  if (typeof a !== 'object' || a === null) return false
  const x = a as Record<string, unknown>
  if (!isNum(x.position)) return false
  if (x.kind === 'play' || x.kind === 'pause' || x.kind === 'seek') return true
  return (
    x.kind === 'queue' &&
    Array.isArray(x.tracks) &&
    x.tracks.length > 0 &&
    Number.isInteger(x.index) &&
    (x.index as number) >= 0 &&
    (x.index as number) < x.tracks.length &&
    typeof x.playing === 'boolean'
  )
}

/** Returns the message when it looks valid, otherwise null. Never throws. */
export function parseMessage(raw: unknown): SyncMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  if (typeof m.type !== 'string' || !TYPES.has(m.type)) return null
  if (typeof m.from !== 'string' || !isNum(m.ts)) return null
  switch (m.type) {
    case 'action':
      if (!validAction(m.action)) return null
      break
    case 'accept':
      if (!isNum(m.version)) return null
      if (m.snapshot !== null && !validAction(m.snapshot)) return null
      break
    case 'invite':
    case 'hello':
      if (!isNum(m.version)) return null
      break
    case 'heartbeat':
      if (!isNum(m.position) || typeof m.playing !== 'boolean') return null
      break
    case 'pong':
      if (typeof m.id !== 'string' || !isNum(m.t0)) return null
      break
    case 'ping':
      if (typeof m.id !== 'string') return null
      break
    case 'status':
      if (m.state !== 'ok' && m.state !== 'error') return null
      break
  }
  return raw as SyncMessage
}

/** At most `max` tracks, always including the current one. The index is adjusted to the new list. */
export function windowQueue(tracks: Track[], index: number, max = MAX_QUEUE): { tracks: Track[]; index: number } {
  if (tracks.length <= max) return { tracks, index }
  const start = Math.min(Math.max(0, index - 5), tracks.length - max)
  return { tracks: tracks.slice(start, start + max), index: index - start }
}
