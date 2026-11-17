# Less Spotify UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the desktop UI so it no longer mirrors Spotify's layout, while keeping Phinas's colors, fonts and themes.

**Architecture:** Replace the top bar and Library panel with one sidebar (brand, search, nav, playlists, profile). Make the right panel optional. Flatten the four floating cards into one surface. Turn the player bar into a floating pill centered over the content columns. Add a "Berdua" screen and a listen-together card that Home also uses.

**Tech Stack:** React 19, TypeScript, plain CSS, lucide-react. No UI test framework exists, so verification is typecheck, the existing tests, the build, and screenshots from the built-in `PHINAS_SHOT` helper.

Spec: `docs/superpowers/specs/2026-11-17-less-spotify-ui-design.md`. Branch: `feat/v1`.

All paths below are under `src/renderer/src/` unless they start with `docs/`.

## Screenshot helper (used by Tasks 3, 5 and 6)

The app is not signed in inside the screenshot profile, so the listen-together card and the Berdua dot cannot appear there. Check those by reading the code and, later, with the real account.

```bash
SCRATCH=/private/tmp/claude-501/-Users-mac-Dev-phinas-desktop/459deae7-f65e-4c8b-aa26-ebe09f8614f5/scratchpad
rm -f $SCRATCH/shot.png
(PHINAS_SHOT=$SCRATCH/shot.png PHINAS_SHOT_PROFILE=$SCRATCH/profile PHINAS_SHOT_DELAY=6000 \
  PHINAS_SHOT_SCRIPT=$SCRATCH/click.js npx electron-vite dev > $SCRATCH/shot.log 2>&1 &)
for i in $(seq 1 60); do [ -f $SCRATCH/shot.png ] && break; sleep 1; done; ls -la $SCRATCH/shot.png
```

`click.js` is a one-line script run inside the page (omit `PHINAS_SHOT_SCRIPT` for a plain screenshot). Then open `$SCRATCH/shot.png` with the Read tool and look at it.

## File structure

| File | Change |
|---|---|
| `views.ts` | add `{ name: 'together' }` |
| `sync/status.ts` | create: `liveLabel()` shared status text |
| `components/ListenTogether.tsx` | use `liveLabel` |
| `components/ListenCard.tsx` | create: the card for Home and Berdua |
| `components/PartnerShelf.tsx` | create: "Dari pasangan" shelf shared by Home and Berdua |
| `screens/TogetherView.tsx` | create: the Berdua screen |
| `components/SearchBox.tsx` | create: search pill and dropdown, moved out of `TopBar` |
| `components/Sidebar.tsx` | create: replaces `TopBar` and `LibraryPanel` |
| `components/TopBar.tsx`, `components/LibraryPanel.tsx` | delete |
| `App.tsx` | new layout, panel state, `together` route |
| `screens/Home.tsx` | card, greeting with name, no quick-pick grid |
| `components/PlayerBar.tsx` | pill, panel toggle |
| `components/NowPlaying.tsx` | session block |
| `styles.css` | layout, sidebar, pill, card |

---

### Task 1: Shared pieces (route, status text, card, shelf, Berdua screen)

**Files:**
- Modify: `views.ts`, `components/ListenTogether.tsx`, `styles.css`
- Create: `sync/status.ts`, `components/ListenCard.tsx`, `components/PartnerShelf.tsx`, `screens/TogetherView.tsx`

- [ ] **Step 1: Add the route**

In `views.ts` add one line to the `View` union, after `{ name: 'recent' }`:

```ts
  | { name: 'together' }
```

- [ ] **Step 2: Shared status text**

```ts
// sync/status.ts
import type { SessionState } from '../../../shared/sync/session'

/** One line describing how an active session is going. Used by the button, the card and the side panel. */
export function liveLabel(state: Pick<SessionState, 'connected' | 'partnerHere' | 'partnerError'>, name: string): string {
  if (!state.connected) return 'Koneksi terputus'
  if (!state.partnerHere) return `${name} terputus`
  if (state.partnerError) return `${name}: gagal memutar`
  return 'Tersambung'
}
```

In `components/ListenTogether.tsx`, add `import { liveLabel } from '../sync/status'` and replace the block

