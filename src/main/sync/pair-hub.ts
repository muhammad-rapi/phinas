import type { SyncMessage } from '../../shared/sync/protocol'
import type { Friend, ListenStatus, PairClosedReason } from '../../shared/types'
import { PairChannel, type PairRealtimeLike } from './realtime'

type Emit = (channel: string, value: unknown) => void

/** Most pair channels open at once (partner first, then friends in list order). */
export const MAX_PAIRS = 30

/**
 * How long a channel the server refused stays shut while its friend still looks eligible. The friends
 * list can lag behind the server, so try again now and then, but never in a tight loop.
 */
export const REFUSED_RETRY_MS = 60_000

/** Which channels to open and close so exactly the first `cap` eligible friends have one. */
export function channelPlan(current: readonly string[], eligible: readonly string[], cap = MAX_PAIRS): { open: string[]; close: string[] } {
  const keep = new Set(eligible.slice(0, cap))
  const have = new Set(current)
  return {
    open: [...keep].filter((id) => !have.has(id)),
    close: current.filter((id) => !keep.has(id))
  }
}

/** Friends a pair channel is for: online and allowed, in list order (the server puts the partner first). */
export function eligibleFriends(friends: readonly Friend[], online: ReadonlySet<string>): string[] {
  return friends.filter((f) => f.canListen && online.has(f.userId)).map((f) => f.userId)
}

/**
 * One private `pair:<a>:<b>` channel per friend who is online and allows Listen Together. Follows
 * the friends list and the online set; events to the renderer carry the friend's id.
 * Calls are serialised, like PairChannel and PresenceHub.
 */
export class PairHub {
  private pairs = new Map<string, PairChannel>()
  private me: string | null = null
  private friends: Friend[] = []
  private online = new Set<string>()
  /** When each refused channel was refused, by friend id. */
  private refusedAt = new Map<string, number>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly sb: PairRealtimeLike,
    private readonly emit: Emit,
    private readonly cap = MAX_PAIRS
  ) {}

  /** The friends list was fetched again (it carries `canListen`). */
  setFriends(me: string, friends: Friend[]): Promise<void> {
    return this.run(async () => {
      if (this.me !== null && this.me !== me) await this.closeAll('closed')
      this.me = me
      this.friends = friends
      await this.reconcile()
    })
  }

  /** The set of online friends changed (from PresenceHub). */
  setOnline(ids: string[]): Promise<void> {
    return this.run(async () => {
      this.online = new Set(ids)
      await this.reconcile()
    })
  }

  send(friendId: string, msg: SyncMessage): void {
    this.pairs.get(friendId)?.send(msg)
  }

  /** Each open channel's state, by friend id. */
  status(): Record<string, ListenStatus> {
    return Object.fromEntries([...this.pairs].map(([id, p]) => [id, p.status()]))
  }

  /** Sign-out, deletion or a disabled account: leave everything and forget the lists. */
  close(): Promise<void> {
    return this.run(async () => {
      this.me = null
      this.friends = []
      this.online = new Set()
      await this.closeAll('closed')
    })
  }

  /** Runs `op` after every earlier operation; one failure does not stop the queue. */
  private run<T>(op: () => Promise<T>): Promise<T> {
    const p = this.queue.then(op)
    this.queue = p.catch(() => undefined)
    return p
  }

  private async reconcile(): Promise<void> {
    const me = this.me
    if (me === null) return
    // A refused channel stays in the map (so it is not reopened) until its cooldown has passed.
    const now = Date.now()
    for (const [id, p] of this.pairs) {
      const at = this.refusedAt.get(id)
      if (at !== undefined && p.status().notAllowed && now - at >= REFUSED_RETRY_MS) {
        this.pairs.delete(id)
        this.refusedAt.delete(id)
      }
    }
    const plan = channelPlan([...this.pairs.keys()], eligibleFriends(this.friends, this.online), this.cap)
    for (const id of plan.close) {
      const p = this.pairs.get(id)
      this.pairs.delete(id)
      // Still a friend who allows it means they only went offline; anything else is a refusal.
      const allowed = this.friends.some((f) => f.userId === id && f.canListen)
      await p?.close(allowed ? 'closed' : 'not-allowed')
      this.refusedAt.delete(id)
    }
    for (const id of plan.open) {
      const p = new PairChannel(this.sb, (channel, value) => this.forward(id, channel, value))
      this.pairs.set(id, p)
      await p.open(me, id)
    }
  }

  private async closeAll(reason: PairClosedReason): Promise<void> {
    const all = [...this.pairs.values()]
    this.pairs.clear()
    for (const p of all) await p.close(reason)
    this.refusedAt.clear()
  }

  /** PairChannel emits bare values; the renderer needs to know whose channel they come from. */
  private forward(friendId: string, channel: string, value: unknown): void {
    if (channel === 'listen:closed' && value === 'not-allowed') this.refusedAt.set(friendId, Date.now())
    if (channel === 'listen:message') this.emit(channel, { friendId, msg: value })
    else if (channel === 'listen:presence') this.emit(channel, { friendId, here: value })
    else if (channel === 'listen:connection') this.emit(channel, { friendId, up: value })
    else if (channel === 'listen:closed') this.emit(channel, { friendId, reason: value })
  }
}
