# Bento Home and Berdua Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal shelves on Beranda and Berdua with a bento grid of fixed-size tiles that never scroll sideways.

**Architecture:** A small `Bento.tsx` module gives rows (`BentoRow`), tile frames (`Tile`) and track lists (`TrackRows`). Home is rebuilt from tiles: Lanjutkan, Berdua (or Disukai), Putar lagi, Pilihan untukmu, Lagi tren and Playlist. Berdua shows the existing listen card and a grid of the partner's playlists. Layout is plain CSS grid plus a container query on the main area for narrow widths.

**Tech Stack:** React 19, TypeScript, plain CSS, lucide-react, vitest. No UI test framework exists, so the UI is verified with typecheck, the build and screenshots from the `PHINAS_SHOT` helper.

Spec: `docs/superpowers/specs/2026-11-17-bento-home-design.md`. Branch: `feat/v1`.

Paths below are under `src/renderer/src/` unless they start with `tests/`, `docs/` or `src/`.

## Before you start

- The working tree may hold unrelated uncommitted work (notch hide/show, menu bar icon, sidebar wordmark), including changes in `styles.css`. Ask the user to commit or set it aside first. Every commit in this plan stages only the files it names, so nothing else is swept in.
- The project has no Prettier config. If you format, use the house style: `npx prettier --single-quote --no-semi --print-width 140 --trailing-comma none --write <files>`. Never run Prettier on files you did not create.

## Screenshot helper (Task 6)

```bash
SCRATCH=/private/tmp/claude-501/-Users-mac--claude-spares-spare-63NzXp/cffabb30-372a-4fc4-95e3-4b8538e4a1d3/scratchpad
cd /Users/mac/Dev/phinas-desktop && rm -f $SCRATCH/shot.png
(PHINAS_SHOT=$SCRATCH/shot.png PHINAS_SHOT_PROFILE=$SCRATCH/profile PHINAS_SHOT_DELAY=6000 \
  PHINAS_SHOT_SCRIPT=$SCRATCH/click.js npx electron-vite dev > $SCRATCH/shot.log 2>&1 &)
for i in $(seq 1 90); do [ -f $SCRATCH/shot.png ] && break; sleep 1; done; sleep 1; ls -la $SCRATCH/shot.png
pkill -f "electron-vite dev"
```

Leave out `PHINAS_SHOT_SCRIPT` for a plain screenshot. Open `$SCRATCH/shot.png` with the Read tool. The screenshot profile is not signed in, so the listen-together tile never appears there (you get the Disukai tile instead).

## File structure

| File | Change |
|---|---|
| `screens/home/continue.ts` | create: `continueTrack()`, picks the Lanjutkan track |
| `tests/continue.test.ts` | create: tests for `continueTrack` |
| `components/Bento.tsx` | create: `BentoRow`, `Tile`, `TrackRows` |
| `components/ListenCard.tsx` | `compact` and `onOpen` props |
| `screens/Home.tsx` | rebuilt from tiles |
| `screens/TogetherView.tsx` | partner playlist grid |
| `components/PartnerShelf.tsx` | delete |
| `styles.css` | bento section appended |

---

### Task 1: `continueTrack`

**Files:**
- Create: `src/renderer/src/screens/home/continue.ts`
- Test: `tests/continue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/continue.test.ts
import { describe, expect, test } from 'vitest'
import { continueTrack } from '../src/renderer/src/screens/home/continue'
import type { Track } from '../src/shared/types'

const t = (id: string): Track => ({ videoId: id, title: id, artist: 'A', coverUrl: '', durationSec: 200 })

describe('continueTrack', () => {
  test('the current track wins', () => {
    expect(continueTrack(t('now'), [t('old')])).toEqual({ track: t('now'), isCurrent: true })
  })
  test('without a current track, the most recent play', () => {
    expect(continueTrack(null, [t('a'), t('b')])).toEqual({ track: t('a'), isCurrent: false })
  })
  test('nothing to continue', () => {
    expect(continueTrack(null, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run tests/continue.test.ts`
Expected: FAIL, the module `continue` cannot be found.

- [ ] **Step 3: Implement**

```ts
// src/renderer/src/screens/home/continue.ts
import type { Track } from '../../../../shared/types'

export interface ContinuePick {
  track: Track
  /** True when it is the loaded track, so the button pauses and resumes instead of restarting. */
  isCurrent: boolean
}

/** What the Lanjutkan tile shows: the loaded track, else the most recent play, else nothing. */
export function continueTrack(current: Track | null, recent: Track[]): ContinuePick | null {
  if (current) return { track: current, isCurrent: true }
  if (recent.length > 0) return { track: recent[0], isCurrent: false }
  return null
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run tests/continue.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/continue.test.ts src/renderer/src/screens/home/continue.ts
git commit -m "feat(home): pick the track for the Lanjutkan tile"
```

