# Less Spotify: layout restructure

Date: 2026-11-17
Status: draft for review

## Goal
The desktop UI looks almost exactly like Spotify's desktop layout. Keep what is already Phinas (purple accent, Montserrat, the theme that follows the cover, dark/light modes) and change only the structure and details that read as Spotify.

This replaces the earlier idea of a total redesign. Mobile is a separate later project and reuses the CSS tokens that already exist in `styles.css`.

## What is Spotify-like today
Top bar with a round home button and a centered search pill; a "Library" panel with filter chips and a "Buat" button; a permanent right "Now Playing" panel; four floating rounded cards with gaps; a "Lagu yang disukai" gradient tile and an 8-tile quick-pick grid on Home; a round white play button.

## Changes

### 1. No top bar; a sidebar instead
Remove `TopBar` and the `.topbar` row. A new `Sidebar` component (replacing `LibraryPanel`) holds, top to bottom:
- **Brand row** with the "Phinas" wordmark. It is the window drag region. On macOS it keeps the 84 px left padding so the traffic-light buttons do not overlap it (they are positioned by `trafficLightPosition` in `src/main/index.ts` and stay where they are).
- **Search box** (the existing search pill and its "recent searches" dropdown, moved out of `TopBar` into its own `SearchBox` component). The dropdown is wider than the sidebar (340 px) and opens over the main area.
- **Navigation:** Beranda, Berdua, Disukai, Riwayat. Berdua shows a green dot while the partner is online.
- A divider, then **Playlist** with the "Buat" (+) and import buttons, then the user's playlists, then a "Dari {nama pasangan}" group with the partner's playlists. The Semua/Milikku/Pasangan chips are removed; the two groups replace them.
- **Footer:** the profile avatar button (opens Profil).

A 24 px transparent drag strip sits at the top of the main area so the window can still be dragged from there. Page titles already start 24 px below the top, so nothing under the strip is clickable.

### 2. New "Berdua" screen
A new view `{ name: 'together' }`. It shows the listen-together card (the same one as on Home, see 4) and the "Dari pasangan" playlists. It exists so the sidebar item has somewhere to go; it adds no new behavior.

### 3. Right panel only when wanted
The right panel (`NowPlaying`) is no longer a permanent column. It is shown when:
- a listen-together session is active (it opens automatically, with a "Bareng {nama} · tersambung" block and an "Akhiri" button above the usual content), or
- the user clicks the cover or title in the player bar (toggle).

When hidden, the main area takes the width. The open/closed state is kept in `Shell` and is not saved between runs.

### 4. Home: listen-together card instead of the liked tile
- Remove the 8-tile quick-pick grid (`.shortcuts`). Its tiles duplicate the sidebar (Disukai) and the "Playlist kamu" shelf.
- Add a full-width gradient card at the top, only when `useListen().available` is true: "Dengarkan bareng" with the partner's online state and an "Ajak" button (or the live session status and "Akhiri").
- The greeting becomes "Selamat siang, {name}" using the existing profile name.

### 5. One flat surface
Drop the floating cards: `gap` and outer padding go to 0, the sidebar and main lose their border radius, border and background blur. A 1 px line separates the sidebar from the main area. The blurred cover (`.ambient`) behind everything stays, as does the accent gradient at the top of the main area.

### 6. Floating pill player
`PlayerBar` becomes a pill pinned to the bottom center of the window (width `min(920px, 100% - 48px)`, about 72 px high, fully rounded, `--glass-strong` with a 1 px line and a shadow):
- left: cover, title, artist, like button; clicking cover or title toggles the right panel
- center: shuffle, previous, **play (filled with `--accent`, white icon)**, next, repeat, and the seek slider with times under them
- right: the listen-together button and volume

The main area and sidebar list get about 110 px of bottom padding so the pill never covers content.

## Not changing
Colors, fonts, themes, the notch overlay, the inner content of Search, Disukai, Riwayat, Playlist, Playlist publik, Playlist pasangan, Import and Profil (they just sit in the new frame), the player logic and all IPC.

## Files
- Create: `components/Sidebar.tsx`, `components/SearchBox.tsx`, `screens/TogetherView.tsx`, `components/ListenCard.tsx` (the card shared by Home and Berdua)
- Delete: `components/TopBar.tsx`, `components/LibraryPanel.tsx`
- Modify: `App.tsx`, `views.ts` (add `together`), `components/PlayerBar.tsx`, `components/NowPlaying.tsx` (session block), `screens/Home.tsx`, `styles.css`

## Testing
There are no UI tests in the project, so:
- `npm run typecheck`, `npm test` and `npm run build` must pass.
- Screenshots with the existing `PHINAS_SHOT` helper of: Home, Berdua, Search with the dropdown open, a playing track with the right panel open and closed, and the light theme. Each is checked by eye for overlap (traffic lights, pill over content, dropdown clipping).
- Manual: drag the window from the sidebar brand and from the top strip; keyboard shortcuts (Cmd/Ctrl+K focuses the search box, which now lives in the sidebar) still work.

## Risks
- macOS traffic lights and drag regions are the most fragile part.
- The search dropdown now has to escape a 248 px column without being clipped by its `overflow`.
- Removing the quick-pick grid changes Home for users who liked it. It is easy to bring back if missed.
