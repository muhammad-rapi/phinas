# Phinas: Design

Date: 2026-11-16

## Goal
A desktop music player for macOS and Windows, for personal use by two people (the owner on Mac, partner on Windows). Spotify-like UI with a "Dynamic" theme. Version 1 covers play, library, and sync.

## Out of scope for v1
- Offline audio downloads (only metadata works offline)
- YouTube/Google account login (may be added later)
- Android/mobile
- Public release

## Backlog (after v1)
- Mini player in the menu bar (macOS) / system tray (Windows): shows current track, with play/pause, next/previous, so songs can be changed without opening the main window.
- Global keyboard shortcuts and media keys for play/pause, next, previous, working while the app is in the background.
- Offline audio downloads.
- Optional YouTube account login.

## Constraints and decisions
- Music data comes from YouTube Music via the unofficial `youtubei.js` library. This can break when YouTube changes; fix is usually updating the library. Personal use only.
- Reference app Metrolist is GPL-3.0. If any Metrolist code is reused, this project must also be GPL-3.0 with source available. v1 is written from scratch and does not copy Metrolist code.
- Stack: Electron + TypeScript + React, SQLite (local), Supabase (sync).
- Auth: Supabase email and password for the two users. No Google credentials stored.

## Architecture
Four units. Electron main process (Node) runs the first three. The React UI talks to them only through IPC.

| Unit | Responsibility | Depends on |
|---|---|---|
| Music source | Search; resolve stream URL (`youtubei.js`) | Internet |
| Local library | Playlists and liked tracks in SQLite | Disk |
| Sync | Push and pull library changes with Supabase | Local library, Supabase |
| UI (React) | Screens, player, theming | The three units via IPC |

## UI
Layout: floating rounded panels (left sidebar, center content, right Now Playing panel, bottom player bar).

Screens:
1. Home: greeting, own playlists grid, "From partner" shared playlists
2. Search: query box, track results (play, add to playlist)
3. Library: playlists, liked tracks, "Partner" tab (view and copy partner playlists)
4. Now Playing panel: large cover, title, queue
5. Player bar: play/pause, next/prev, progress, volume
6. Settings: theme, Supabase account

Themes (Settings): Dynamic (default), Dark, Light. Adding a theme means adding one color block.

Dynamic theme: on track change, extract the dominant color of the cover art. Use it for the center-panel gradient and accent color (buttons, progress bar) with a ~0.5s transition. Too-bright or washed-out colors are darkened so text stays readable.

## Data flow
Playback: user searches, Music source returns results; user clicks a track, Music source resolves the stream URL, `<audio>` plays it; cover color is extracted and the theme updates.

Sync: every change is written to SQLite first, then queued for Supabase. If offline, the queue waits and flushes when the connection returns. Each playlist has one owner. The partner can view and copy a playlist into their own library but not edit it, so there are no edit conflicts. Only metadata syncs (video ID, title, artist, cover URL, track order).

Supabase tables: `profiles`, `playlists`, `playlist_tracks`, `liked_tracks`. Row Level Security: a user can write only their own rows and read the partner's rows.

## Error handling
- Stream fails (blocked or YouTube change): skip to next track, show a short message, do not crash.
- Sync fails: local change is kept, retried automatically, small "not synced" indicator shown.
- Offline: library and playlists still open; search and playback unavailable.

## Testing
- Unit tests: Local library, Sync queue, Dynamic color generation (including too-bright colors).
- Manual check per release: play a real track and test two-user sync.
- Streaming is not covered by automated tests because it depends on YouTube.
