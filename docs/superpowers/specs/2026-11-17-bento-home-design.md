# Bento Home and Berdua

Date: 2026-11-17
Status: draft for review

## Goal
After the sidebar and the floating player, the content still reads as Spotify. Beranda is a stack of horizontal shelves with square cover cards and ‹ › arrows. Replace them on **Beranda** and **Berdua** with a bento grid: tiles of different sizes, each showing a fixed number of items, with no sideways scrolling.

Colors, fonts, themes and the existing data stay. Search and public playlists keep their shelves for now.

## Layout

### The grid
- Tiles sit in rows of a 12-column grid with a 12 px gap.
- Each row holds two tiles with fixed spans (8+4, 4+8 or 6+6). If one tile of a row has nothing to show, it is left out and the other tile takes the full row.
- A tile is a rounded surface (radius 20 px, `--glass` background, 1 px `--line` border), padding 18 px, with a title in the shelf-title style. The listen-together tile keeps its purple gradient.
- When the main area is narrower than 760 px (for example with the right panel open in a small window), each tile takes the full row. This is done with a CSS container query on the main area.
- Nothing inside a tile scrolls. Each tile shows a fixed number of items, and there is no "see all".

### Beranda, top to bottom
1. **Greeting** (unchanged).
2. **Row 1:**
   - **Lanjutkan** (span 8, about 220 px tall). Shows the current track if one is loaded, otherwise the most recent play: large cover (about 168 px), title, artist and a large purple play button. If the track is the current one, the button toggles play/pause. Otherwise it plays the recent list from that track. With no current track and no history, the tile shows "Cari lagu untuk mulai" with a button that focuses the search box.
   - **Berdua** (span 4). Signed in with a partner: a compact listen-together tile (partner status line, title and the same actions as today's card: Ajak, Batalkan, Terima/Tolak, Akhiri). Clicking its title opens the Berdua screen. Not signed in: a **Disukai** tile instead (heart, "Lagu yang disukai", number of songs) that opens Disukai.
3. **Row 2:**
   - **Putar lagi** (span 4). Three covers from the first recent plays, overlapped like a fanned stack, then the first 4 recent plays as rows (title, artist). Clicking a row plays the recent list from that row. Clicking the title opens Riwayat. Hidden when there is no history.
   - **Pilihan untukmu** (span 8). A 4×2 grid of 8 tracks: small cover (48 px) with title and artist beside it. It uses personal recommendations, or the feed's picks when there are none. Clicking one plays the list from it.
4. **Row 3:**
   - **Lagi tren** (span 6). The top 5 trending tracks as numbered rows (number, small cover, title, artist). Clicking one plays the trending list from it. While loading, it shows 5 placeholder rows. If loading fails, it shows the existing "Tidak bisa memuat yang lagi tren…" line.
   - **Playlist** (span 6). Up to 4 playlists in a 2×2 grid (cover, name, "Playlist" or the owner's name): your own first, then your partner's. Clicking one opens it. With no playlists at all, it shows "Buat playlist pertamamu" with a button that creates one, the same as the sidebar's +.

### Berdua
- The full-width listen-together card (today's `ListenCard`, unchanged) or the sign-in hint.
- Below it, the partner's playlists as a grid of tiles (4 per row, 2 when narrow), each tile showing its cover, name and play button. This replaces `PartnerShelf`.
- The "Pasangan belum membagikan playlist." line stays.

## Components
- `components/Bento.tsx` (new): `BentoRow` (lays out its visible tiles and widens a single one to the full row), `Tile` (frame, title, optional click on the title), and `TrackRows` (a list of track rows, optionally numbered, each playing the list from that row). These replace the parts of `Shelf` that Home and Berdua used.
- `screens/home/continue.ts` (new): `continueTrack(current, recent)`, a pure function that picks the track for Lanjutkan and says whether it is the current one.
- `components/ListenCard.tsx`: gains a `compact` prop for the Home tile (stacked layout, smaller title). The full card on Berdua is unchanged.
- `screens/Home.tsx`: rebuilt from the tiles above. Data loading is unchanged.
- `screens/TogetherView.tsx`: the card plus the playlist grid.
- `components/PartnerShelf.tsx`: deleted (no users left).
- `styles.css`: bento grid, tiles, the fanned stack, track rows, the container query.
- `Shelf.tsx` and `MediaCard.tsx` stay for Search and public playlists.

## Testing
- Unit tests (vitest, `tests/continue.test.ts`) for `continueTrack`: current track wins; with no current track it returns the first recent play; with neither it returns null.
- `npm run typecheck`, `npm test` and `npm run build` must pass.
- Screenshots with the `PHINAS_SHOT` helper: Beranda with the right panel closed and open (the narrow case), and Berdua. Check by eye that tiles do not overflow, nothing scrolls sideways, and the floating player does not cover the last row.
- Manual, with the real account: the Berdua tile actions on Home, and the light theme.

## Not changing
The sidebar, the floating player, the right panel and its lyrics, the notch, Search, Disukai, Riwayat, the playlist screens, all data loading and IPC.

## Risks
- Rows that lose one tile change shape as data arrives (for example trending loads after history). The placeholder rows in Lagi tren keep row 3 stable while loading.
- Long titles in the 4×2 grid need ellipsis to keep tiles from growing.
