# Phinas: Recommendations, play history, shortcuts, notch overlay

Date: 2026-11-17

## Goal
Add four things to Phinas, built in this order:
1. Play history ("Putar lagi" shelf, "Baru diputar" screen)
2. A new recommendation algorithm, used by Home and by autoplay when the queue ends
3. Keyboard shortcuts and media keys
4. A Dynamic Island-style notch overlay on macOS and Windows

This closes two backlog items from the v1 spec (global shortcuts and media keys; the always-available mini control).

## Out of scope
- Syncing play history to Supabase (history stays local)
- Using the partner's taste in recommendations
- Menu bar / system tray popup (the notch replaces it for now)
- Sleep timer, crossfade, equalizer

## 1. Play history and taste signals

- New SQLite table `plays`: `videoId`, title, artist, coverUrl, durationSec, `playedAt`, `listenedSec`, `skipped`. Local only, never synced.
- `PlayerProvider` writes one row per track:
  - Counted as played after 30 seconds or 50% of the duration, whichever comes first.
  - Counted as skipped when the user moves to another track before 30 seconds.
- Home gets a "Putar lagi" shelf. A "Baru diputar" screen is reachable from the sidebar. Both show unique recent tracks, at most 50.
- `Library` gets aggregate queries: top artists, play count per track, skip count per track.

## 2. Recommender and autoplay

New unit `src/main/recommend/` with two pure, testable functions:

- `buildProfile(likes, plays)` returns a weight per artist and the set of known tracks.
  - Weights: like +3, full play +1, skip -2.
  - Weights decay with age so old taste fades.
- `rank(candidates, profile, exclude)` sorts candidates.
  - Score rises for liked artists and falls for skipped tracks.
  - Tracks played recently are dropped.
  - At most 2 consecutive tracks per artist, for variety.

`MusicSource` gets `getRelated(videoId)` using `youtubei.js` (up next and related tracks). Results are cached with a TTL like the home feed.

**Autoplay**
- When the queue has one track left or is finished, fetch candidates for the current track plus the top 2-3 profile seeds, run `rank`, and append 10 tracks to the queue.
- A toggle "Autoplay" in Now Playing, on by default, stored locally.
- If the network fails, autoplay adds nothing and does not show an error.

**Home**
- "Pilihan untukmu" becomes the `rank` output over candidates from profile seeds.
- With no history and no likes, it falls back to the current Quick picks feed.
- If fetching fails, the last good feed is shown.

## 3. Keyboard shortcuts and media keys

New unit `src/main/shortcuts.ts` using Electron `globalShortcut`:
- Media keys: `MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`. Work while the app is in the background.
- Extra global shortcuts: `Ctrl/Cmd+Alt+Space` play/pause, `Ctrl/Cmd+Alt+Right` next, `Ctrl/Cmd+Alt+Left` previous.
- Local shortcuts (window focused, not while typing in an input): `Space` play/pause, `Shift+Right` / `Shift+Left` next/previous, `Up` / `Down` volume, `M` mute, `L` like, `S` shuffle, `R` repeat, `/` focus Search.
- The main process sends commands over one IPC channel, `player:command`. `PlayerProvider` is the only place that executes them. The notch uses the same channel.
- On macOS, global media keys may need the Accessibility permission. Without it, registration does not crash; a line is written to the log.

## 4. Notch overlay

New unit `src/main/notch/`: one small `BrowserWindow`. It is frameless, transparent, always on top, not focusable, and hidden from the taskbar and Dock. It loads a separate renderer page, `notch.html`.

**Position**: top center of the primary display.
- macOS: Electron has no notch API. Heuristic: a menu bar height (`workArea.y - bounds.y`) above 30 pt means a notch is present. With a notch, the pill is black with rounded bottom corners and merges with the camera notch.
- macOS without a notch, and Windows: a black pill floating a few pixels below the top edge.

**States**
- Compact: shown only while a track is loaded. Small cover, scrolling title, small play indicator.
- Expanded (hover or click): large cover, title and artist, progress bar, previous / play-pause / next, like. It animates out of the pill and shrinks back when the pointer leaves.

**Data flow**: the main window pushes player state (track, position, playing) to the notch over IPC. Notch buttons send `player:command` back.

**Settings**: a "Tampilkan notch" toggle in Profile, stored locally, on by default. The notch uses the accent color of the Dynamic theme.

**Known limits**: Windows has no physical notch, so it is a floating pill. The overlay does not appear over exclusive-fullscreen apps.

## Error handling
- History write fails: playback is not affected; the error is logged.
- Related fetch fails: autoplay and Home fall back as described above.
- Shortcut registration fails (key already taken): skip that key, log it.
- Notch window fails to create: app runs without it.

## Testing
Unit tests (vitest):
- `buildProfile` and `rank`, including the per-artist cap and dropping recently played tracks
- `plays` recording rules (30 s / 50% / skip) and the aggregate queries
- notch detection as a pure function of `bounds` and `workArea`
- mapping of shortcuts to commands

Manual check per release:
- Media keys with the app in the background
- Notch on a Mac with a notch, a Mac without, and Windows
- Autoplay when the queue ends
- Home with empty history and with some history