---

### Task 2: Bento building blocks and their styles

**Files:**
- Create: `components/Bento.tsx`
- Modify: `styles.css` (append)

- [ ] **Step 1: Write the components**

```tsx
// components/Bento.tsx
import { Children, type ReactNode } from 'react'
import type { Track } from '../../../shared/types'

/**
 * One row of the bento grid. Pass tiles conditionally (`{cond && <Tile …/>}`): a tile left out is
 * dropped, and when only one tile is left it takes the whole row.
 */
export function BentoRow({ children }: { children: ReactNode }): React.JSX.Element | null {
  const tiles = Children.toArray(children)
  if (tiles.length === 0) return null
  return <div className={`bento-row${tiles.length === 1 ? ' single' : ''}`}>{tiles}</div>
}

interface TileProps {
  /** Columns out of 12 when the row has two tiles. */
  span: 4 | 6 | 8
  title?: string
  /** Makes the title a link (for example "Putar lagi" opens Riwayat). */
  onTitle?: () => void
  className?: string
  children: ReactNode
}

export function Tile({ span, title, onTitle, className, children }: TileProps): React.JSX.Element {
  return (
    <section className={`tile span-${span}${className ? ` ${className}` : ''}`}>
      {title &&
        (onTitle ? (
          <button className="tile-title" onClick={onTitle}>
            {title}
          </button>
        ) : (
          <h3 className="tile-title">{title}</h3>
        ))}
      {children}
    </section>
  )
}

/** Tracks as rows (cover, title, artist), optionally numbered. Clicking a row plays from it. */
export function TrackRows({
  tracks,
  numbered,
  onPlay
}: {
  tracks: Track[]
  numbered?: boolean
  onPlay: (index: number) => void
}): React.JSX.Element {
  return (
    <ol className="track-rows">
      {tracks.map((t, i) => (
        <li key={`${t.videoId}-${i}`}>
          <button className="track-row" onClick={() => onPlay(i)}>
            {numbered && <span className="track-row-n">{i + 1}</span>}
            <span className="queue-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
            <span className="queue-text">
              <span className="queue-name">{t.title}</span>
              <span className="muted queue-artist">{t.artist}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 2: Append the styles**

Append to `styles.css` (the `@container` block must stay last, so it wins over the rules above it):

```css

/* ---------- bento (Beranda, Berdua) ---------- */
.main { container-type: inline-size; }
.bento-row { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
.bento-row > .span-4 { grid-column: span 4; }
.bento-row > .span-6 { grid-column: span 6; }
.bento-row > .span-8 { grid-column: span 8; }
.bento-row.single > * { grid-column: 1 / -1; }
.tile { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 18px; border-radius: 20px; background: var(--glass); border: 1px solid var(--line); }
.tile-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.01em; }
button.tile-title { align-self: flex-start; padding: 0; text-align: left; }
button.tile-title:hover { text-decoration: underline; }
.tile > .pill-btn { align-self: flex-start; display: flex; align-items: center; gap: 6px; }
.track-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.track-row { width: 100%; justify-content: flex-start; gap: 12px; padding: 6px; border-radius: 10px; text-align: left; }
.track-row:hover { background: var(--hover); }
.track-row-n { width: 18px; flex: none; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--muted); }
.track-row.skeleton { height: 52px; background: var(--hover); animation: skeleton 1.2s ease-in-out infinite alternate; }
@keyframes skeleton { from { opacity: 0.45; } to { opacity: 1; } }

.continue { flex-direction: row; align-items: center; gap: 22px; min-height: 220px; }
.continue.empty { flex-direction: column; align-items: flex-start; justify-content: center; }
.continue-cover { width: 168px; height: 168px; flex: none; border-radius: 16px; background: var(--hover) center / cover; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.4); }
.continue-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.continue-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.continue-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.continue-play { align-self: flex-start; margin-top: 14px; width: 54px; height: 54px; border-radius: 50%; justify-content: center; background: var(--accent); color: #fff; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35); transition: transform 0.15s, background 0.5s; }
.continue-play:hover { transform: scale(1.06); }

.liked-tile { align-items: flex-start; justify-content: space-between; text-align: left; color: #fff; border: 0; background: linear-gradient(135deg, #4c1d95, var(--accent)); }
.liked-tile-text { display: flex; flex-direction: column; gap: 2px; }

.cover-stack { position: relative; height: 92px; }
.cover-stack span { position: absolute; top: 0; width: 84px; height: 84px; border-radius: 12px; background: var(--hover) center / cover; border: 2px solid var(--bg); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35); }
.cover-stack span:nth-child(1) { left: 0; z-index: 3; transform: rotate(-6deg); }
.cover-stack span:nth-child(2) { left: 44px; z-index: 2; transform: rotate(2deg); }
.cover-stack span:nth-child(3) { left: 88px; z-index: 1; transform: rotate(8deg); }

.pick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pick { justify-content: flex-start; gap: 10px; min-width: 0; padding: 6px; border-radius: 10px; text-align: left; }
.pick:hover { background: var(--hover); }
.pick .queue-thumb { width: 48px; height: 48px; }
.pl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }

