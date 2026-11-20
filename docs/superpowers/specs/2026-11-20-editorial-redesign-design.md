# Editorial redesign (sub-project C1): design

Date: 2026-11-20
Status: approved in brainstorming, written spec for review

## Goal
Phinas still reads as Spotify after the 2026-11-17 passes (sidebar, floating pill player, bento Home), because the visual language stayed the same: dark glass cards, purple accent, cover grids. C1 gives Phinas its own look, "editorial warm": a paper-like page, a serif for titles, thin rules instead of cards, and a soft wash of the current song's color at the top of every page. Home becomes quiet; the busy content moves to a new Jelajah page.

Part of phase C (see `2026-11-20-multi-user-design.md`, Roadmap):
- **C1 (this spec):** design language, app frame, Home, Jelajah, restyle of every existing screen.
- **C2:** social screens (sign-up/login, friends, friend codes, requests, partner, invites, playlist visibility, Listen Together scope, public playlists) built in this language.
- **C3:** offline-first behaviour.

Mockups from the brainstorming session are in `.superpowers/brainstorm/24437-1795162331/content/` (visual-direction-v2, dynamic-color, home-combined, typography, inner-pages).

## Decisions
- **Direction:** editorial warm (option A), keeping the colour that follows the song or the chosen mood.
- **Dynamic colour strength:** "kertas berbayang warna": a wash of the cover colour at the top of the page fading into the paper, plus an accent for small things.
- **Modes:** Siang (paper) and Malam (ink), both editorial. Default follows the OS; can be forced in Profil. The old Dynamic/Dark/Light themes go away.
- **Type:** Newsreader (serif) for titles, lyrics and big numbers; Montserrat (sans) for UI. Both bundled with `@fontsource`.
- **Home:** cover story (continue the last song) + one Berdua line + two short text lists (Untukmu, Lagi ramai). Everything else moves to **Jelajah**.
- **Approach:** design tokens first, then restyle area by area. React component structure, player logic, sync, IPC and the notch's behaviour stay.

## 1. Tokens and theme

### Modes
- Profil offers *Ikuti sistem* (default), *Siang*, *Malam*. Stored in `localStorage` key `phinas.theme` as `system | day | night`. Old values migrate on read: `light` → `day`, `dark` → `night`, `dynamic` → `system`.
- `<html data-theme="day|night">`. With `system`, the value follows `matchMedia('(prefers-color-scheme: dark)')` and updates live when the OS switches.
- The notch receives the resolved `day | night` in `NotchState.theme` (type changes from `'dynamic' | 'dark' | 'light'`). The notch stays a dark pill in both; it only uses the accent and the serif.

### Base tokens (`src/renderer/src/theme/tokens.css`)

| Token | Siang | Malam | Use |
|---|---|---|---|
| `--paper` | `#f4efe6` | `#1c1714` | page background |
| `--ink` | `#2a2420` | `#efe4d4` | main text |
| `--ink-soft` | `#5a4f45` | `#9a8b7b` | secondary text |
| `--ink-faint` | `#b9ab9a` | `#5e5145` | numbers, placeholders |
| `--line` | `#e2d8c8` | `#352c25` | rules and borders |
| `--online` | `#5aa36b` | `#7cc28b` | online dot |

`--serif: 'Newsreader', Georgia, serif`; `--sans: 'Montserrat', system-ui, sans-serif`.
Type scale: page title 44 px serif (line-height 0.95), section title 18 px serif italic, label 10 px sans uppercase with 3 px letter-spacing, body 13 px sans, small 11 px sans.

### Dynamic colour
Source: the current cover's dominant colour (`dominantColor` in `theme/color.ts`, existing) or the active mood's colour (existing `moodColors`), the mood winning while set.
- `--accent`: the source colour adjusted to a contrast ratio of at least 4.5:1 against `--paper` (darkened for Siang, lightened for Malam), keeping its hue.
- `--on-accent`: `#fff` or `--paper`, whichever has the higher contrast on `--accent`.
- `--wash`: the source colour mixed into the paper, 25% for Siang and 30% for Malam. Pages use `background: linear-gradient(180deg, var(--wash) 0%, var(--paper) 45%)`.
- Without a source: accent `#9c4526` (Siang) / `#e7a46c` (Malam), wash from the same terracotta.
- Changes animate over 600 ms (`transition` on the custom properties registered with `@property`).
- New pure functions in `theme/color.ts`: `contrastRatio(a, b)`, `accentFor(source, mode)`, `washFor(source, mode)`, `onAccent(accent)`. They replace `accentVars`.