```tsx
    const label = !connected
      ? 'Koneksi terputus'
      : !partnerHere
        ? `${name} terputus`
        : partnerError
          ? `${name}: gagal memutar`
          : 'Tersambung'
```

with

```tsx
    const label = liveLabel(l.state, name)
```

(`connected`, `partnerHere` and `partnerError` are still used by the idle branch below, so leave the destructuring line alone.)

- [ ] **Step 3: The card**

```tsx
// components/ListenCard.tsx
import { Headphones } from 'lucide-react'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'

/** The listen-together call to action: invite, waiting, live status. Hidden when not signed in. */
export function ListenCard(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'

  let line: string
  let title = 'Dengarkan bareng'
  let actions: React.ReactNode
  if (status === 'active') {
    line = `● ${liveLabel(l.state, name)}`
    title = `Lagi bareng ${name}`
    actions = (
      <button className="listen-card-btn" onClick={l.end}>
        Akhiri sesi
      </button>
    )
  } else if (status === 'inviting') {
    line = 'Ajakan terkirim'
    title = `Menunggu ${name}…`
    actions = (
      <button className="listen-card-btn ghost" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    line = `${name} mengajak kamu`
    actions = (
      <>
        <button className="listen-card-btn" onClick={l.accept}>
          Terima
        </button>
        <button className="listen-card-btn ghost" onClick={l.decline}>
          Tolak
        </button>
      </>
    )
  } else {
    line = !connected ? '● Tidak bisa terhubung' : partnerHere ? `● ${name} online` : `● ${name} sedang offline`
    actions = (
      <button className="listen-card-btn" onClick={l.invite} disabled={!connected || !partnerHere}>
        Ajak
      </button>
    )
  }

  return (
    <section className={`listen-card${status === 'active' ? ' live' : ''}`}>
      <Headphones size={28} className="listen-card-icon" />
      <div className="listen-card-text">
        <div className="listen-card-line">{line}</div>
        <div className="listen-card-title">{title}</div>
      </div>
      <div className="listen-card-actions">{actions}</div>
    </section>
  )
}
```

- [ ] **Step 4: The shared shelf**

```tsx
// components/PartnerShelf.tsx
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'
import { MediaCard } from './MediaCard'
import { PlaylistCover } from './PlaylistCover'
import { Shelf } from './Shelf'

/** The partner's playlists as a shelf. Renders nothing when there are none. */
export function PartnerShelf({ nav }: { nav: Nav }): React.JSX.Element | null {
  const lib = useLibrary()
  const player = usePlayer()
  if (lib.partner.length === 0) return null
  return (
    <Shelf title="Dari pasangan">
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
    </Shelf>
  )
}
```

- [ ] **Step 5: The Berdua screen**

```tsx
// screens/TogetherView.tsx
import { ListenCard } from '../components/ListenCard'
import { PartnerShelf } from '../components/PartnerShelf'
import { useLibrary } from '../library/LibraryProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  return (
    <>
      <h2 className="page-title">Berdua</h2>
      {listen.available ? (
        <ListenCard />
      ) : (
        <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>
      )}
      <PartnerShelf nav={nav} />
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
```

- [ ] **Step 6: Card styles**

Append to `styles.css`:

```css

/* ---------- listen-together card ---------- */
.listen-card { display: flex; align-items: center; gap: 16px; padding: 18px 22px; margin-bottom: 8px; border-radius: 20px; color: #fff; background: linear-gradient(120deg, var(--accent), #c04bd8); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3); transition: background 0.5s; }
.listen-card.live { background: linear-gradient(120deg, #c04bd8, var(--accent)); }
.listen-card-icon { flex: none; opacity: 0.9; }
.listen-card-text { flex: 1; min-width: 0; }
.listen-card-line { font-size: 12px; opacity: 0.9; }
.listen-card-title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
.listen-card-actions { display: flex; gap: 8px; }
.listen-card-btn { height: 38px; padding: 0 20px; border-radius: 19px; background: #fff; color: #1b1233; font-weight: 700; transition: transform 0.15s; }
.listen-card-btn:hover:not(:disabled) { transform: scale(1.04); }
.listen-card-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.listen-card-btn.ghost { background: rgba(255, 255, 255, 0.22); color: #fff; }
```