.bento-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.bento-cards .mcard { width: auto; }
.bento-cards .mcard-play { top: auto; bottom: 76px; }

@container (max-width: 1000px) {
  .pick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 760px) {
  .bento-row > * { grid-column: 1 / -1; }
  .bento-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (nothing imports `Bento.tsx` yet).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/Bento.tsx src/renderer/src/styles.css
git commit -m "feat(ui): bento rows, tiles and track rows"
```

(If `styles.css` also holds someone else's uncommitted change, stop and ask before committing: see "Before you start".)

---

### Task 3: Compact listen card

**Files:**
- Modify: `components/ListenCard.tsx`, `styles.css`

- [ ] **Step 1: Props**

Replace

```tsx
export function ListenCard(): React.JSX.Element | null {
```

with

```tsx
interface Props {
  /** The Home tile: stacked, smaller, and sized as a 4-column bento tile. */
  compact?: boolean
  /** Makes the title a link (Home opens the Berdua screen). */
  onOpen?: () => void
}

export function ListenCard({ compact = false, onOpen }: Props = {}): React.JSX.Element | null {
```

- [ ] **Step 2: Markup**

Replace the returned `<section>` (from `<section className={`listen-card` down to its closing `</section>`) with:

```tsx
    <section className={`listen-card${compact ? ' compact span-4' : ''}${status === 'active' ? ' live' : ''}`}>
      <Headphones size={compact ? 22 : 28} className="listen-card-icon" />
      <div className="listen-card-text">
        <div className="listen-card-line">{line}</div>
        {onOpen ? (
          <button className="listen-card-title link" onClick={onOpen}>
            {title}
          </button>
        ) : (
          <div className="listen-card-title">{title}</div>
        )}
      </div>
      <div className="listen-card-actions">{actions}</div>
    </section>
```

- [ ] **Step 3: Styles**

Append to `styles.css`, directly **above** the `@container (max-width: 1000px)` line added in Task 2 (the container queries must stay last):

```css
.listen-card.compact { flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 12px; margin: 0; padding: 18px; }
.listen-card.compact .listen-card-title { font-size: 17px; }
.listen-card-title.link { padding: 0; color: inherit; text-align: left; }
.listen-card-title.link:hover { text-decoration: underline; }
```

- [ ] **Step 4: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors (existing `<ListenCard />` calls still work because the props are optional).

```bash
git add src/renderer/src/components/ListenCard.tsx src/renderer/src/styles.css
git commit -m "feat(ui): compact listen card for the Home tile"
```

---

### Task 4: Home from tiles

**Files:**
- Modify: `screens/Home.tsx` (replace the whole file)

- [ ] **Step 1: Replace `screens/Home.tsx`**

```tsx
import { Heart, Pause, Play, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { BentoRow, Tile, TrackRows } from '../components/Bento'
import { ListenCard } from '../components/ListenCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav, View } from '../views'
import { continueTrack } from './home/continue'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** The big tile: the loaded track, or the last one played. */
function ContinueTile({ recent }: { recent: Track[] }): React.JSX.Element {
  const player = usePlayer()
  const pick = continueTrack(player.track, recent)
  if (!pick) {
    return (
      <Tile span={8} className="continue empty">
        <span className="continue-title">Cari lagu untuk mulai</span>
        <button className="pill-btn" onClick={() => player.run('focusSearch')}>
          <Search size={16} /> Cari lagu
        </button>
      </Tile>
    )
  }
  const { track, isCurrent } = pick
  const playing = isCurrent && player.playing
  return (
    <Tile span={8} className="continue">
      <div className="continue-cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
      <div className="continue-text">
        <span className="muted continue-label">{isCurrent ? 'Sedang diputar' : 'Lanjutkan'}</span>
        <span className="continue-title">{track.title}</span>
        <span className="muted">{track.artist}</span>
        <button
          className="continue-play"
          onClick={() => (isCurrent ? player.toggle() : player.play(recent, 0))}
          aria-label={playing ? 'Jeda' : 'Putar'}
        >
          {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
      </div>
    </Tile>
  )
}

/** Listen-together when signed in with a partner, otherwise the liked songs. */
function TogetherTile({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  if (listen.available) return <ListenCard compact onOpen={() => nav({ name: 'together' })} />
  return (
    <button className="tile span-4 liked-tile" onClick={() => nav({ name: 'liked' })}>
      <Heart size={28} fill="currentColor" />
      <span className="liked-tile-text">
        <span className="tile-title">Lagu yang disukai</span>
        <span>{lib.likes.length} lagu</span>
      </span>
    </button>
  )
}

function PickGrid({ tracks }: { tracks: Track[] }): React.JSX.Element {
  const player = usePlayer()
  return (
    <div className="pick-grid">
      {tracks.map((t, i) => (
        <button key={`${t.videoId}-${i}`} className="pick" onClick={() => player.play(tracks, i)}>
          <span className="queue-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
          <span className="queue-text">
            <span className="queue-name">{t.title}</span>
            <span className="muted queue-artist">{t.artist}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Up to four playlists, own first, then the partner's. */
function PlaylistTile({ nav }: { nav: Nav }): React.JSX.Element {
  const lib = useLibrary()
  const items: { key: string; covers: string[]; name: string; sub: string; view: View }[] = [
    ...lib.playlists.map((p) => ({ key: p.id, covers: p.coverUrls, name: p.name, sub: 'Playlist', view: { name: 'playlist', id: p.id } as View })),
    ...lib.partner.map((p) => ({
      key: `partner-${p.id}`,
      covers: p.coverUrls,
      name: p.name,
      sub: p.ownerName,
      view: { name: 'partner', id: p.id } as View
    }))
  ].slice(0, 4)

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <Tile span={6} title="Playlist">
      {items.length === 0 ? (
        <>
          <p className="muted">Buat playlist pertamamu.</p>
          <button className="pill-btn" onClick={() => void create()}>
            <Plus size={16} /> Buat playlist
          </button>
        </>
      ) : (
        <div className="pl-grid">
          {items.map((p) => (
            <button key={p.key} className="lib-row" onClick={() => nav(p.view)}>
              <PlaylistCover covers={p.covers} size={48} />
              <span className="lib-row-text">
                <span className="lib-row-title">{p.name}</span>
                <span className="muted lib-row-sub">{p.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Tile>
  )
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[]>([])
  const [forYou, setForYou] = useState<Track[]>([])

  useEffect(() => {
    window.phinas.listRecentPlays(20).then(setRecent).catch(() => setRecent([]))
    // With no history yet, or when the request fails, the feed's picks are the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setForYou(r.personalized ? r.tracks : []))
      .catch(() => setForYou([]))
  }, [])

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const picks = forYou.length > 0 ? forYou : (feed?.picks ?? [])
  // Kept while loading (placeholder rows) and on failure (the error line); hidden only when empty.
  const showTrending = !feed || feed.trending.length > 0

  return (
    <>
      <h2 className="page-title">{name ? `${greeting()}, ${name}` : greeting()}</h2>

      <BentoRow>
        <ContinueTile recent={recent} />
        <TogetherTile nav={nav} />
      </BentoRow>

      <BentoRow>
        {recent.length > 0 && (
          <Tile span={4} title="Putar lagi" onTitle={() => nav({ name: 'recent' })}>
            <div className="cover-stack" aria-hidden="true">
              {recent.slice(0, 3).map((t, i) => (
                <span key={`${t.videoId}-${i}`} style={{ backgroundImage: `url("${t.coverUrl}")` }} />
              ))}
            </div>
            <TrackRows tracks={recent.slice(0, 4)} onPlay={(i) => player.play(recent, i)} />
          </Tile>
        )}
        {picks.length > 0 && (
          <Tile span={8} title="Pilihan untukmu">
            <PickGrid tracks={picks.slice(0, 8)} />
          </Tile>
        )}
      </BentoRow>

      <BentoRow>
        {showTrending && (
          <Tile span={6} title="Lagi tren">
            {feed ? (
              <TrackRows numbered tracks={feed.trending.slice(0, 5)} onPlay={(i) => player.play(feed.trending, i)} />
            ) : feedFailed ? (
              <p className="muted">Tidak bisa memuat yang lagi tren. Cek koneksi internetmu.</p>
            ) : (
              <div className="track-rows" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="track-row skeleton" />
                ))}
              </div>
            )}
          </Tile>
        )}
        <PlaylistTile nav={nav} />
      </BentoRow>
    </>
  )
}
```

- [ ] **Step 2: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: no errors; all tests PASS (227 including the 3 from Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Home.tsx
git commit -m "feat(home): bento tiles instead of shelves"
```

---

### Task 5: Berdua grid, remove `PartnerShelf`

**Files:**
- Modify: `screens/TogetherView.tsx` (replace the whole file)
- Delete: `components/PartnerShelf.tsx`

- [ ] **Step 1: Replace `screens/TogetherView.tsx`**

```tsx
import { ListenCard } from '../components/ListenCard'
import { MediaCard } from '../components/MediaCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  const player = usePlayer()
  return (
    <>
      <h2 className="page-title">Berdua</h2>
      {listen.available ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
      {lib.partner.length > 0 && (
        <section className="bento-cards" aria-label="Playlist pasangan">
          {lib.partner.map((p) => (
            <MediaCard
              key={p.id}
              art={<PlaylistCover covers={p.coverUrls} />}
              title={p.name}
              subtitle={p.ownerName}
              onOpen={() => nav({ name: 'partner', id: p.id })}
              onPlay={() => p.tracks.length && player.play(p.tracks, 0)}
            />
          ))}
        </section>
      )}
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
```

- [ ] **Step 2: Delete the shelf and check nothing else uses it**

```bash
git rm src/renderer/src/components/PartnerShelf.tsx
grep -rn "PartnerShelf" src
```

Expected: `grep` prints nothing.

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/renderer/src/screens/TogetherView.tsx
git commit -m "feat(ui): partner playlists as a grid on Berdua"
```

---

### Task 6: Full check and screenshots

- [ ] **Step 1: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests PASS, build succeeds.

- [ ] **Step 2: Beranda, panel closed**

Take a plain screenshot (helper above, without `PHINAS_SHOT_SCRIPT`). Expected:
- Row 1: a wide Lanjutkan tile (or "Cari lagu untuk mulai" on an empty profile) next to the purple Disukai tile.
- Row 2: Putar lagi (fanned covers and 4 rows) next to Pilihan untukmu (4×2 grid). If the profile has no history, Pilihan untukmu fills the row alone.
- Row 3: Lagi tren (numbered 1–5) next to Playlist.
- No ‹ › arrows, no sideways scroll, and no tile wider than the main area.

- [ ] **Step 3: Beranda, panel open (narrow case)**

Write `$SCRATCH/click.js` containing exactly:

```js
document.querySelector('[aria-label="Tampilkan panel sedang diputar"]').click()
```

Take the screenshot with `PHINAS_SHOT_SCRIPT` set. Expected: each tile takes the full width of the narrowed main area; Pilihan untukmu shows 2 columns.

- [ ] **Step 4: Berdua**

Write `$SCRATCH/click.js` containing exactly:

```js
[...document.querySelectorAll('.sb-item')].find((b) => b.textContent.includes('Berdua')).click()
```

Take the screenshot. Expected: the "Masuk di Profil…" line (the profile is not signed in) and no shelf arrows.

- [ ] **Step 5: Manual checks for the user (real account)**

- [ ] The Home Berdua tile shows the partner status; Ajak / Batalkan / Terima / Tolak / Akhiri work, and clicking its title opens Berdua.
- [ ] The partner playlist grid on Berdua opens and plays playlists.
- [ ] Light theme (Profil): tiles and text stay readable.
- [ ] The floating player does not cover the last row when scrolled to the bottom.

---

## Self-review

**Spec coverage:** grid, single-tile rows and container query: Task 2. Lanjutkan with its three states: Tasks 1 and 4. Berdua tile and Disukai fallback: Tasks 3 and 4. Putar lagi, Pilihan untukmu, Lagi tren (placeholders, error line), Playlist (own then partner, create button): Task 4. Berdua grid and `PartnerShelf` removal: Task 5. Testing section: Tasks 1 and 6. `Shelf` and `MediaCard` stay for Search and public playlists: not touched.

**Placeholders:** none; every code step has the full code.

**Type consistency:** `continueTrack(current, recent)` returns `ContinuePick | null` (Task 1), used the same way in Task 4. `Tile` takes `span: 4 | 6 | 8` and is called with 4, 6 and 8 only. `ListenCard({ compact, onOpen })` (Task 3) matches its call in Task 4; the call in Task 5 passes no props. `TrackRows({ tracks, numbered, onPlay })` (Task 2) matches both calls in Task 4.