## 2. App frame

### Sidebar (220 px, `--paper`, 1 px `--line` on the right)
- Wordmark *phinas* (serif italic 22 px). It is the window drag region and keeps the macOS traffic-light padding.
- Search box: 1 px `--line` border, fully rounded, no glass. The recent-searches dropdown stays (restyled: paper, rule-separated rows).
- Navigation: Beranda, Jelajah, Berdua, Disukai, Riwayat. Active item: `--ink` bold with a 6 px `--accent` dot before it; others `--ink-soft`. Berdua shows the `--online` dot when the partner is online.
- `PLAYLIST` label with the + and import buttons, then own playlists as text rows (no covers), then a `DARI PASANGAN` group (renamed `DARI TEMAN` in C2).
- Footer: the avatar button to Profil.

### Bottom player (56 px, under the content columns, `--paper`, 1 px `--line` on top)
- Left: 36 px cover, title (sans bold), artist (`--ink-soft`), like button. Clicking cover or title toggles the right panel.
- Centre: shuffle, previous, play (34 px circle in `--accent`, icon `--on-accent`), next, repeat; under them a 2 px progress line in `--accent` on `--line` with times.
- Right: Listen Together, right-panel toggle, volume.
- The floating pill and the 120 px bottom padding on content go away.

### Right panel (300 px, own `--wash` gradient, 1 px `--line` on the left)
Opens on demand or automatically during a Listen Together session (unchanged behaviour). Text tabs `LIRIK · ANTREAN` (label style, active in `--accent`). Lyrics in serif 19 px, the active line 24 px italic `--ink`, others `--ink-faint`. The session block ("Bareng *Nadia* · tersambung", Akhiri) sits on top.

### Removed
The blurred cover background (`.ambient`) and all glass variables (`--glass`, `--glass-strong`, blur). No box shadows except on large covers (one soft shadow).

## 3. Home
Top to bottom, all on the page wash:
1. **Label:** `{HARI} {BAGIAN HARI} · UNTUK {NAMA}` (e.g. `KAMIS SORE · UNTUK RAFI`), in `--accent`. Day part: pagi < 11, siang < 15, sore < 18, malam otherwise. Name from the local profile name; without one, `UNTUKMU`.
2. **Cover story:** 170 px cover with a soft shadow, beside it a 44 px serif title "Lanjutkan" and, on the next line, the track title in italic `--accent` followed by a period; then the artist and a ▶ Putar button. (Tracks carry no album, so no album line.) Uses the existing `continueTrack(current, recent)`. Current track: the button toggles play/pause and reads "Jeda" while playing. Otherwise it plays the recent list from that track. With no current track and no history: title "Mulai dari *sini.*", text "Cari lagu atau buka Jelajah", buttons Cari (focuses the search box) and Jelajah.
3. **Berdua line** (between two `--line` rules), only when signed in with a partner: online dot, partner name, "sedang online" or "offline", and on the right the Listen Together action of the current state (Ajak dengar bareng / Batalkan / Terima · Tolak / Akhiri), as a text link in `--accent`. Clicking the name opens Berdua. Not shown otherwise.
4. **Two lists side by side** (one column when the content is narrower than 760 px):
   - *Untukmu*: 4 tracks from personal recommendations, or the feed's picks when there are none.
   - *Lagi ramai*: the top 4 trending tracks.
   Each row: number (`01`, serif `--ink-faint`), "Title — Artist". Clicking a row plays that list from the row. Section titles are serif italic and open Jelajah. While loading: 4 placeholder rows; on failure: the existing error line.

Removed from Home: Putar lagi, Playlist tile, Rilis baru, genres, videos, favourite artists.

