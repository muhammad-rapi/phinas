# Listen together: design

Date: 2026-11-17
Status: draft for review

## Goal
Two Phinas users (the user and their partner) listen to the same music at the same time, with shared track, queue, play/pause and position. Desktop first. The sync logic must be platform-neutral because iOS and Android clients will reuse it later.

## Decisions
- **Control:** both sides are equal. Either can play, pause, seek, change track, edit the queue. Last command wins.
- **Starting a session:** manual invite. The partner accepts or declines. An invite expires after 60 s and is not shown if the partner opens the app later.
- **Failure:** the session stays alive when one side drops. The dropped side catches up on return. If it does not return within 2 minutes, the session ends on both sides.
- **Approach:** Supabase Realtime broadcast with clock sync and drift correction. No new tables.
- **Audio is never sent.** Each device streams the same `videoId` itself. Only state is synced.

## Architecture

```
src/shared/sync/        pure TypeScript, no Electron, DOM or Supabase
  protocol.ts           message types + protocol version
  session.ts            state machine: idle -> invited -> active -> ended
  clock.ts              clock offset estimate from ping/pong
  reconcile.ts          drift -> { none | rate | seek }

src/main/sync/
  realtime.ts           Supabase Realtime channel adapter (broadcast + presence)

src/renderer (PlayerProvider)
  receives session commands -> player.run(...)
  emits local actions into the session
```

`shared/sync` talks to the outside only through two interfaces:
- `Transport { send, onMessage }`
- `PlayerPort { getPosition, setRate, run }`

Desktop and mobile each write their own adapters.

### Channel
One channel per pair. The name is derived from the two sorted user ids. Only two accounts exist, so no session table is needed.

### Messages
`hello` (carries protocol version), `invite`, `accept`, `decline`, `end`, `action` (play, pause, seek, setTrack, queue), `heartbeat`, `ping`, `pong`. Every message carries `ts` corrected by the clock offset.

### Conflict rule
Each `action` carries `ts` and `from`. The newer `ts` wins. On equal `ts`, the smaller user id wins, so both sides reach the same result.

## Data flow

### Starting
1. User taps "Listen together"; `invite` goes to the channel.
2. If the partner's app is open, a prompt appears. After `accept`, both sides exchange several `ping`/`pong` to compute the clock offset, then the session is `active`.
3. Whoever is playing is the initial state. If both are idle, the session starts empty and either can play the first track.

### While active
- Local actions apply immediately without waiting for a reply, then are sent as `action`.
- Actions arriving from the session run through `player.run()` marked `remote: true` and are not re-emitted, which prevents loops.
- `heartbeat` every 3 s: `{ trackId, position, playing, ts }`. The receiver computes the expected position and reconciles:
  - drift < 200 ms: nothing
  - 200 ms to 1 s: `playbackRate` 0.97 or 1.03 until drift is gone, then 1.0
  - > 1 s: seek
- A heartbeat with a different track makes the receiver follow with `setTrack`.

### Drop and return
- Presence detects the missing side. The remaining side keeps playing and shows "Partner disconnected".
- The dropped side keeps playing locally until it reconnects or 2 minutes pass.
- On return it sends `hello`, takes the latest heartbeat, jumps to the current position and recomputes the clock offset.
- After 2 minutes without return the remaining side sends `end` (best effort). The dropped side also closes its own session after 2 minutes, so neither side hangs.

### Stream failure on one side
That side shows the usual playback error and sends `status: error`. The session stays alive and the other side is unaffected. When the next track loads, the failed side rejoins automatically.

## Minimal UI
The full redesign comes later, so this UI is intentionally small and easy to move.
- A "Listen together" button in the player bar or the partner profile.
- Accept/decline prompt for incoming invites.
- Player bar indicator while active: partner name and status (connected, disconnected, error).
- "End session" button.

## Error handling
- Realtime cannot connect: the button is disabled with "Cannot connect". No session starts.
- Protocol version mismatch: `hello` carries the version; on mismatch the session is refused with "Update the app first". This matters once mobile joins.
- Malformed or unknown messages: ignored and logged, never crash.
- Badly wrong device clock: corrected by the ping offset. If ping variance is high, the session continues with looser drift correction.

## Testing
`shared/sync` is tested with vitest using a fake `Transport` and fake clock, with no Electron or network:
- state machine: all transitions, including invite expiry and the 2-minute timeout
- `reconcile`: the 200 ms and 1 s thresholds and the direction of rate correction
- `clock`: offset from ping/pong with asymmetric latency
- last command wins: conflicting actions with equal and different `ts`
- loop prevention via `remote: true`
- integration: two sessions connected by an in-memory transport with random latency

The Realtime adapter is tested manually with two accounts, since it is the only part that depends on Supabase.

## Out of scope
- Chat, reactions, more than two people.
- Sending audio.
- Final UI (belongs to the redesign).
- Mobile clients (they will reuse `shared/sync` unchanged).

## Roadmap context
This is sub-project 1 of 3. Order: listen together, then UI redesign, then iOS and Android clients. Each gets its own spec and plan.