- [ ] **Step 7: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors (nothing uses the new files yet, except `ListenTogether.tsx`)

```bash
git add src/renderer
git commit -m "feat(ui): listen card, partner shelf and Berdua screen"
```

---

### Task 2: Search box and sidebar

**Files:**
- Create: `components/SearchBox.tsx`, `components/Sidebar.tsx`

- [ ] **Step 1: Move the search into its own component**

This is the search part of `TopBar.tsx` (the `searchwrap` block with its dropdown), unchanged in behavior. The class names `searchwrap` and `searchpill` must stay: the keyboard shortcut for search (`focusSearch`) finds `.searchpill input`.

```tsx
// components/SearchBox.tsx
import { Clock, Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Track } from '../../../shared/types'
import { entryKey, type RecentEntry } from '../search/recent'

interface Props {
  query: string
  onQuery: (q: string) => void
  /** Enter pressed. */
  onSubmit: () => void
  recent: RecentEntry[]
  onForget: (entry: RecentEntry) => void
  onPlayTrack: (track: Track) => void
}

export function SearchBox({ query, onQuery, onSubmit, recent, onForget, onPlayTrack }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking anywhere outside the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const submit = (e: FormEvent): void => {
    e.preventDefault()
    onSubmit()
    setOpen(false)
  }

  const showRecent = open && !query.trim()

  return (
    <form className="searchbox" onSubmit={submit}>
      <div className="searchwrap" ref={wrapRef}>
        <label className="searchpill">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => {
              onQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Cari lagu atau artis"
            aria-label="Cari lagu atau artis"
          />
          {query && (
            <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
              <X size={16} />
            </button>
          )}
        </label>
        {showRecent && (
          <div className="searchdrop">
            <h4>Pencarian terakhir</h4>
            {recent.length === 0 && <p className="muted">Belum ada pencarian.</p>}
            {recent.map((r) => (
              <div key={entryKey(r)} className="recent-item">
                <button
                  type="button"
                  className="recent-main"
                  onClick={() => {
                    if (r.kind === 'track') onPlayTrack(r.track)
                    else onQuery(r.text)
                    setOpen(false)
                  }}
                >
                  {r.kind === 'track' ? (
                    <>
                      <span className="queue-thumb" style={{ backgroundImage: `url("${r.track.coverUrl}")` }} />
                      <span className="queue-text">
                        <span className="queue-name">{r.track.title}</span>
                        <span className="muted queue-artist">Lagu · {r.track.artist}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock size={18} />
                      <span>{r.text}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onForget(r)}
                  aria-label={`Hapus ${r.kind === 'track' ? r.track.title : r.text}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: The sidebar**

```tsx
// components/Sidebar.tsx
import { Download, Heart, History, Home, Plus, Users, type LucideIcon } from 'lucide-react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
import { PlaylistCover } from './PlaylistCover'
import { SearchBox } from './SearchBox'

interface Props {
  view: View
  nav: Nav
  query: string
  onQuery: (q: string) => void
  onSubmit: () => void
  recent: RecentEntry[]
  onForget: (entry: RecentEntry) => void
  onPlayTrack: (track: Track) => void
  /** First letter of the profile name, shown on the profile button. */
  initial: string
}

function NavItem(p: { icon: LucideIcon; label: string; active: boolean; online?: boolean; onClick: () => void }): React.JSX.Element {
  const Icon = p.icon
  return (
    <button className={`sb-item${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <Icon size={20} />
      <span>{p.label}</span>
      {p.online && <span className="sb-dot" role="img" aria-label="Pasangan online" />}
    </button>
  )
}