## 4. Jelajah (new view `{ name: 'explore' }`)
Page title "Jelajah" (serif), then sections separated by rules, each with a serif italic title:
1. **Mood & genre:** the feed's genres as text pills (1 px border, rounded); clicking one opens the genre view (and sets the mood colours, as today).
2. **Lagi ramai:** top 10 trending as numbered rows (number, 36 px cover, title, artist, duration); "Lihat semua" opens the full chart playlist when `trendingId` exists.
3. **Rilis baru:** up to 8 releases in a 4-column grid (square cover, title, "Album • 2026" line); opens the album.
4. **Artis favoritmu** (only with history): up to 6 artists as rows (cover of their top track, name, number of plays); opens the artist view.
5. **Video baru:** up to 6 videos as numbered rows, played as audio.
Loading and error states per section like today. Public playlists of friends join this page in C2.

## 5. Every other screen
One shared pattern, applied to Search, Disukai, Riwayat, Playlist, Playlist pasangan, Playlist publik, Artis, Album, Genre, Import, Berdua and Profil:
- **Collection header** (`CollectionHeader`): 130 px cover (playlists keep the 2×2 mosaic), a label line (`PLAYLIST`, `ALBUM • 2021`, `ARTIS`, …), a 46 px serif title whose last word is italic `--accent`, a meta line, then the primary button (filled `--accent`) and secondary buttons (1 px `--ink` outline, rounded).
- **Track list** (`TrackRow`): a header row of labels (`NO · JUDUL · DURASI`; tracks carry no album) above a 1 px `--ink` rule; rows separated by `--line`; number in serif `--ink-faint`; title bold, artist `--ink-soft` under it; the playing row shows ▶ and its title in `--accent` on a faint accent gradient. Hover: a faint `--line` background.
- **Grids** of covers (artist releases, search playlists): square covers without rounded corners or cards, title and meta under each.
- **Profil:** sections become rule-separated with serif titles; the theme choice becomes Ikuti sistem / Siang / Malam. Account and Notch sections keep their content (C2 rebuilds the account part).
- `MediaCard`, `Shelf` and the bento components (`Bento.tsx`) are removed once nothing uses them.

## 6. Files
- Create: `theme/tokens.css`, `theme/mode.ts` (stored mode, system listener, migration of old values), `screens/Explore.tsx`, `components/BerduaLine.tsx`, `components/NumberedList.tsx` (the numbered text list used by Home and Jelajah).
- Split `styles.css` by area: `styles/base.css` (reset, type, buttons), `styles/frame.css` (sidebar, player, right panel), `styles/lists.css` (track rows, headers, grids), `styles/home.css`, `styles/explore.css`, `styles/profile.css`. `main.tsx` imports them in that order.
- Modify: `theme/useTheme.ts` (modes), `theme/color.ts` (contrast functions), `App.tsx`, `views.ts` (add `explore`), `components/Sidebar.tsx`, `components/PlayerBar.tsx`, `components/NowPlaying.tsx`, `components/LyricsPanel.tsx`, `components/CollectionHeader.tsx`, `components/TrackRow.tsx`, `components/SearchBox.tsx`, `components/ListenCard.tsx`, `screens/Home.tsx` and every screen listed in section 5, `notch/Notch.tsx` + `notch.css` (serif, accent, `day | night`), `shared/types.ts` (`NotchState.theme`).
- Fonts: add `@fontsource/newsreader` (weights 400, 600; italic 400).
- Delete when unused: `components/Bento.tsx`, `components/Shelf.tsx`, `components/MediaCard.tsx`.

## 7. Testing
- Vitest: `contrastRatio`, `accentFor` (every output ≥ 4.5:1 on its paper for a spread of source colours, hue kept), `washFor`, `onAccent`, mode migration and resolution (`system` + OS dark → `night`), day-part label, Home's empty/continue selection (existing `continueTrack` tests stay).
- `npm run typecheck` and `npm test` clean.
- Visual check: the dev screenshot mode (`src/main/dev-shot.ts`, `PHINAS_SHOT`) captures Home, Jelajah, a playlist, Search and Profil in Siang and Malam with two different covers; the user reviews them, plus a live run.

## Out of scope
Social screens (C2), offline behaviour (C3), mobile, new features beyond the Jelajah page, changes to the notch's layout or motion, the download site.