function PlaylistRow(p: { covers: string[]; title: string; sub: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`lib-row${p.active ? ' active' : ''}`} onClick={p.onClick}>
      <PlaylistCover covers={p.covers} size={40} />
      <span className="lib-row-text">
        <span className="lib-row-title">{p.title}</span>
        <span className="muted lib-row-sub">{p.sub}</span>
      </span>
    </button>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const listen = useListen()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <aside className="sidebar" aria-label="Navigasi">
      <div className="sb-brand">Phinas</div>
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="sb-nav">
        <NavItem icon={Home} label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem
          icon={Users}
          label="Berdua"
          active={view.name === 'together'}
          online={listen.available && listen.state.partnerHere}
          onClick={() => nav({ name: 'together' })}
        />
        <NavItem icon={Heart} label="Disukai" active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem icon={History} label="Riwayat" active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <div className="sb-sep" />
      <div className="sb-section">
        <span>Playlist</span>
        <div className="library-actions">
          <button className="icon-btn" onClick={() => nav({ name: 'import' })} aria-label="Impor dari Spotify" title="Impor dari Spotify">
            <Download size={18} />
          </button>
          <button className="icon-btn" onClick={create} aria-label="Buat playlist" title="Buat playlist">
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="sb-list">
        {lib.playlists.map((p) => (
          <PlaylistRow
            key={p.id}
            covers={p.coverUrls}
            title={p.name}
            sub="Playlist"
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="muted library-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {lib.partner.length > 0 && <div className="sb-group">Dari {lib.partner[0].ownerName}</div>}
        {lib.partner.map((p) => (
          <PlaylistRow
            key={p.id}
            covers={p.coverUrls}
            title={p.name}
            sub={`Playlist · ${p.ownerName}`}
            active={sameView(view, { name: 'partner', id: p.id })}
            onClick={() => nav({ name: 'partner', id: p.id })}
          />
        ))}
      </div>

      <div className="sb-foot">
        <button className={`profile-btn${view.name === 'profile' ? ' active' : ''}`} onClick={() => nav({ name: 'profile' })} aria-label="Profil">
          {initial}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors

```bash
git add src/renderer
git commit -m "feat(ui): sidebar and search box components"
```

---

### Task 3: New layout in `App.tsx` and `styles.css`

**Files:**
- Modify: `App.tsx`, `styles.css`
- Delete: `components/TopBar.tsx`, `components/LibraryPanel.tsx`

- [ ] **Step 1: Check which old CSS classes are still used elsewhere**

Run: `grep -rn "round-btn\|topbar\|className=\"panel\|library-head\|library-title\|library-list" src/renderer/src --include=*.tsx | grep -v "TopBar.tsx\|LibraryPanel.tsx"`
Expected: only `App.tsx` lines (`panel main`, `panel right`, `TopBar`). If anything else appears, keep the matching CSS rule in Step 4.

- [ ] **Step 2: Rewire `App.tsx`**

Imports: remove the `LibraryPanel` and `TopBar` imports. Add:

```ts
import { Sidebar } from './components/Sidebar'
import { TogetherView } from './screens/TogetherView'
import { useListen } from './sync/ListenTogetherProvider'
```

Inside `Shell`, after `const profile = useProfile()` add:

```ts
  const listen = useListen()
  const [panelOpen, setPanelOpen] = useState(false)
  // A session brings the side panel up; the user can still close it afterwards.
  useEffect(() => {
    if (listen.state.status === 'active') setPanelOpen(true)
  }, [listen.state.status])
```

In the `body` switch, add before `case 'import':`:

```tsx
      case 'together':
        return <TogetherView nav={nav} />
```

and change the home case to `return <Home nav={nav} name={profile.name} />`.

Replace everything from `<TopBar` through `<PlayerBar />` (inclusive) in the returned JSX with:

```tsx
      <div className="drag-strip" />
      <Sidebar
        view={view}
        nav={nav}
        query={query}
        onQuery={onQuery}
        onSubmit={() => {
          if (!query.trim()) return
          recents.rememberQuery(query)
          setView({ name: 'search' })
          setSubmitNonce((n) => n + 1)
        }}
        recent={recents.recent}
        onForget={recents.forget}
        onPlayTrack={(t) => {
          recents.rememberTrack(t, '')
          player.play([t], 0)
        }}
        initial={profile.initial}
      />
      <main ref={mainRef} className="main">
        <ListenBanner />
        {player.notice && (
          <div className="notice" onClick={player.dismissNotice} role="status">
            {player.notice}
          </div>
        )}
        {body}
      </main>
      {panelOpen && (
        <aside className="right">
          <NowPlaying onExpandLyrics={() => setLyricsFull(true)} />
        </aside>
      )}
      <PlayerBar panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
```

and change `<div className="app">` to `<div className={`app${panelOpen ? ' with-panel' : ''}`}>`.

(The `notice` block must match what was there before; copy it from the file rather than retyping if it differs.)

- [ ] **Step 3: Delete the old components**

```bash
git rm src/renderer/src/components/TopBar.tsx src/renderer/src/components/LibraryPanel.tsx
```

- [ ] **Step 4: Layout CSS**

In `styles.css`:

(a) Replace the `.app` rule (the block `.app { position: relative; display: grid; ... }`) with:

```css
.app {
  position: relative;
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 100%;
  isolation: isolate;
}
.app.with-panel { grid-template-columns: 248px minmax(0, 1fr) 340px; }
/* The old top bar was the window's drag handle; this strip keeps the top of the content draggable. */
.drag-strip { position: absolute; top: 0; left: 248px; right: 0; height: 20px; -webkit-app-region: drag; z-index: 1; }
```

(b) Delete the whole `/* ---------- top bar ---------- */` block from `.topbar {` down to and including the `.round-btn.active { ... }` line (the `.searchwrap`, `.searchdrop`, `.profile-btn` and later rules after it stay), and put this in its place:

```css
/* ---------- sidebar ---------- */
.sidebar { position: relative; z-index: 5; display: flex; flex-direction: column; min-height: 0; padding: 0 12px 14px; background: var(--glass); border-right: 1px solid var(--line); }
.sb-brand { -webkit-app-region: drag; flex: none; height: 60px; display: flex; align-items: center; padding-left: 8px; font-weight: 800; font-size: 18px; letter-spacing: -0.02em; }
:root[data-platform='mac'] .sb-brand { padding-left: 76px; }
.searchbox { margin-bottom: 10px; }
.sb-nav { display: flex; flex-direction: column; gap: 2px; }
.sb-item { width: 100%; justify-content: flex-start; gap: 12px; padding: 9px 10px; border-radius: 10px; font-weight: 600; color: var(--muted); transition: background 0.15s, color 0.15s; }
.sb-item:hover { background: var(--hover); color: var(--text); }
.sb-item.active { background: var(--line); color: var(--accent-text); }
.sb-dot { margin-left: auto; width: 8px; height: 8px; border-radius: 50%; background: #2fe08a; box-shadow: 0 0 8px #2fe08a; }
.sb-sep { height: 1px; background: var(--line); margin: 12px 4px; }
.sb-section { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 8px 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.sb-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.sb-group { margin: 12px 8px 4px; font-size: 12px; font-weight: 600; color: var(--muted); }
.sb-foot { flex: none; padding: 10px 4px 0; border-top: 1px solid var(--line); margin-top: 8px; }
```

(c) Replace the line `.searchwrap { position: relative; width: min(480px, 100%); }` with:

```css
.searchwrap { position: relative; width: 100%; }
```

and in the `.searchdrop` rule change `left: 0; right: 0;` to `left: 0; width: 340px;`.

In the `.searchpill` rule change `height: 48px` to `height: 40px` and `border-radius: 24px` to `border-radius: 20px`.

(d) Delete these now-unused rules: `.library { ... }`, `.library-head { ... }`, `.library-title { ... }`, `.library-list { ... }` (keep `.lib-row*`, `.library-empty` and `.library-actions`).

(e) Replace the `.panel { ... }` rule with nothing (delete it) and replace the `.main { padding: 0 24px 32px; ... }` rule with:

```css
.main { grid-column: 2; position: relative; min-height: 0; overflow: auto; padding: 0 28px 120px; background-image: linear-gradient(color-mix(in srgb, var(--accent) 34%, transparent), transparent 380px); background-color: var(--glass); transition: background-image 0.6s; }
```

(f) Replace `.right { padding: 0; }` with:

```css
.right { grid-column: 3; min-height: 0; overflow: auto; padding: 0 0 120px; border-left: 1px solid var(--line); background: var(--glass); }
```

- [ ] **Step 5: Typecheck and test**

The player bar still has its old grid layout and takes no props yet, so expect one type error about `PlayerBar` props until Task 5. To keep each commit green, do this temporarily: in `PlayerBar.tsx` change the signature line to `export function PlayerBar(_props: { panelOpen: boolean; onTogglePanel: () => void }): React.JSX.Element {`.

Run: `npm run typecheck && npm test`
Expected: no errors, all tests PASS

- [ ] **Step 6: Look at it**

Use the screenshot helper without a script.
Expected in the image: no top bar; a sidebar on the left with the Phinas wordmark, a search field, Beranda/Berdua/Disukai/Riwayat, a Playlist section and a profile button at the bottom; the main area with the greeting; no right panel. Note anything overlapping. (The player bar will look wrong until Task 5; that is expected.)

- [ ] **Step 7: Commit**

```bash
git add -A src/renderer
git commit -m "feat(ui): sidebar layout, optional right panel, flat surfaces"
```

---

### Task 4: Home

**Files:**
- Modify: `screens/Home.tsx`

- [ ] **Step 1: Rewrite Home without the quick-pick grid**

Replace the whole file with:

```tsx
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { ListenCard } from '../components/ListenCard'
import { CoverArt, MediaCard } from '../components/MediaCard'
import { PartnerShelf } from '../components/PartnerShelf'
import { PlaylistCover } from '../components/PlaylistCover'
import { Shelf } from '../components/Shelf'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[]>([])
  const [forYou, setForYou] = useState<Track[]>([])

  useEffect(() => {
    window.phinas.listRecentPlays(20).then(setRecent).catch(() => setRecent([]))
    // With no history yet, or when the request fails, Quick picks stays as the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setForYou(r.personalized ? r.tracks : []))
      .catch(() => setForYou([]))
  }, [])

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const playPlaylist = async (id: string): Promise<void> => {
    const p = await window.phinas.getPlaylist(id)
    if (p?.tracks.length) player.play(p.tracks, 0)
  }

  const trackCards = (tracks: Track[]): React.ReactNode =>
    tracks.map((t, i) => (
      <MediaCard
        key={t.videoId}
        art={<CoverArt url={t.coverUrl} />}
        title={t.title}
        subtitle={t.artist}
        onOpen={() => player.play(tracks, i)}
        onPlay={() => player.play(tracks, i)}
      />
    ))

  return (
    <>
      <h2 className="page-title">{name ? `${greeting()}, ${name}` : greeting()}</h2>

      <ListenCard />

      {recent.length > 0 && <Shelf title="Putar lagi">{trackCards(recent)}</Shelf>}
      {forYou.length > 0 && <Shelf title="Pilihan untukmu">{trackCards(forYou)}</Shelf>}
      {feed && feed.trending.length > 0 && <Shelf title="Lagi tren">{trackCards(feed.trending)}</Shelf>}
      {forYou.length === 0 && feed && feed.picks.length > 0 && <Shelf title="Pilihan untukmu">{trackCards(feed.picks)}</Shelf>}
      {!feed && !feedFailed && <p className="muted">Memuat yang lagi tren...</p>}
      {feedFailed && <p className="muted">Tidak bisa memuat yang lagi tren. Cek koneksi internetmu.</p>}

      {lib.playlists.length > 0 && (
        <Shelf title="Playlist kamu">
          {lib.playlists.map((p) => (
            <MediaCard
              key={p.id}
              art={<PlaylistCover covers={p.coverUrls} />}
              title={p.name}
              subtitle="Playlist"
              onOpen={() => nav({ name: 'playlist', id: p.id })}
              onPlay={() => void playPlaylist(p.id)}
            />
          ))}
        </Shelf>
      )}

      <PartnerShelf nav={nav} />
    </>
  )
}
```

- [ ] **Step 2: Remove the dead quick-pick CSS**

In `styles.css` delete the rules `.shortcuts`, `.shortcut`, `.shortcut:hover`, `.shortcut-main`, `.shortcut-main .pcover`, `.shortcut-title`, `.shortcut-play`, `.shortcut:hover .shortcut-play` and `.shortcut-play:hover` (the block under `/* ---------- home ---------- */`, down to the blank line before `.shelf`).

- [ ] **Step 3: Typecheck, test, look**

Run: `npm run typecheck && npm test`
Expected: no errors, all tests PASS

Screenshot (no script). Expected: greeting, then shelves; no tile grid.

- [ ] **Step 4: Commit**

```bash
git add -A src/renderer
git commit -m "feat(ui): Home with the listen card, no quick-pick grid"
```

---

### Task 5: Floating pill player and session block

**Files:**
- Modify: `components/PlayerBar.tsx`, `components/NowPlaying.tsx`, `styles.css`

- [ ] **Step 1: Player bar props and panel toggle**

In `PlayerBar.tsx`:

Add `PanelRight` to the lucide import list (keep it alphabetical: after `Pause`).

Replace the signature (including the temporary one from Task 3) with:

```tsx
export function PlayerBar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }): React.JSX.Element {
```

Replace the cover and info elements inside `<div className="pb-track">` (everything between the `<>` and the like button) so the track becomes a button. The block

```tsx
            <div className="pb-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
            <div className="pb-info">
              <div className="pb-title">{p.track.title}</div>
              <div className="muted pb-artist">{p.track.artist}</div>
            </div>
```

becomes

```tsx
            <button className="pb-open" onClick={onTogglePanel} aria-pressed={panelOpen} aria-label="Tampilkan panel sedang diputar">
              <span className="pb-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
              <span className="pb-info">
                <span className="pb-title">{p.track.title}</span>
                <span className="muted pb-artist">{p.track.artist}</span>
              </span>
            </button>
```

In `<div className="pb-volume">`, directly after `<ListenButton />`, add:

```tsx
        <button className={`icon-btn${panelOpen ? ' on' : ''}`} onClick={onTogglePanel} aria-pressed={panelOpen} aria-label="Tampilkan panel sedang diputar" title="Sedang diputar">
          <PanelRight size={18} />
        </button>
```

- [ ] **Step 2: Pill styles**

In `styles.css` replace the `.playerbar { ... }` rule with:

```css
.playerbar { position: absolute; z-index: 10; bottom: 14px; left: 248px; right: 0; width: min(920px, calc(100% - 248px - 48px)); margin: 0 auto; height: 76px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr); align-items: center; gap: 14px; padding: 0 18px; background: var(--glass-strong); backdrop-filter: blur(28px) saturate(1.5); border: 1px solid var(--line); border-radius: 38px; box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45); }
.app.with-panel .playerbar { right: 340px; width: min(920px, calc(100% - 248px - 340px - 48px)); }
.playerbar .listen-label { display: none; }
.pb-open { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 4px; border-radius: 14px; text-align: left; }
.pb-open:hover { background: var(--hover); }
.pb-open[aria-pressed='true'] .pb-title { color: var(--accent-text); }
.pb-open .pb-info { display: flex; flex-direction: column; min-width: 0; }
```

Change `.pb-cover { width: 58px; height: 58px; flex: none; border-radius: 8px; ... }` to use `width: 48px; height: 48px; border-radius: 12px;` (keep the rest of the rule).

Change the `.play-btn` rule to `background: var(--accent); color: #fff;` (replacing `background: var(--text); color: var(--bg);`) and add `transition: transform 0.15s, background 0.5s;`.

Change `.pb-volume .slider { width: 120px; flex: none; }` to `width: 90px`.

- [ ] **Step 3: Session block in the side panel**

In `NowPlaying.tsx`:

Add imports:

```tsx
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
```

Add above `export function NowPlaying`:

```tsx
/** Shown at the top of the panel while a listen-together session is active. */
function SessionBlock(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available || l.state.status !== 'active') return null
  const name = l.partnerName ?? 'pasangan'
  return (
    <div className="np-session">
      <span>
        ● Bareng {name} · {liveLabel(l.state, name)}
      </span>
      <button className="pill-btn" onClick={l.end}>
        Akhiri
      </button>
    </div>
  )
}
```

Put `<SessionBlock />` as the first child of both returned containers: inside `<div className="nowplaying nowplaying-empty">` before the `<Disc3 ...>`, and inside `<div className="nowplaying">` before `<div className="np-tabs" ...>`.

Append to `styles.css`:

```css
.np-session { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-radius: 14px; font-size: 13px; font-weight: 600; background: linear-gradient(120deg, color-mix(in srgb, var(--accent) 45%, transparent), rgba(192, 75, 216, 0.35)); }
```

- [ ] **Step 4: Typecheck, test, build**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests PASS, build succeeds

- [ ] **Step 5: Look at it, panel closed and open**

Plain screenshot first. Expected: a rounded pill centered over the content area (not touching the sidebar), a purple play button, nothing hidden behind it.

Then write `$SCRATCH/click.js` containing exactly:

```js
document.querySelector('[aria-label="Tampilkan panel sedang diputar"]').click()
```

and take another screenshot. Expected: the right panel appears with the empty "Pilih lagu untuk mulai" state, the main area narrows, and the pill stays centered over the narrower area.

- [ ] **Step 6: Commit**

```bash
git add -A src/renderer
git commit -m "feat(ui): floating pill player, panel toggle and session block"
```

---

### Task 6: Spec sync and final checks

**Files:**
- Modify: `docs/superpowers/specs/2026-11-17-less-spotify-ui-design.md`

- [ ] **Step 1: Bring the spec in line with what was built**

1. In section "6. Floating pill player", replace "pinned to the bottom center of the window (width `min(920px, 100% - 48px)`" with "pinned to the bottom, centered over the content columns so it never covers the sidebar (width `min(920px, content width - 48px)`", and add after the list: "A panel icon in the right cluster also toggles the right panel, so it is reachable without a track. The listen button shows only its icon in the pill; the label stays on the Berdua card and in the panel."
2. In section "1", change "The main area and sidebar list get about 110 px of bottom padding" (in section 6) to "The main area and the right panel get about 120 px of bottom padding".
3. In "Files", add `sync/status.ts` and `components/PartnerShelf.tsx` to the create list.

- [ ] **Step 2: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests PASS, build succeeds

- [ ] **Step 3: Manual checklist (with the real app and, for the last items, the real account)**

- [ ] Drag the window by the "Phinas" wordmark and by the thin strip at the top of the main area.
- [ ] On macOS the traffic-light buttons do not overlap the wordmark.
- [ ] Cmd/Ctrl+K focuses the search box in the sidebar; the recent-searches dropdown opens over the main area and is not clipped.
- [ ] Beranda, Berdua, Disukai, Riwayat, a playlist and the profile button each open the right screen and show the active state.
- [ ] Play a track: the pill shows cover and title; clicking them toggles the right panel; the page content is not hidden behind the pill when scrolled to the bottom.
- [ ] Switch to the light theme (Profil): sidebar, pill and card stay readable.
- [ ] Signed in with a partner: the card shows on Home and Berdua; the green dot shows next to Berdua when the partner is online; starting a session opens the right panel with "Bareng …" and an "Akhiri" button.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs: sync the less-spotify spec with the implementation"
```

---

## Self-review

**Spec coverage:** 1 (sidebar, search, brand, drag strip) Tasks 2 and 3. 2 (Berdua) Task 1. 3 (optional panel) Tasks 3 and 5. 4 (Home) Task 4. 5 (flat surface) Task 3. 6 (pill) Task 5. Testing and risks: Tasks 3, 5 and 6.

**Placeholders:** none; every code step has code. The two spots that say "copy from the file" (App.tsx notice block, retained CSS properties) point at text that already exists and is unchanged.

**Type consistency:** `liveLabel(state, name)` (Task 1) is used in Tasks 1 and 5 with the same arguments. `PlayerBar({ panelOpen, onTogglePanel })` (Task 5) matches the call in `App.tsx` (Task 3, with the temporary signature bridging the gap). `Home({ nav, name })` (Task 4) matches `<Home nav={nav} name={profile.name} />` (Task 3). `Sidebar` props match the call site. View `{ name: 'together' }` is added in Task 1 and used in Tasks 2 and 3.

**Known limits:** the listen-together card and the online dot cannot be checked in the screenshot profile (not signed in); they are checked by code review and the manual checklist.
