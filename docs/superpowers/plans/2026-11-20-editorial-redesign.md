# Editorial Redesign (C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Phinas its own "editorial warm" look (spec `docs/superpowers/specs/2026-11-20-editorial-redesign-design.md`): paper and ink modes (Siang/Malam, following the OS by default), Newsreader serif titles, thin rules instead of glass cards, a wash of the current cover's colour at the top of every page, a quiet Home, a new Jelajah page, and every other screen restyled to one collection-header + track-list pattern.

**Architecture:** Colour maths stays pure and tested in `theme/color.ts` (contrast, accent, wash, on-accent) and `theme/mode.ts` (stored mode, migration, resolution). `useTheme` writes `data-theme="day|night"` and the `--accent`, `--on-accent`, `--wash` custom properties on `<html>`; `theme/tokens.css` defines every other token per mode and registers the three dynamic ones with `@property` so they animate over 600 ms. The old `styles.css` becomes `styles/legacy.css` and shrinks task by task (a small prune script deletes the rules an area no longer needs) while the new `styles/base.css`, `frame.css`, `lists.css`, `home.css`, `explore.css`, `profile.css` grow; the last cleanup task deletes `legacy.css`. Rewritten components use new class names (`nav-*`, `player-*`, `panel-*`, `ch-*`, `tl-*`, `grid-*`, `story-*`, `nl-*`, `ex-*`, `pf-*`) so old and new rules never fight. Player logic, Listen Together, moods, shortcuts, IPC and the notch's layout and motion do not change. All paths below are relative to `/Users/mac/Dev/phinas-desktop`; renderer files live under `src/renderer/src/`.

**Tech Stack:** Electron 45 + electron-vite, React 19, TypeScript (`npm run typecheck` = `tsc --noEmit`), plain CSS (custom properties, `@property`, container queries), lucide-react, `@fontsource/montserrat` + `@fontsource/newsreader`, Vitest (`npm test`, node environment, `tests/**/*.test.ts`). House style: single quotes, no semicolons, 2-space indent, lines up to 140 columns, UI copy in Indonesian. There is no UI test framework: UI tasks are checked with typecheck, tests, `npm run build`, and the `PHINAS_SHOT` screenshot helper in the last task. Every commit stages only the files its task names.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/renderer/src/theme/color.ts` | modify (Tasks 1, 2) | adds `contrastRatio`, `luminance`, `accentFor`, `washFor`, `onAccent`, `paletteFor`, `parseHex`, `toHex`, paper/ink constants; drops `toAccent`, `accentText`, `accentVars` |
| `tests/color.test.ts` | modify (Tasks 1, 2) | tests for the new functions; old accent tests removed |
| `src/renderer/src/theme/mode.ts` | create (Task 2) | `ThemeMode`, `ResolvedTheme`, `parseMode` (migration), `readMode`, `writeMode`, `resolveMode`, `browserStorage` |
| `tests/theme-mode.test.ts` | create (Task 2) | mode migration and resolution |
| `src/renderer/src/theme/useTheme.ts` | rewrite (Task 2) | mode state, OS listener, cover/mood source, writes tokens, returns the notch's colours |
| `src/shared/types.ts` | modify (Task 2) | `NotchState.theme: 'day' \| 'night'`, `accent`, `onAccent` (drops `accentText`, `gradTop`) |
| `src/renderer/src/App.tsx` | modify (Tasks 2, 4, 6, 8, 14) | new theme hook, notch push, no ambient, Sidebar `name`, LyricsFull props, Jelajah route, mood colours import |
| `src/renderer/src/main.tsx` | modify (Tasks 2, 3, 14) | early `data-theme`, fonts, CSS imports in order |
| `src/renderer/src/screens/Profile.tsx` | modify (Task 2), rewrite (Task 12) | theme choice Ikuti sistem / Siang / Malam; editorial sections |
| `src/renderer/src/notch/Notch.tsx` | modify (Tasks 2, 13) | `day \| night`, accent from state, no light tone, no ambient |
| `src/renderer/src/notch/notch.css` | modify (Task 13) | serif title and lyric, accent only |
| `src/renderer/src/notch/main.tsx` | modify (Task 13) | Newsreader imports |
| `package.json`, `package-lock.json` | modify (Task 3) | `@fontsource/newsreader` |
| `src/renderer/src/theme/tokens.css` | create (Task 3), modify (Task 14) | base tokens per mode, `@property` registrations, 600 ms transition; temporary legacy aliases |
| `src/renderer/src/styles.css` → `src/renderer/src/styles/legacy.css` | move (Task 3), prune (Tasks 4–7, 11, 12), delete (Task 14) | old rules still needed while areas are rebuilt |
| `scripts/prune-legacy-css.mjs` | create (Task 3), delete (Task 14) | removes rules from `legacy.css` by selector regex |
| `src/renderer/src/styles/base.css` | create (Task 3) | reset, type scale, buttons, notice, dots, skeleton, fields, slider |
| `src/renderer/src/styles/frame.css` | create (Task 3), fill (Tasks 4–6) | app grid, main, sidebar, search box, bottom player, banners, right panel, lyrics |
| `src/renderer/src/styles/lists.css` | create (Task 3), fill (Tasks 7, 11) | collection header, playlist covers, sections, track list, menu, cover grid, import, Berdua card |
| `src/renderer/src/styles/home.css` | create (Task 3), fill (Task 9) | cover story, Berdua line, numbered lists |
| `src/renderer/src/styles/explore.css` | create (Task 3), fill (Task 8) | Jelajah pills and ranked rows |
| `src/renderer/src/styles/profile.css` | create (Task 3), fill (Task 12) | Profil head, sections, theme choice, forms |
| `src/renderer/src/components/Sidebar.tsx` | rewrite (Task 4), modify (Task 8) | wordmark, search, text nav with accent dot, text playlist rows, avatar |
| `src/renderer/src/components/SearchBox.tsx` | rewrite (Task 4) | outlined search pill, paper dropdown with ruled rows |
| `src/renderer/src/components/PlayerBar.tsx` | rewrite (Task 5) | 56 px bottom player |
| `src/renderer/src/components/NowPlaying.tsx` | rewrite (Task 6) | right panel: session block, LIRIK · ANTREAN tabs |
| `src/renderer/src/components/LyricsFull.tsx` | rewrite (Task 6) | full-size lyrics on the wash (no blurred cover) |
| `src/renderer/src/components/LyricsPanel.tsx` | unchanged code (Task 6 restyles its classes) | — |
| `src/renderer/src/components/titleParts.ts` | create (Task 7) | `splitLastWord` |
| `tests/title-parts.test.ts` | create (Task 7) | `splitLastWord` |
| `src/renderer/src/components/CollectionHeader.tsx` | rewrite (Task 7) | 130 px cover, label, 46 px serif title with italic accent last word, Putar / Acak |
| `src/renderer/src/components/TrackRow.tsx` | rewrite (Task 7) | `TrackListHead`, ruled numbered rows |
| `src/renderer/src/components/CoverGrid.tsx` | create (Task 7) | square-cover grid and its skeleton (replaces `MediaCard` + `Shelf`) |
| `src/renderer/src/screens/LikedView.tsx`, `RecentView.tsx` | modify (Task 7), rewrite (Task 10) | icon cover class, track list head |
| `src/renderer/src/views.ts` | modify (Task 8) | `{ name: 'explore' }` |
| `src/renderer/src/screens/Explore.tsx` | create (Task 8) | Jelajah page |
| `src/renderer/src/screens/home/dayPart.ts` | create (Task 9) | `dayPart`, `homeLabel` |
| `src/renderer/src/screens/home/lists.ts` | create (Task 9) | `forYouList`, `trendingList` |
| `tests/home-label.test.ts`, `tests/home-lists.test.ts` | create (Task 9) | day-part label; Untukmu / Lagi ramai selection |
| `src/renderer/src/components/NumberedList.tsx` | create (Task 9) | numbered text list (`01  Title — Artist`) |
| `src/renderer/src/components/BerduaLine.tsx` | create (Task 9) | partner presence + Listen Together action line |
| `src/renderer/src/screens/Home.tsx` | rewrite (Task 9) | label, cover story, Berdua line, Untukmu + Lagi ramai |
| `src/renderer/src/screens/Search.tsx`, `PlaylistView.tsx`, `PartnerView.tsx`, `PublicPlaylistView.tsx` | rewrite (Task 10) | shared pattern |
| `src/renderer/src/screens/ArtistView.tsx`, `GenreView.tsx`, `ImportView.tsx`, `TogetherView.tsx` | rewrite (Task 11) | shared pattern |
| `src/renderer/src/components/ListenCard.tsx` | rewrite (Task 11) | editorial Berdua block (no `compact`) |
| `src/renderer/src/components/Bento.tsx`, `Shelf.tsx`, `MediaCard.tsx` | delete (Task 14) | unused |
| `src/renderer/src/screens/home/genreIcon.ts` → `src/renderer/src/theme/moodColors.ts` | move + trim (Task 14) | only the mood accents are still used |
| `src/renderer/src/theme/useCover.ts` | modify (Task 14) | comment only |
| `src/main/dev-shot.ts` | modify (Task 15) | probe logs the new tokens |

---

## Task 1: Contrast, accent and wash functions

**Files:**
- Modify: `src/renderer/src/theme/color.ts`
- Modify: `tests/color.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/color.test.ts`, replace the import block at the top:

```ts
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ACCENT,
  accentText,
  accentVars,
  dominantColor,
  rgbToHsl,
  toAccent
} from '../src/renderer/src/theme/color'
```

with:

```ts
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ACCENT,
  FALLBACK_ACCENT,
  INK,
  MIN_CONTRAST,
  PAPER,
  TERRACOTTA,
  accentFor,
  accentText,
  accentVars,
  contrastRatio,
  dominantColor,
  luminance,
  onAccent,
  paletteFor,
  parseHex,
  rgbToHsl,
  toAccent,
  toHex,
  washFor,
  type Rgb,
  type Tone
} from '../src/renderer/src/theme/color'
```

Then append at the end of the file:

```ts
const SOURCES = [
  '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#e7a46c', '#2f6db5', '#8fc1f0', '#1a1a40', '#f0f0a0',
  '#5aa36b', '#808000', '#400010', '#5b8def', '#e8932a', '#64748b', '#ffffff', '#000000', '#b05bd6', '#3fae6a', '#d9a93a'
].map((h) => parseHex(h)!)
const TONES: Tone[] = ['day', 'night']
const hueDistance = (a: Rgb, b: Rgb): number => {
  const d = Math.abs(rgbToHsl(a).h - rgbToHsl(b).h)
  return Math.min(d, 1 - d)
}

describe('parseHex / toHex', () => {
  test('round trip', () => {
    expect(parseHex('#9c4526')).toEqual({ r: 156, g: 69, b: 38 })
    expect(toHex({ r: 156, g: 69, b: 38 })).toBe('#9c4526')
  })
  test('rejects anything that is not #rrggbb', () => {
    expect(parseHex('red')).toBeNull()
    expect(parseHex('#abc')).toBeNull()
  })
})

describe('contrastRatio', () => {
  test('black on white is 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5)
  })
  test('is symmetric, and a colour on itself is 1:1', () => {
    const a = parseHex('#2f6db5')!
    expect(contrastRatio(a, PAPER.day)).toBeCloseTo(contrastRatio(PAPER.day, a), 10)
    expect(contrastRatio(a, a)).toBe(1)
  })
  test('the fallback accents read on their own paper', () => {
    expect(contrastRatio(FALLBACK_ACCENT.day, PAPER.day)).toBeGreaterThanOrEqual(MIN_CONTRAST)
    expect(contrastRatio(FALLBACK_ACCENT.night, PAPER.night)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })
})

describe('accentFor', () => {
  test('every output reaches 4.5:1 on its paper', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) expect(contrastRatio(accentFor(src, tone), PAPER[tone])).toBeGreaterThanOrEqual(4.5)
    }
  })
  test('keeps the hue of coloured sources', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) {
        if (rgbToHsl(src).s < 0.1) continue
        expect(hueDistance(accentFor(src, tone), src)).toBeLessThan(0.01)
      }
    }
  })
  test('darkens for Siang and lightens for Malam', () => {
    const warm = parseHex('#e7a46c')!
    expect(luminance(accentFor(warm, 'day'))).toBeLessThan(luminance(warm))
    const blue = parseHex('#2f6db5')!
    expect(luminance(accentFor(blue, 'night'))).toBeGreaterThan(luminance(blue))
  })
  test('leaves a source that already passes unchanged', () => {
    expect(accentFor({ r: 0, g: 0, b: 255 }, 'day')).toEqual({ r: 0, g: 0, b: 255 })
  })
})

describe('washFor', () => {
  test('mixes 25% of the source into Siang paper', () => {
    expect(washFor(TERRACOTTA, 'day')).toEqual({ r: 241, g: 220, b: 200 })
  })
  test('mixes 30% of the source into Malam paper', () => {
    expect(washFor(TERRACOTTA, 'night')).toEqual({ r: 89, g: 65, b: 46 })
  })
  test('ink stays readable on any wash', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) expect(contrastRatio(INK[tone], washFor(src, tone))).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('onAccent', () => {
  test('white on the dark Siang accent, paper on the light Malam accent', () => {
    expect(onAccent(FALLBACK_ACCENT.day, 'day')).toEqual({ r: 255, g: 255, b: 255 })
    expect(onAccent(FALLBACK_ACCENT.night, 'night')).toEqual(PAPER.night)
  })
  test('always readable on what accentFor returns', () => {
    for (const tone of TONES) {
      for (const src of SOURCES) {
        const a = accentFor(src, tone)
        expect(contrastRatio(onAccent(a, tone), a)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('paletteFor', () => {
  test('without a source: the terracotta defaults', () => {
    expect(paletteFor(null, 'day')).toEqual({ accent: '#9c4526', onAccent: '#ffffff', wash: '#f1dcc8' })
    expect(paletteFor(null, 'night')).toEqual({ accent: '#e7a46c', onAccent: '#1c1714', wash: '#59412e' })
  })
  test('with a source: hex strings built from that source', () => {
    const p = paletteFor(parseHex('#2f6db5'), 'day')
    expect(p.accent).toBe(toHex(accentFor(parseHex('#2f6db5')!, 'day')))
    expect(p.wash).toBe(toHex(washFor(parseHex('#2f6db5')!, 'day')))
    expect(p.onAccent).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/color.test.ts`
Expected: FAIL (the new names are not exported from `theme/color.ts`; TypeScript import errors or `accentFor is not a function`).

- [ ] **Step 3: Implement**

Append to the end of `src/renderer/src/theme/color.ts` (keep everything already in the file):

```ts

/** The two editorial modes: Siang (paper) and Malam (ink). */
export type Tone = 'day' | 'night'

const hex = (h: string): Rgb => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16)
})

/** Same values as --paper and --ink in theme/tokens.css. */
export const PAPER: Record<Tone, Rgb> = { day: hex('#f4efe6'), night: hex('#1c1714') }
export const INK: Record<Tone, Rgb> = { day: hex('#2a2420'), night: hex('#efe4d4') }
/** The wash colour when nothing is playing and no mood is set. */
export const TERRACOTTA: Rgb = hex('#e7a46c')
/** The accent when nothing is playing and no mood is set. */
export const FALLBACK_ACCENT: Record<Tone, Rgb> = { day: hex('#9c4526'), night: hex('#e7a46c') }
/** WCAG AA for normal text. */
export const MIN_CONTRAST = 4.5
/** How much of the source colour goes into the page wash. */
export const WASH_SHARE: Record<Tone, number> = { day: 0.25, night: 0.3 }
const WHITE: Rgb = { r: 255, g: 255, b: 255 }

/** `#rrggbb` to Rgb, or null for anything else. */
export function parseHex(h: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim())
  return m ? hex(`#${m[1]}`) : null
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const linear = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * The source colour made readable on the mode's paper (at least 4.5:1), keeping its hue and
 * saturation: darkened step by step for Siang, lightened for Malam.
 */
export function accentFor(source: Rgb, tone: Tone): Rgb {
  const paper = PAPER[tone]
  if (contrastRatio(source, paper) >= MIN_CONTRAST) return source
  const { h, s, l } = rgbToHsl(source)
  for (let i = 1; i <= 100; i++) {
    const x = tone === 'day' ? l - i / 100 : l + i / 100
    if (x < 0 || x > 1) break
    const c = hslToRgb(h, s, x)
    if (contrastRatio(c, paper) >= MIN_CONTRAST) return c
  }
  return tone === 'day' ? { r: 0, g: 0, b: 0 } : WHITE
}

/** The source mixed into the paper: 25% for Siang, 30% for Malam. */
export function washFor(source: Rgb, tone: Tone): Rgb {
  const k = WASH_SHARE[tone]
  const p = PAPER[tone]
  const mix = (s: number, q: number): number => Math.round(q * (1 - k) + s * k)
  return { r: mix(source.r, p.r), g: mix(source.g, p.g), b: mix(source.b, p.b) }
}

/** Text on a filled accent: white or the paper, whichever contrasts more. */
export function onAccent(accent: Rgb, tone: Tone): Rgb {
  return contrastRatio(WHITE, accent) >= contrastRatio(PAPER[tone], accent) ? WHITE : PAPER[tone]
}

export interface Palette {
  accent: string
  onAccent: string
  wash: string
}

/** The dynamic tokens for a source colour (cover or mood), or the terracotta defaults without one. */
export function paletteFor(source: Rgb | null, tone: Tone): Palette {
  const accent = source ? accentFor(source, tone) : FALLBACK_ACCENT[tone]
  const wash = washFor(source ?? TERRACOTTA, tone)
  return { accent: toHex(accent), onAccent: toHex(onAccent(accent, tone)), wash: toHex(wash) }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/color.test.ts`
Expected: PASS (old `dominantColor`/`toAccent`/`accentText`/`accentVars` tests and the new ones).

- [ ] **Step 5: Full check**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0; all test files pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/theme/color.ts tests/color.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): contrast-checked accent, wash and on-accent colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Siang / Malam modes

Replaces Dynamic/Dark/Light with Ikuti sistem / Siang / Malam, writes the new tokens, and sends `day | night` plus a dark-surface accent to the notch. The old dark stylesheet still applies until Task 3, so the app looks dark with the new accent for one task; that is expected.

**Files:**
- Create: `src/renderer/src/theme/mode.ts`
- Create: `tests/theme-mode.test.ts`
- Rewrite: `src/renderer/src/theme/useTheme.ts`
- Modify: `src/renderer/src/theme/color.ts`, `tests/color.test.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`
- Modify: `src/renderer/src/screens/Profile.tsx`
- Modify: `src/renderer/src/notch/Notch.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/theme-mode.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { THEME_KEY, parseMode, readMode, resolveMode, writeMode } from '../src/renderer/src/theme/mode'

const store = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k: string): string | null => map.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      map.set(k, v)
    }
  }
}

describe('parseMode', () => {
  test('current values stay', () => {
    expect(parseMode('system')).toBe('system')
    expect(parseMode('day')).toBe('day')
    expect(parseMode('night')).toBe('night')
  })
  test('old values migrate', () => {
    expect(parseMode('light')).toBe('day')
    expect(parseMode('dark')).toBe('night')
    expect(parseMode('dynamic')).toBe('system')
  })
  test('missing or unknown values follow the system', () => {
    expect(parseMode(null)).toBe('system')
    expect(parseMode('purple')).toBe('system')
    expect(parseMode('toString')).toBe('system')
  })
})

describe('readMode', () => {
  test('nothing stored: system, and nothing is written', () => {
    const s = store()
    expect(readMode(s)).toBe('system')
    expect(s.map.has(THEME_KEY)).toBe(false)
  })
  test('an old value is migrated and stored back', () => {
    const s = store({ [THEME_KEY]: 'dark' })
    expect(readMode(s)).toBe('night')
    expect(s.map.get(THEME_KEY)).toBe('night')
  })
  test('a current value is read as is', () => {
    expect(readMode(store({ [THEME_KEY]: 'day' }))).toBe('day')
  })
  test('no storage, or storage that throws, reads as system', () => {
    expect(readMode(null)).toBe('system')
    const broken = {
      getItem: (): string | null => {
        throw new Error('blocked')
      },
      setItem: (): void => {}
    }
    expect(readMode(broken)).toBe('system')
  })
})

describe('writeMode', () => {
  test('stores the mode under phinas.theme', () => {
    const s = store()
    writeMode(s, 'night')
    expect(s.map.get('phinas.theme')).toBe('night')
  })
  test('ignores storage errors', () => {
    const broken = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error('full')
      }
    }
    expect(() => writeMode(broken, 'day')).not.toThrow()
  })
})

describe('resolveMode', () => {
  test('system follows the OS', () => {
    expect(resolveMode('system', true)).toBe('night')
    expect(resolveMode('system', false)).toBe('day')
  })
  test('a forced mode ignores the OS', () => {
    expect(resolveMode('day', true)).toBe('day')
    expect(resolveMode('night', false)).toBe('night')
  })
})
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run tests/theme-mode.test.ts`
Expected: FAIL (`theme/mode` does not exist).

- [ ] **Step 3: Create `src/renderer/src/theme/mode.ts`**

```ts
import type { Tone } from './color'

/** What the user picked in Profil. */
export type ThemeMode = 'system' | 'day' | 'night'
/** What is actually shown. */
export type ResolvedTheme = Tone

export const THEME_KEY = 'phinas.theme'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Values written by versions before the editorial redesign. */
const LEGACY: Record<string, ThemeMode> = { light: 'day', dark: 'night', dynamic: 'system' }

export function parseMode(value: string | null): ThemeMode {
  if (value === 'system' || value === 'day' || value === 'night') return value
  if (value !== null && Object.hasOwn(LEGACY, value)) return LEGACY[value]
  return 'system'
}

/** The stored mode; an old value is migrated and written back. */
export function readMode(store: Store | null): ThemeMode {
  if (!store) return 'system'
  try {
    const raw = store.getItem(THEME_KEY)
    const mode = parseMode(raw)
    if (raw !== null && raw !== mode) store.setItem(THEME_KEY, mode)
    return mode
  } catch {
    return 'system'
  }
}

export function writeMode(store: Store | null, mode: ThemeMode): void {
  try {
    store?.setItem(THEME_KEY, mode)
  } catch {
    /* storage unavailable */
  }
}

export function resolveMode(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'night' : 'day'
  return mode
}

export function browserStorage(): Store | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const DARK_QUERY = '(prefers-color-scheme: dark)'
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run tests/theme-mode.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/renderer/src/theme/useTheme.ts`**

```ts
import { useEffect, useState } from 'react'
import { DEFAULT_ACCENT, dominantColor, paletteFor, parseHex, type Rgb } from './color'
import { DARK_QUERY, browserStorage, readMode, resolveMode, writeMode, type ResolvedTheme, type ThemeMode } from './mode'

async function pixelsOf(dataUrl: string): Promise<Uint8ClampedArray> {
  // A data URL is same-origin, so the canvas is never tainted.
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, 32, 32)
  return ctx.getImageData(0, 0, 32, 32).data
}

export interface Theme {
  /** What the user picked in Profil. */
  mode: ThemeMode
  setMode: (m: ThemeMode) => void
  /** What is shown: the picked mode, or the OS's when following the system. */
  resolved: ResolvedTheme
  /** The notch is a dark pill in both modes, so it always gets the Malam accent. */
  notch: { accent: string; onAccent: string }
}

/**
 * Applies the mode to <html data-theme> and writes --accent, --on-accent and --wash from the
 * cover's dominant colour, or from the mood's colour while a mood is set.
 */
export function useTheme(coverData: string | null, moodAccent: string | null): Theme {
  const [mode, setModeState] = useState<ThemeMode>(() => readMode(browserStorage()))
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  const [coverColor, setCoverColor] = useState<Rgb | null>(null)

  // Follow the OS live when it switches between light and dark.
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // The previous colour stays until the new cover is read, so the accent glides instead of blinking.
  useEffect(() => {
    if (!coverData) {
      setCoverColor(null)
      return
    }
    let cancelled = false
    pixelsOf(coverData)
      .then((px) => {
        if (cancelled) return
        const c = dominantColor(px)
        // A greyscale cover has no colour of its own: use the terracotta defaults.
        setCoverColor(c === DEFAULT_ACCENT ? null : c)
      })
      .catch((e) => {
        console.warn('[theme] could not read cover colors, using the default accent:', e)
        if (!cancelled) setCoverColor(null)
      })
    return () => {
      cancelled = true
    }
  }, [coverData])

  const resolved = resolveMode(mode, systemDark)
  const source = (moodAccent ? parseHex(moodAccent) : null) ?? coverColor
  const palette = paletteFor(source, resolved)
  const notch = paletteFor(source, 'night')

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.setProperty('--accent', palette.accent)
    root.style.setProperty('--on-accent', palette.onAccent)
    root.style.setProperty('--wash', palette.wash)
  }, [resolved, palette.accent, palette.onAccent, palette.wash])

  const setMode = (m: ThemeMode): void => {
    setModeState(m)
    writeMode(browserStorage(), m)
  }

  return { mode, setMode, resolved, notch: { accent: notch.accent, onAccent: notch.onAccent } }
}
```

- [ ] **Step 6: Remove the old accent helpers**

In `src/renderer/src/theme/color.ts`, delete this whole block (it sits between `dominantColor` and the code added in Task 1):

```ts
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Keep the accent readable on dark panels: lightness 0.35-0.6, saturation at least 0.35. */
export function toAccent(c: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(c)
  // A colourless input has no real hue (it reads as 0, i.e. red), so borrow the default's.
  const hue = s < 0.05 ? rgbToHsl(DEFAULT_ACCENT).h : h
  return hslToRgb(hue, Math.max(s, 0.35), clamp(l, 0.35, 0.6))
}

const css = ({ r, g, b }: Rgb): string => `rgb(${r} ${g} ${b})`

/**
 * The accent lightened for use as TEXT or thin icons on a dark panel. The plain accent can be
 * a deep colour that works for buttons but disappears as text on a dark background.
 */
export function accentText(c: Rgb): Rgb {
  const { h, s } = rgbToHsl(toAccent(c))
  return hslToRgb(h, clamp(s, 0.5, 0.95), 0.7)
}

export function accentVars(c: Rgb): { accent: string; accentText: string; gradTop: string } {
  const a = toAccent(c)
  const { h, s } = rgbToHsl(a)
  return { accent: css(a), accentText: css(accentText(c)), gradTop: css(hslToRgb(h, s, 0.28)) }
}
```

Also in the same file change the comment above `DEFAULT_ACCENT` usage in `dominantColor`'s doc: replace

```ts
 * subject whose shading is spread over many colour buckets. Greyscale covers fall back to
 * the default accent.
```

with

```ts
 * subject whose shading is spread over many colour buckets. Greyscale covers return
 * DEFAULT_ACCENT itself (the same object), which useTheme treats as "no colour".
```

In `tests/color.test.ts`: remove `accentText,`, `accentVars,` and `toAccent,` from the import list, and delete the three blocks `describe('toAccent', …)`, `describe('accentText', …)` and `describe('accentVars', …)` entirely (from each `describe(` line to its closing `})`).

- [ ] **Step 7: Change `NotchState` in `src/shared/types.ts`**

Replace:

```ts
  /** The app's current theme, so the notch looks like the app. */
  theme: 'dynamic' | 'dark' | 'light'
  accent: string
  accentText: string
  gradTop: string
}
```

with:

```ts
  /** The app's resolved mode. The notch stays a dark pill in both; it only takes the accent. */
  theme: 'day' | 'night'
  /** The accent made for a dark surface (the Malam accent), and the text colour on it. */
  accent: string
  onAccent: string
}
```

- [ ] **Step 8: Update `src/renderer/src/App.tsx`**

Replace:

```tsx
  const { theme, setTheme } = useTheme(cover, mood?.colors ?? null)
```

with:

```tsx
  const theme = useTheme(cover, mood?.colors.accent ?? null)
```

Replace this block:

```tsx
  // Keep the notch overlay in step with the player and the app's theme.
  const [colors, setColors] = useState({ accent: '#8b5cf6', accentText: '#b79cff', gradTop: '#2b2150' })
  useEffect(() => {
    // The theme hook sets the accent variables a moment after the cover or theme changes.
    const t = setTimeout(() => {
      const cs = getComputedStyle(document.documentElement)
      const get = (v: string, fallback: string): string => cs.getPropertyValue(v).trim() || fallback
      setColors({
        accent: get('--accent', '#8b5cf6'),
        accentText: get('--accent-text', '#b79cff'),
        gradTop: get('--grad-top', '#2b2150')
      })
    }, 400)
    return () => clearTimeout(t)
  }, [cover, theme, mood])
  const liked = player.track ? lib.likes.some((l) => l.videoId === player.track!.videoId) : false
  useEffect(() => {
    window.phinas.pushNotchState({
      track: player.track,
      playing: player.playing,
      time: player.time,
      duration: player.duration,
      liked,
      theme,
      ...colors
    })
  }, [player.track, player.playing, player.time, player.duration, liked, theme, colors])
```

with:

```tsx
  // Keep the notch overlay in step with the player and the app's mode.
  const liked = player.track ? lib.likes.some((l) => l.videoId === player.track!.videoId) : false
  useEffect(() => {
    window.phinas.pushNotchState({
      track: player.track,
      playing: player.playing,
      time: player.time,
      duration: player.duration,
      liked,
      theme: theme.resolved,
      accent: theme.notch.accent,
      onAccent: theme.notch.onAccent
    })
  }, [player.track, player.playing, player.time, player.duration, liked, theme.resolved, theme.notch.accent, theme.notch.onAccent])
```

Replace:

```tsx
        return <Profile name={profile.name} onName={profile.setName} initial={profile.initial} theme={theme} onTheme={setTheme} />
```

with:

```tsx
        return <Profile name={profile.name} onName={profile.setName} initial={profile.initial} theme={theme.mode} onTheme={theme.setMode} />
```

Delete this line (the blurred cover background goes away):

```tsx
      {cover && theme !== 'light' && <div key={cover} className="ambient" style={{ backgroundImage: `url("${cover}")` }} />}
```

- [ ] **Step 9: Set the mode before the first paint in `src/renderer/src/main.tsx`**

Replace:

```tsx
import { App } from './App'
import './styles.css'

if (navigator.userAgent.includes('Mac')) document.documentElement.dataset.platform = 'mac'
```

with:

```tsx
import { App } from './App'
import './styles.css'
import { DARK_QUERY, browserStorage, readMode, resolveMode } from './theme/mode'

if (navigator.userAgent.includes('Mac')) document.documentElement.dataset.platform = 'mac'
// Set before React renders so a Malam window never flashes Siang paper.
document.documentElement.dataset.theme = resolveMode(readMode(browserStorage()), window.matchMedia(DARK_QUERY).matches)
```

- [ ] **Step 10: Theme choice in `src/renderer/src/screens/Profile.tsx`**

Replace:

```tsx
import type { ThemeName } from '../theme/useTheme'
```

with:

```tsx
import type { ThemeMode } from '../theme/mode'
```

Replace:

```tsx
const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'dynamic', label: 'Dynamic', hint: 'Warna mengikuti sampul lagu' },
  { id: 'dark', label: 'Dark', hint: 'Gelap, aksen ungu tetap' },
  { id: 'light', label: 'Light', hint: 'Terang, aksen biru' }
]
```

with:

```tsx
const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Ikuti sistem', hint: 'Siang atau malam mengikuti komputer' },
  { id: 'day', label: 'Siang', hint: 'Kertas terang' },
  { id: 'night', label: 'Malam', hint: 'Tinta gelap' }
]
```

Replace:

```tsx
  theme: ThemeName
  onTheme: (t: ThemeName) => void
```

with:

```tsx
  theme: ThemeMode
  onTheme: (t: ThemeMode) => void
```

- [ ] **Step 11: Make the notch compile against the new state (`src/renderer/src/notch/Notch.tsx`)**

Delete these two lines:

```tsx
  // Follows the app's theme. With a camera notch it stays dark: the notch itself is black.
  const tone = state.theme === 'light' && !layout.hasNotch ? 'light' : 'dark'
```

Replace:

```tsx
    '--accent-text': state.accentText,
    '--grad-top': state.gradTop,
```

with:

```tsx
    '--accent-text': state.accent,
    '--on-accent': state.onAccent,
```

Replace:

```tsx
        className={`pill ${layout.hasNotch ? 'attached' : 'floating'} ${tone}${open ? ' open' : peek ? ' peek' : ''}`}
```

with:

```tsx
        className={`pill ${layout.hasNotch ? 'attached' : 'floating'}${open ? ' open' : peek ? ' peek' : ''}`}
```

Delete these three lines:

```tsx
        {state.theme === 'dynamic' && tone === 'dark' && track.coverUrl && (
          <div key={track.coverUrl} className="ambient" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
        )}
```

- [ ] **Step 12: Full check**

Run: `npm run typecheck && npm test`
Expected: typecheck exits 0 (no remaining `ThemeName`, `accentVars`, `accentText`, `gradTop` references: `grep -rn "ThemeName\|accentVars\|gradTop\|accentText" src tests` prints only the debug probe string in `src/main/dev-shot.ts`, which Task 15 updates); all tests pass, including `tests/theme-mode.test.ts`.

- [ ] **Step 13: Commit**

```bash
git add src/renderer/src/theme/mode.ts tests/theme-mode.test.ts src/renderer/src/theme/useTheme.ts src/renderer/src/theme/color.ts tests/color.test.ts src/shared/types.ts src/renderer/src/App.tsx src/renderer/src/main.tsx src/renderer/src/screens/Profile.tsx src/renderer/src/notch/Notch.tsx
git commit -m "$(cat <<'EOF'
feat(theme): Siang and Malam modes that follow the OS by default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tokens, Newsreader and the stylesheet split

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/renderer/src/theme/tokens.css`
- Move: `src/renderer/src/styles.css` → `src/renderer/src/styles/legacy.css` (and trim)
- Create: `scripts/prune-legacy-css.mjs`
- Create: `src/renderer/src/styles/base.css`, `frame.css`, `lists.css`, `home.css`, `explore.css`, `profile.css`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: Add the serif**

Run: `npm install @fontsource/newsreader@^5.3.0`
Expected: `package.json` gains `"@fontsource/newsreader": "^5.3.0"` under `dependencies`; `node_modules/@fontsource/newsreader/400.css`, `600.css` and `400-italic.css` exist (`ls node_modules/@fontsource/newsreader/{400,600,400-italic}.css`).

- [ ] **Step 2: Create `src/renderer/src/theme/tokens.css`**

```css
/* Design tokens of the editorial look. Siang is the default; Malam overrides under [data-theme='night'].
   --accent, --on-accent and --wash are written by theme/useTheme.ts; the values here are the
   terracotta defaults used before it runs. They are registered so a song change fades over 600 ms. */
@property --accent { syntax: '<color>'; inherits: true; initial-value: #9c4526; }
@property --on-accent { syntax: '<color>'; inherits: true; initial-value: #ffffff; }
@property --wash { syntax: '<color>'; inherits: true; initial-value: #f1dcc8; }

:root {
  --paper: #f4efe6;
  --ink: #2a2420;
  --ink-soft: #5a4f45;
  --ink-faint: #b9ab9a;
  --line: #e2d8c8;
  --online: #5aa36b;
  --accent: #9c4526;
  --on-accent: #ffffff;
  --wash: #f1dcc8;
  /* The one shadow in the app, for large covers only. */
  --cover-shadow: 0 18px 30px -18px rgba(90, 40, 20, 0.6);
  --serif: 'Newsreader', Georgia, serif;
  --sans: 'Montserrat', system-ui, sans-serif;
  color-scheme: light;
  transition: --accent 600ms ease, --on-accent 600ms ease, --wash 600ms ease;
}

:root[data-theme='night'] {
  --paper: #1c1714;
  --ink: #efe4d4;
  --ink-soft: #9a8b7b;
  --ink-faint: #5e5145;
  --line: #352c25;
  --online: #7cc28b;
  --accent: #e7a46c;
  --on-accent: #1c1714;
  --wash: #59412e;
  --cover-shadow: 0 18px 30px -18px rgba(0, 0, 0, 0.85);
  color-scheme: dark;
}

/* Old names still read by styles/legacy.css while areas are rebuilt. Removed with it (Task 14). */
:root {
  --bg: var(--paper);
  --text: var(--ink);
  --muted: var(--ink-soft);
  --hover: color-mix(in srgb, var(--ink) 6%, transparent);
  --glass: transparent;
  --glass-strong: var(--paper);
  --accent-text: var(--accent);
  --grad-top: var(--wash);
  --radius: 0px;
}
```

- [ ] **Step 3: Move the old stylesheet and trim what base.css replaces**

Run exactly (the `sed` line numbers refer to the current `styles.css`, all in one invocation):

```bash
mkdir -p src/renderer/src/styles
git mv src/renderer/src/styles.css src/renderer/src/styles/legacy.css
sed -i '' -e '1,54d' -e '68,78d' -e '117,125d' -e '143,146d' -e '271,275d' -e '426,427d' -e '433d' src/renderer/src/styles/legacy.css
```

This removes: the `:root` colour blocks, reset and scrollbars (1–54); `.ambient` and `@keyframes ambient-in` (68–78); `.icon-btn`, `.pill-btn`, `.btn` (117–125); `.page-title`, `.notice`, `.main > .notice + .page-title`, `.main h3` (143–146); `.slider` (271–275); `.artist-link` (426–427); `.press` (433).

Check: `wc -l src/renderer/src/styles/legacy.css` prints `374`, and `grep -nE '^(:root|\.ambient|\.icon-btn|\.btn|\.slider|\.press|\.page-title|\.notice)' src/renderer/src/styles/legacy.css` prints nothing.

At the top of `src/renderer/src/styles/legacy.css` insert this first line:

```css
/* Pre-redesign rules still in use. Each redesign task prunes its area (scripts/prune-legacy-css.mjs); the file is deleted in Task 14. */
```

- [ ] **Step 4: Create `scripts/prune-legacy-css.mjs`**

```js
// Dev helper for the C1 redesign: deletes top-level rules from styles/legacy.css whose selector
// matches a regex, as each area is rebuilt. Deleted together with legacy.css at the end.
// Usage: node scripts/prune-legacy-css.mjs '<regex tested against each top-level selector>'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(new URL('../src/renderer/src/styles/legacy.css', import.meta.url))
const re = new RegExp(process.argv[2])
const css = readFileSync(file, 'utf8')
const out = []
let i = 0
let removed = 0
while (i < css.length) {
  const ws = css.slice(i).match(/^\s*/)[0]
  if (ws) {
    out.push(ws)
    i += ws.length
    continue
  }
  if (css.startsWith('/*', i)) {
    const end = css.indexOf('*/', i) + 2
    out.push(css.slice(i, end))
    i = end
    continue
  }
  const open = css.indexOf('{', i)
  if (open === -1) {
    out.push(css.slice(i))
    break
  }
  // Find the matching close brace (handles @container blocks and multi-line rules).
  let depth = 0
  let j = open
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}' && --depth === 0) break
  }
  const selector = css.slice(i, open).trim()
  if (re.test(selector)) {
    removed++
    i = j + 1
    if (css[i] === '\n') i++
  } else {
    out.push(css.slice(i, j + 1))
    i = j + 1
  }
}
writeFileSync(file, out.join(''))
console.log(`prune-legacy-css: removed ${removed} rule(s)`)
```

Sanity check (prunes nothing): `node scripts/prune-legacy-css.mjs '^\.does-not-exist$'` prints `prune-legacy-css: removed 0 rule(s)` and `git diff --stat src/renderer/src/styles/legacy.css` shows no change from that run.

- [ ] **Step 5: Create `src/renderer/src/styles/base.css`**

```css
/* Reset, type scale, buttons and small shared pieces. Colours come from theme/tokens.css. */
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0; }
button:disabled { cursor: not-allowed; }
button:focus-visible, input:focus-visible, .press:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h1, h2, h3, h4 { margin: 0; font-weight: 400; }
p { margin: 0 0 10px; }
a { color: var(--accent); }
.muted { color: var(--ink-soft); }
.small { font-size: 11px; }

/* thin scrollbars */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; border: 2px solid transparent; background-clip: content-box; }
::-webkit-scrollbar-thumb:hover { background: var(--ink-faint); background-clip: content-box; border: 2px solid transparent; }
::-webkit-scrollbar-track { background: transparent; }

/* ---------- type ---------- */
/* Small capitals with wide spacing: section labels, tabs, table heads. */
.label { font-family: var(--sans); font-size: 10px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: var(--ink-soft); }
.label.accent { color: var(--accent); }
.page-title { font-family: var(--serif); font-size: 44px; font-weight: 400; line-height: 0.95; letter-spacing: -0.01em; padding: 36px 0 22px; }
.page-title em { font-style: italic; color: var(--accent); }
.section-title { display: block; margin: 0 0 10px; font-family: var(--serif); font-size: 18px; font-style: italic; font-weight: 400; color: var(--ink); text-align: left; }
button.section-title { display: inline-flex; }
button.section-title:hover { color: var(--accent); }

/* ---------- buttons ---------- */
.btn { height: 32px; padding: 0 18px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 600; white-space: nowrap; transition: transform 0.15s, opacity 0.15s; }
.btn:hover:not(:disabled) { transform: translateY(-1px); }
.btn:disabled { opacity: 0.45; }
.btn.secondary { background: none; color: var(--ink); border: 1px solid var(--ink); }
.text-link { padding: 0; color: var(--accent); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.text-link:disabled { color: var(--ink-faint); text-decoration: none; }
.icon-btn { padding: 7px; border-radius: 50%; color: var(--ink-soft); transition: color 0.15s, background 0.15s; }
.icon-btn:hover:not(:disabled) { color: var(--ink); background: color-mix(in srgb, var(--line) 70%, transparent); }
.icon-btn:disabled { opacity: 0.4; }
.icon-btn.on { color: var(--accent); }
.pill-btn { height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line); font-size: 12px; font-weight: 600; color: var(--ink); }
.pill-btn:hover { border-color: var(--ink); }
/* A div acting as a button (it holds artist links, which a <button> cannot). */
.press { display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer; }
.artist-link { display: inline; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
.artist-link:hover { color: var(--ink); text-decoration: underline; }

/* ---------- small shared pieces ---------- */
.notice { margin: 16px 0 0; padding: 10px 14px; border-left: 2px solid var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); color: var(--ink); cursor: pointer; }
.online-dot { display: inline-block; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--online); }
.online-dot.off { background: var(--ink-faint); }
.skeleton { background: color-mix(in srgb, var(--ink) 7%, transparent); animation: skeleton 1.2s ease-in-out infinite alternate; }
@keyframes skeleton { from { opacity: 0.45; } to { opacity: 1; } }
.field { width: 100%; min-width: 0; padding: 9px 14px; border: 1px solid var(--line); border-radius: 999px; background: none; color: var(--ink); font: inherit; outline: 0; }
.field:focus { border-color: var(--accent); }
.field::placeholder { color: var(--ink-faint); }

/* Range inputs drawn as a 2 px line (accent on --line); the thumb shows on hover. */
.slider { -webkit-appearance: none; appearance: none; flex: 1; height: 12px; margin: 0; padding: 0; border: 0; cursor: pointer; background: linear-gradient(to right, var(--accent) var(--pct, 0%), var(--line) var(--pct, 0%)) center / 100% 2px no-repeat; }
.slider::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); opacity: 0; transition: opacity 0.15s; }
.slider:hover::-webkit-slider-thumb { opacity: 1; }
```

- [ ] **Step 6: Create the area files (filled by later tasks)**

Create each file with exactly one comment line:

- `src/renderer/src/styles/frame.css`: `/* App frame: grid, sidebar, search box, bottom player, notices, right panel, lyrics. */`
- `src/renderer/src/styles/lists.css`: `/* Collection header, sections, track list, cover grid, and the smaller list screens. */`
- `src/renderer/src/styles/home.css`: `/* Beranda: cover story, Berdua line, numbered lists. */`
- `src/renderer/src/styles/explore.css`: `/* Jelajah: mood and genre pills, ranked rows. */`
- `src/renderer/src/styles/profile.css`: `/* Profil. */`

- [ ] **Step 7: Import fonts and stylesheets in order (`src/renderer/src/main.tsx`)**

Replace:

```tsx
import '@fontsource/montserrat/800.css'
import { App } from './App'
import './styles.css'
```

with:

```tsx
import '@fontsource/montserrat/800.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/600.css'
import '@fontsource/newsreader/400-italic.css'
import { App } from './App'
import './theme/tokens.css'
// Old rules go first so the new files win wherever both still match.
import './styles/legacy.css'
import './styles/base.css'
import './styles/frame.css'
import './styles/lists.css'
import './styles/home.css'
import './styles/explore.css'
import './styles/profile.css'
```

- [ ] **Step 8: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all three succeed (the build bundles the new CSS and fonts without "could not resolve" errors).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/renderer/src/theme/tokens.css src/renderer/src/styles scripts/prune-legacy-css.mjs src/renderer/src/main.tsx
git status --short   # styles.css shows as renamed to styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): editorial tokens, Newsreader, and styles split by area

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frame and sidebar

**Files:**
- Rewrite: `src/renderer/src/components/Sidebar.tsx`
- Rewrite: `src/renderer/src/components/SearchBox.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/frame.css`
- Prune: `src/renderer/src/styles/legacy.css`

- [ ] **Step 1: Prune the old frame, sidebar and search rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(app|drag-strip|main|back-btn|mood-badge|searchpill|searchwrap|searchdrop|searchbox|sidebar)\b'`
Expected: `prune-legacy-css: removed 22 rule(s)`.

- [ ] **Step 2: Append to `src/renderer/src/styles/frame.css`**

```css

/* ---------- app frame ---------- */
.app { position: relative; display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); height: 100%; background: var(--paper); }
.app.with-panel { grid-template-columns: 220px minmax(0, 1fr) 300px; }
/* The window has no title bar: this strip keeps the top of the content draggable. */
.drag-strip { position: absolute; top: 0; left: 220px; right: 0; height: 20px; -webkit-app-region: drag; z-index: 1; }
.main {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  min-height: 0;
  overflow: auto;
  padding: 0 40px 48px;
  container-type: inline-size;
  /* The wash sits at the top of the page and scrolls away with it. */
  background: linear-gradient(180deg, var(--wash) 0%, var(--paper) 45%) 0 0 / 100% 100vh no-repeat local, var(--paper);
}
.back-btn { position: sticky; top: 14px; z-index: 21; margin-top: 14px; width: 32px; height: 32px; border: 1px solid var(--line); background: var(--paper); }
.mood-badge { position: sticky; top: 14px; z-index: 21; float: right; display: inline-flex; align-items: center; gap: 4px; margin-top: 14px; height: 30px; padding: 0 4px 0 14px; border: 1px solid var(--accent); border-radius: 999px; background: var(--paper); color: var(--accent); font-size: 10px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
.mood-badge .icon-btn { width: 22px; height: 22px; padding: 4px; color: var(--accent); }

/* ---------- sidebar ---------- */
.sidebar { grid-column: 1; grid-row: 1 / -1; position: relative; z-index: 5; display: flex; flex-direction: column; min-height: 0; padding: 0 18px 14px; background: var(--paper); border-right: 1px solid var(--line); }
/* The wordmark doubles as the window's drag handle. */
.nav-brand { -webkit-app-region: drag; flex: none; display: flex; align-items: flex-end; height: 64px; padding-bottom: 12px; font-family: var(--serif); font-size: 22px; font-style: italic; line-height: 1; color: var(--ink); user-select: none; }
/* Room under the macOS traffic lights (placed at y 24 by the main process). */
:root[data-platform='mac'] .nav-brand { height: 84px; }
.nav { display: flex; flex-direction: column; margin-top: 14px; }
.nav-item { justify-content: flex-start; gap: 10px; width: 100%; padding: 5px 0; font-size: 13px; color: var(--ink-soft); }
.nav-item::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: transparent; transition: background 0.3s; }
.nav-item:hover { color: var(--ink); }
.nav-item.active { color: var(--ink); font-weight: 700; }
.nav-item.active::before { background: var(--accent); }
.nav-section { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; padding: 10px 0 6px; border-top: 1px solid var(--line); }
.nav-actions { display: flex; }
.nav-actions .icon-btn { padding: 4px; }
.nav-list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; }
.nav-pl { justify-content: flex-start; width: 100%; min-width: 0; padding: 4px 0 4px 16px; font-size: 12px; color: var(--ink-soft); text-align: left; }
.nav-pl span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-pl:hover { color: var(--ink); }
.nav-pl.active { color: var(--accent); font-weight: 600; }
.nav-group { margin: 14px 0 4px; }
.nav-empty { margin: 0; padding: 4px 0 4px 16px; font-size: 11px; color: var(--ink-faint); }
.nav-foot { flex: none; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
.nav-me { justify-content: flex-start; gap: 10px; width: 100%; min-width: 0; }
.nav-avatar { display: grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-family: var(--serif); font-size: 17px; font-style: italic; }
.nav-me.active .nav-avatar { box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px var(--accent); }
.nav-foot-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--ink-soft); }
.nav-me:hover .nav-foot-name, .nav-me.active .nav-foot-name { color: var(--ink); }

/* ---------- search box ---------- */
.search { position: relative; }
/* .searchpill input is also how Cmd+K finds the box (PlayerProvider's focusSearch). */
.searchpill { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 6px 0 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink-faint); transition: border-color 0.2s; }
.searchpill:focus-within { border-color: var(--accent); color: var(--ink); }
.searchpill input { flex: 1; min-width: 0; background: none; border: 0; outline: 0; color: var(--ink); font: inherit; font-size: 12px; }
.searchpill input:focus-visible { outline: 0; }
.searchpill input::placeholder { color: var(--ink-faint); }
.searchpill .icon-btn { padding: 3px; }
.search-drop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: 320px; max-height: 60vh; overflow-y: auto; padding: 12px 16px; background: var(--paper); border: 1px solid var(--line); box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.35); }
.search-drop .label { display: block; padding-bottom: 6px; }
.search-empty { margin: 0; padding: 8px 0; font-size: 12px; color: var(--ink-soft); }
.search-row { display: flex; align-items: center; border-top: 1px solid var(--line); }
.search-pick { flex: 1; min-width: 0; justify-content: flex-start; gap: 10px; padding: 8px 0; text-align: left; color: var(--ink-soft); }
.search-pick:hover, .search-pick:hover strong { color: var(--accent); }
.search-pick strong { color: var(--ink); font-weight: 600; }
.search-text { display: flex; flex-direction: column; min-width: 0; }
.search-text > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

- [ ] **Step 3: Rewrite `src/renderer/src/components/SearchBox.tsx`**

```tsx
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
  const wrapRef = useRef<HTMLFormElement>(null)

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
    <form className="search" onSubmit={submit} ref={wrapRef}>
      <label className="searchpill">
        <Search size={14} />
        <input
          value={query}
          onChange={(e) => {
            onQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="Cari…"
          aria-label="Cari lagu atau artis"
        />
        {query && (
          <button type="button" className="icon-btn" onClick={() => onQuery('')} aria-label="Hapus pencarian">
            <X size={14} />
          </button>
        )}
      </label>
      {showRecent && (
        <div className="search-drop">
          <span className="label">Pencarian terakhir</span>
          {recent.length === 0 && <p className="search-empty">Belum ada pencarian.</p>}
          {recent.map((r) => (
            <div key={entryKey(r)} className="search-row">
              <button
                type="button"
                className="search-pick"
                onClick={() => {
                  if (r.kind === 'track') onPlayTrack(r.track)
                  else onQuery(r.text)
                  setOpen(false)
                }}
              >
                {r.kind === 'track' ? (
                  <span className="search-text">
                    <strong>{r.track.title}</strong>
                    <span className="small">Lagu · {r.track.artist}</span>
                  </span>
                ) : (
                  <>
                    <Clock size={14} />
                    <span className="search-text">
                      <span>{r.text}</span>
                    </span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onForget(r)}
                aria-label={`Hapus ${r.kind === 'track' ? r.track.title : r.text}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Rewrite `src/renderer/src/components/Sidebar.tsx`**

```tsx
import { Download, Plus } from 'lucide-react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { RecentEntry } from '../search/recent'
import { useListen } from '../sync/ListenTogetherProvider'
import { sameView, type Nav, type View } from '../views'
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
  /** The profile name, shown next to the avatar. */
  name: string
  /** First letter of the profile name, shown in the avatar. */
  initial: string
}

/** A text navigation item; the active one is bold with an accent dot before it. */
function NavItem(p: { label: string; active: boolean; online?: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-item${p.active ? ' active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <span>{p.label}</span>
      {p.online && <span className="online-dot" role="img" aria-label="Pasangan online" />}
    </button>
  )
}

function PlaylistItem(p: { name: string; active: boolean; onClick: () => void }): React.JSX.Element {
  return (
    <button className={`nav-pl${p.active ? ' active' : ''}`} onClick={p.onClick} title={p.name}>
      <span>{p.name}</span>
    </button>
  )
}

export function Sidebar({ view, nav, query, onQuery, onSubmit, recent, onForget, onPlayTrack, name, initial }: Props): React.JSX.Element {
  const lib = useLibrary()
  const listen = useListen()

  const create = async (): Promise<void> => {
    const p = await window.phinas.createPlaylist(`Playlist #${lib.playlists.length + 1}`)
    await lib.refresh()
    nav({ name: 'playlist', id: p.id })
  }

  return (
    <aside className="sidebar" aria-label="Navigasi">
      {/* The wordmark is also the window's drag handle, below the macOS window buttons. */}
      <div className="nav-brand">phinas</div>
      <SearchBox query={query} onQuery={onQuery} onSubmit={onSubmit} recent={recent} onForget={onForget} onPlayTrack={onPlayTrack} />

      <nav className="nav">
        <NavItem label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem
          label="Berdua"
          active={view.name === 'together'}
          online={listen.available && listen.state.partnerHere}
          onClick={() => nav({ name: 'together' })}
        />
        <NavItem label="Disukai" active={view.name === 'liked'} onClick={() => nav({ name: 'liked' })} />
        <NavItem label="Riwayat" active={view.name === 'recent'} onClick={() => nav({ name: 'recent' })} />
      </nav>

      <div className="nav-section">
        <span className="label">Playlist</span>
        <div className="nav-actions">
          <button className="icon-btn" onClick={() => nav({ name: 'import' })} aria-label="Impor dari Spotify" title="Impor dari Spotify">
            <Download size={14} />
          </button>
          <button className="icon-btn" onClick={create} aria-label="Buat playlist" title="Buat playlist">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="nav-list">
        {lib.playlists.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            active={sameView(view, { name: 'playlist', id: p.id })}
            onClick={() => nav({ name: 'playlist', id: p.id })}
          />
        ))}
        {lib.playlists.length === 0 && <p className="nav-empty">Buat playlist pertamamu dengan tombol +.</p>}
        {lib.partner.length > 0 && <div className="label nav-group">Dari pasangan</div>}
        {lib.partner.map((p) => (
          <PlaylistItem
            key={p.id}
            name={p.name}
            active={sameView(view, { name: 'partner', id: p.id })}
            onClick={() => nav({ name: 'partner', id: p.id })}
          />
        ))}
      </div>

      <div className="nav-foot">
        <button className={`nav-me${view.name === 'profile' ? ' active' : ''}`} onClick={() => nav({ name: 'profile' })} aria-label="Profil">
          <span className="nav-avatar">{initial}</span>
          <span className="nav-foot-name">{name}</span>
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Pass the name from `src/renderer/src/App.tsx`**

Replace:

```tsx
        onPlayTrack={(t) => {
          recents.rememberTrack(t, '')
          player.play([t], 0)
        }}
        initial={profile.initial}
      />
```

with:

```tsx
        onPlayTrack={(t) => {
          recents.rememberTrack(t, '')
          player.play([t], 0)
        }}
        name={profile.name}
        initial={profile.initial}
      />
```

- [ ] **Step 6: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/Sidebar.tsx src/renderer/src/components/SearchBox.tsx src/renderer/src/App.tsx src/renderer/src/styles/frame.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): editorial sidebar with wordmark, text navigation and search

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Bottom player

The floating pill becomes a 56 px bar under the content columns. Listen Together's button and the page notices are restyled here too.

**Files:**
- Rewrite: `src/renderer/src/components/PlayerBar.tsx`
- Modify: `src/renderer/src/styles/frame.css`
- Prune: `src/renderer/src/styles/legacy.css`

- [ ] **Step 1: Prune the old player, listen button and banner rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(playerbar|pb-[a-z-]+|play-btn|listen-btn|listen-label|listen-banner|update-banner)\b'`
Expected: `prune-legacy-css: removed 28 rule(s)`.

- [ ] **Step 2: Give the player its row in `src/renderer/src/styles/frame.css`**

Replace:

```css
.app { position: relative; display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); height: 100%; background: var(--paper); }
```

with:

```css
.app { position: relative; display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) 56px; height: 100%; background: var(--paper); }
```

Then append:

```css

/* ---------- bottom player ---------- */
.player { grid-column: 2 / -1; grid-row: 2; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr); align-items: center; gap: 18px; height: 56px; padding: 0 20px; background: var(--paper); border-top: 1px solid var(--line); }
.player-track { display: flex; align-items: center; gap: 6px; min-width: 0; }
.player-open { display: flex; align-items: center; gap: 10px; min-width: 0; }
.player-cover { width: 36px; height: 36px; flex: none; background: var(--line) center / cover; }
.player-info { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
.player-title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-open[aria-pressed='true'] .player-title { color: var(--accent); }
.player-artist { font-size: 11px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.player-center { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.player-buttons { display: flex; align-items: center; gap: 10px; }
.player-buttons .icon-btn { padding: 5px; }
.player-play { width: 34px; height: 34px; border-radius: 50%; background: var(--accent); color: var(--on-accent); transition: transform 0.15s; }
.player-play:hover { transform: scale(1.06); }
.player-seek { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 520px; font-size: 10px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.player-seek .slider { height: 8px; }
.player-time { width: 32px; flex: none; }
.player-time:first-child { text-align: right; }
.player-side { display: flex; align-items: center; justify-content: flex-end; gap: 4px; color: var(--ink-soft); }
.player-side .slider { flex: none; width: 80px; margin-left: 4px; }
.player .listen-label { display: none; }

/* ---------- listen together and update notices ---------- */
.listen-btn { display: inline-flex; align-items: center; gap: 6px; }
.listen-btn:disabled { opacity: 0.4; }
.listen-label { font-size: 11px; white-space: nowrap; }
/* Sticky so an invite is seen even when the page is scrolled down. */
.listen-banner { position: sticky; top: 14px; z-index: 20; display: flex; align-items: center; gap: 14px; background: var(--paper); box-shadow: 0 12px 24px -16px rgba(0, 0, 0, 0.35); cursor: default; }
.update-banner { display: flex; align-items: center; gap: 14px; cursor: default; }
.listen-banner > span, .update-banner > span { flex: 1; }
.listen-action { display: inline-flex; align-items: center; gap: 6px; padding: 0; font-size: 12px; font-weight: 600; color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
```

- [ ] **Step 3: Rewrite `src/renderer/src/components/PlayerBar.tsx`**

```tsx
import {
  Heart,
  PanelRight,
  PanelTop,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import { usePlayer } from '../player/PlayerProvider'
import { ListenButton } from './ListenTogether'
import { formatTime } from './TrackRow'
import { ArtistLinks, pressable } from '../nav/NavProvider'

const pct = (value: number, max: number): CSSProperties =>
  ({ '--pct': `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }) as CSSProperties

/** The 56 px bar under the content: track, transport and progress, then the side controls. */
export function PlayerBar({ panelOpen, onTogglePanel }: { panelOpen: boolean; onTogglePanel: () => void }): React.JSX.Element {
  const p = usePlayer()
  const lib = useLibrary()
  const [notch, setNotch] = useNotchEnabled()
  const liked = p.track ? lib.likes.some((x) => x.videoId === p.track!.videoId) : false

  const toggleLike = async (): Promise<void> => {
    if (!p.track) return
    await window.phinas.setLiked(p.track, !liked)
    await lib.refresh()
  }

  const VolumeIcon = p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2

  return (
    <footer className="player" aria-label="Pemutar">
      <div className="player-track">
        {p.track && (
          <>
            <div className="player-open press" {...pressable(onTogglePanel)} aria-pressed={panelOpen} aria-label="Tampilkan panel sedang diputar">
              <span className="player-cover" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
              <span className="player-info">
                <span className="player-title">{p.track.title}</span>
                <ArtistLinks className="player-artist" artist={p.track.artist} />
              </span>
            </div>
            <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </>
        )}
      </div>

      <div className="player-center">
        <div className="player-buttons">
          <button className={`icon-btn${p.shuffle ? ' on' : ''}`} onClick={p.toggleShuffle} aria-label="Acak" aria-pressed={p.shuffle}>
            <Shuffle size={15} />
          </button>
          <button className="icon-btn" onClick={p.prev} aria-label="Sebelumnya">
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button className="player-play" onClick={p.toggle} aria-label="Putar atau jeda">
            {p.playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>
          <button className="icon-btn" onClick={p.next} aria-label="Berikutnya">
            <SkipForward size={16} fill="currentColor" />
          </button>
          <button
            className={`icon-btn${p.repeat !== 'off' ? ' on' : ''}`}
            onClick={p.cycleRepeat}
            aria-label={`Ulangi: ${p.repeat}`}
            aria-pressed={p.repeat !== 'off'}
          >
            {p.repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>
        <div className="player-seek">
          <span className="player-time">{formatTime(p.time)}</span>
          <input
            className="slider"
            type="range"
            min={0}
            max={Math.max(p.duration, 1)}
            step={1}
            value={Math.min(p.time, p.duration || 0)}
            style={pct(p.time, p.duration)}
            onChange={(e) => p.seek(Number(e.target.value))}
            aria-label="Posisi lagu"
          />
          <span className="player-time">{formatTime(p.duration)}</span>
        </div>
      </div>

      <div className="player-side">
        <ListenButton />
        {notch !== null && (
          <button
            className={`icon-btn${notch ? ' on' : ''}`}
            onClick={() => setNotch(!notch)}
            aria-pressed={notch}
            aria-label={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
            title={notch ? 'Sembunyikan notch' : 'Tampilkan notch'}
          >
            <PanelTop size={15} />
          </button>
        )}
        <button
          className={`icon-btn${panelOpen ? ' on' : ''}`}
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
          aria-label="Tampilkan panel sedang diputar"
          title="Sedang diputar"
        >
          <PanelRight size={15} />
        </button>
        <VolumeIcon size={15} />
        <input
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={p.volume}
          style={pct(p.volume, 1)}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/PlayerBar.tsx src/renderer/src/styles/frame.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): 56 px bottom player in place of the floating pill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Right panel and lyrics

**Files:**
- Rewrite: `src/renderer/src/components/NowPlaying.tsx`
- Rewrite: `src/renderer/src/components/LyricsFull.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles/frame.css`
- Prune: `src/renderer/src/styles/legacy.css`
- `src/renderer/src/components/LyricsPanel.tsx`: no code change (its `lyrics`, `lyric-line`, `lyrics-plain`, `lyrics-note` classes are restyled here; its scroll container lookup `.lyrics-full-body, .right` stays valid).

- [ ] **Step 1: Prune the old panel and lyrics rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(right|nowplaying|np-[a-z-]+|queue-item|queue-title|lyrics|lyric-line|round-btn)\b|lyrics-full-head'`
Expected: `prune-legacy-css: removed 38 rule(s)`.

- [ ] **Step 2: Append to `src/renderer/src/styles/frame.css`**

```css

/* ---------- right panel ---------- */
.right { grid-column: 3; grid-row: 1; min-height: 0; overflow: auto; border-left: 1px solid var(--line); background: linear-gradient(180deg, var(--wash) 0%, var(--paper) 45%) 0 0 / 100% 100vh no-repeat local, var(--paper); }
.panel { display: flex; flex-direction: column; gap: 14px; padding: 22px; }
.panel-empty { align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--ink-soft); }
.panel-session { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--ink-soft); }
.panel-session em { font-family: var(--serif); font-size: 15px; color: var(--ink); }
.panel-tabs { display: flex; align-items: center; gap: 10px; }
.panel-tab { padding: 0; }
.panel-tab[aria-selected='true'] { color: var(--accent); }
.panel-tabs .icon-btn { margin-left: auto; padding: 4px; }
.panel-now { display: flex; align-items: center; gap: 10px; min-width: 0; }
.panel-thumb { width: 44px; height: 44px; flex: none; background: var(--line) center / cover; }
.panel-thumb.small { width: 36px; height: 36px; }
.panel-text { display: flex; flex-direction: column; min-width: 0; font-size: 12px; line-height: 1.35; color: var(--ink-soft); }
.panel-text > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel-text strong { color: var(--ink); }
.panel-autoplay { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ink-soft); }
.panel-autoplay input { accent-color: var(--accent); }
.panel-queue { display: flex; flex-direction: column; }
.panel-queue .label { padding-bottom: 6px; }
.panel-row { gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
.panel-row:hover .panel-text strong { color: var(--accent); }

/* ---------- lyrics ---------- */
.lyrics { display: flex; flex-direction: column; padding: 4px 0 40vh; }
.lyric-line { justify-content: flex-start; padding: 3px 0; font-family: var(--serif); font-size: 19px; line-height: 1.45; text-align: left; color: var(--ink-faint); transition: color 0.25s, font-size 0.25s; }
.lyric-line:hover { color: var(--ink-soft); }
.lyric-line.active { font-size: 24px; font-style: italic; color: var(--ink); }
.lyrics-plain { white-space: pre-wrap; font-family: var(--serif); font-size: 17px; line-height: 1.6; color: var(--ink); }
.lyrics-note { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 24px; text-align: center; }
/* Full size, over the whole app. */
.lyrics-full { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(180deg, var(--wash) 0%, var(--paper) 45%), var(--paper); }
.lyrics-full-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 32px 0; -webkit-app-region: drag; }
:root[data-platform='mac'] .lyrics-full-head { padding-left: 96px; }
.lyrics-full-head > * { -webkit-app-region: no-drag; }
.lyrics-full-title { display: flex; flex-direction: column; min-width: 0; }
.lyrics-full-title strong { font-family: var(--serif); font-size: 22px; font-style: italic; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lyrics-full-close { width: 40px; height: 40px; border: 1px solid var(--line); border-radius: 50%; color: var(--ink-soft); }
.lyrics-full-close:hover { color: var(--ink); border-color: var(--ink); }
.lyrics-full-body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 clamp(24px, 12vw, 220px); }
.lyrics-large { align-items: center; gap: 6px; padding-top: 12vh; padding-bottom: 45vh; text-align: center; }
.lyrics-large .lyric-line { justify-content: center; text-align: center; font-size: clamp(26px, 3.6vw, 46px); line-height: 1.25; }
.lyrics-large .lyric-line.active { font-size: clamp(30px, 4.2vw, 56px); }
.lyrics-large.lyrics-plain { font-size: clamp(20px, 2.4vw, 30px); line-height: 1.7; }
```

- [ ] **Step 3: Rewrite `src/renderer/src/components/NowPlaying.tsx`**

```tsx
import { Disc3, Maximize2 } from 'lucide-react'
import { useState } from 'react'
import { usePlayer } from '../player/PlayerProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { LyricsPanel } from './LyricsPanel'
import { ArtistLinks, pressable } from '../nav/NavProvider'

type Tab = 'lyrics' | 'queue'

/** Shown at the top of the panel while a listen-together session is active. */
function SessionBlock(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available || l.state.status !== 'active') return null
  const name = l.partnerName ?? 'pasangan'
  return (
    <div className="panel-session">
      <span>
        Bareng <em>{name}</em> · {liveLabel(l.state, name)}
      </span>
      <button className="text-link" onClick={l.end}>
        Akhiri
      </button>
    </div>
  )
}

export function NowPlaying({ onExpandLyrics }: { onExpandLyrics: () => void }): React.JSX.Element {
  const p = usePlayer()
  const [tab, setTab] = useState<Tab>('lyrics')
  if (!p.track) {
    return (
      <div className="panel panel-empty">
        <SessionBlock />
        <Disc3 size={40} strokeWidth={1.2} />
        <p>Pilih lagu untuk mulai. Lirik dan antreannya tampil di sini.</p>
      </div>
    )
  }
  const upcoming = p.queue.tracks.slice(p.queue.index + 1)
  return (
    <div className="panel">
      <SessionBlock />
      <div className="panel-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'lyrics'} className="label panel-tab" onClick={() => setTab('lyrics')}>
          Lirik
        </button>
        <span className="label" aria-hidden="true">
          ·
        </span>
        <button role="tab" aria-selected={tab === 'queue'} className="label panel-tab" onClick={() => setTab('queue')}>
          Antrean
        </button>
        {tab === 'lyrics' && (
          <button className="icon-btn" onClick={onExpandLyrics} aria-label="Perbesar lirik" title="Perbesar lirik">
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      <div className="panel-now">
        <span className="panel-thumb" style={{ backgroundImage: `url("${p.track.coverUrl}")` }} />
        <span className="panel-text">
          <strong>{p.track.title}</strong>
          <ArtistLinks artist={p.track.artist} />
        </span>
      </div>

      {tab === 'lyrics' ? (
        <LyricsPanel track={p.track} />
      ) : (
        <>
          <label className="panel-autoplay">
            <input type="checkbox" checked={p.autoplay} onChange={p.toggleAutoplay} />
            Autoplay: lanjut ke lagu serupa saat antrean habis
          </label>
          <div className="panel-queue">
            <span className="label">Berikutnya</span>
            {upcoming.length === 0 && <p className="muted small">Antrean kosong</p>}
            {upcoming.map((t, i) => (
              <div key={`${t.videoId}-${i}`} className="panel-row press" {...pressable(() => p.jump(p.queue.index + 1 + i))}>
                <span className="panel-thumb small" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
                <span className="panel-text">
                  <strong>{t.title}</strong>
                  <ArtistLinks artist={t.artist} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `src/renderer/src/components/LyricsFull.tsx`**

```tsx
import { Minimize2 } from 'lucide-react'
import { usePlayer } from '../player/PlayerProvider'
import { LyricsPanel } from './LyricsPanel'

/** The lyrics at full size over the whole app, on the page wash. */
export function LyricsFull({ onClose }: { onClose: () => void }): React.JSX.Element | null {
  const { track } = usePlayer()
  if (!track) return null
  return (
    <div className="lyrics-full" role="dialog" aria-label="Lirik layar penuh">
      <header className="lyrics-full-head">
        <div className="lyrics-full-title">
          <strong>{track.title}</strong>
          <span className="muted">{track.artist}</span>
        </div>
        <button className="lyrics-full-close" onClick={onClose} aria-label="Perkecil lirik" title="Perkecil (Esc)">
          <Minimize2 size={18} />
        </button>
      </header>
      <div className="lyrics-full-body">
        <LyricsPanel track={track} large />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update the call in `src/renderer/src/App.tsx`**

Replace:

```tsx
      {lyricsFull && <LyricsFull cover={cover} onClose={() => setLyricsFull(false)} />}
```

with:

```tsx
      {lyricsFull && <LyricsFull onClose={() => setLyricsFull(false)} />}
```

- [ ] **Step 6: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/NowPlaying.tsx src/renderer/src/components/LyricsFull.tsx src/renderer/src/App.tsx src/renderer/src/styles/frame.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): right panel with serif lyrics and LIRIK · ANTREAN tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Collection header, track list and cover grid

The shared pieces every collection screen uses. Screens keep working unchanged (same props); Tasks 10 and 11 adopt `TrackListHead` and `CoverGrid`.

**Files:**
- Create: `src/renderer/src/components/titleParts.ts`
- Create: `tests/title-parts.test.ts`
- Rewrite: `src/renderer/src/components/CollectionHeader.tsx`
- Rewrite: `src/renderer/src/components/TrackRow.tsx`
- Create: `src/renderer/src/components/CoverGrid.tsx`
- Modify: `src/renderer/src/screens/LikedView.tsx`, `src/renderer/src/screens/RecentView.tsx`
- Modify: `src/renderer/src/styles/lists.css`
- Prune: `src/renderer/src/styles/legacy.css`

- [ ] **Step 1: Write the failing test**

Create `tests/title-parts.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { splitLastWord } from '../src/renderer/src/components/titleParts'

describe('splitLastWord', () => {
  test('splits off the last word', () => {
    expect(splitLastWord('playlist rafi')).toEqual(['playlist', 'rafi'])
    expect(splitLastWord('Lagu yang disukai')).toEqual(['Lagu yang', 'disukai'])
  })
  test('a single word is all last word', () => {
    expect(splitLastWord('Falling')).toEqual(['', 'Falling'])
  })
  test('ignores surrounding and repeated spaces', () => {
    expect(splitLastWord('  spaced   out  ')).toEqual(['spaced', 'out'])
  })
  test('empty stays empty', () => {
    expect(splitLastWord('')).toEqual(['', ''])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/title-parts.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/renderer/src/components/titleParts.ts`**

```ts
/** "Lagu yang disukai" → ["Lagu yang", "disukai"]: titles set the last word in italic accent. */
export function splitLastWord(text: string): [string, string] {
  const t = text.trim()
  const at = t.lastIndexOf(' ')
  if (at === -1) return ['', t]
  return [t.slice(0, at).trimEnd(), t.slice(at + 1)]
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/title-parts.test.ts`
Expected: PASS.

- [ ] **Step 5: Prune the old covers, menu and title rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(pcover|menu|title-button|title-input|artist-hero)\b|^\.collection-cover:has'`
Expected: `prune-legacy-css: removed 17 rule(s)`.

- [ ] **Step 6: Append to `src/renderer/src/styles/lists.css`**

```css

/* ---------- collection header ---------- */
.ch { display: flex; align-items: flex-end; gap: 24px; padding: 36px 0 26px; }
.ch-cover { width: 130px; height: 130px; flex: none; box-shadow: var(--cover-shadow); }
.ch-cover > * { width: 100%; height: 100%; }
.ch-cover:has(.artist-hero) { border-radius: 50%; }
.ch-info { min-width: 0; }
.ch-title { margin: 6px 0; padding-bottom: 0.06em; font-family: var(--serif); font-size: 46px; font-weight: 400; line-height: 0.95; letter-spacing: -0.01em; overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ch-title em, .title-button em { font-style: italic; color: var(--accent); }
.ch-meta { font-size: 11px; color: var(--ink-soft); }
.ch-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.title-button { display: inline; padding: 0; font: inherit; letter-spacing: inherit; text-align: left; }
.title-button:hover { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 6px; }
.title-input { width: 100%; padding: 0; border: 0; border-bottom: 1px solid var(--accent); background: none; color: var(--ink); font: inherit; letter-spacing: inherit; outline: 0; }
.artist-hero { border-radius: 50%; background: var(--line) center / cover; }

/* ---------- playlist covers ---------- */
.pcover { aspect-ratio: 1; flex: none; overflow: hidden; background: var(--line) center / cover; }
.pcover-empty { display: flex; align-items: center; justify-content: center; color: var(--ink-faint); }
.pcover-grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.pcover-grid div { background: center / cover; }
/* Disukai and Riwayat: an icon on the accent. */
.pcover-icon { display: flex; align-items: center; justify-content: center; background: var(--accent); color: var(--on-accent); }

/* ---------- sections ---------- */
.sec { padding: 22px 0 6px; border-top: 1px solid var(--line); }
.sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.sec-head .text-link { font-size: 11px; }
.sec > .grid-covers { margin-bottom: 18px; }

/* ---------- track list ---------- */
.tl-head, .tl-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto 48px; gap: 12px; align-items: center; }
.tl-head { padding: 0 8px 6px; border-bottom: 1px solid var(--ink); }
.tl-head span:last-child { text-align: right; }
.tl-row { padding: 8px; border-bottom: 1px solid var(--line); cursor: pointer; transition: background 0.15s; }
.tl-row:hover { background: color-mix(in srgb, var(--line) 55%, transparent); }
.tl-row.playing { background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%); }
.tl-num { font-family: var(--serif); font-size: 15px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.tl-row.playing .tl-num, .tl-row.playing .tl-title { color: var(--accent); }
.tl-meta { min-width: 0; line-height: 1.35; }
.tl-title, .tl-artist { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-title { font-weight: 700; }
.tl-artist { font-size: 11px; color: var(--ink-soft); }
.tl-actions { display: flex; align-items: center; opacity: 0; transition: opacity 0.15s; }
.tl-row:hover .tl-actions, .tl-actions:focus-within, .tl-row.playing .tl-actions { opacity: 1; }
.tl-actions .icon-btn { padding: 5px; }
.tl-time { font-size: 11px; color: var(--ink-soft); text-align: right; font-variant-numeric: tabular-nums; }
.tl-skel { height: 50px; margin-bottom: 1px; }

/* ---------- track menu ---------- */
.menu-wrap { position: relative; }
.menu-backdrop { position: fixed; inset: 0; z-index: 20; }
.menu { position: absolute; right: 0; top: 100%; z-index: 21; min-width: 220px; max-height: 280px; overflow-y: auto; padding: 6px 14px; background: var(--paper); border: 1px solid var(--line); box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.35); }
.menu-title { padding: 10px 0 4px; }
.menu-empty { padding: 6px 0; font-size: 12px; color: var(--ink-faint); }
.menu-item { justify-content: flex-start; width: 100%; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 12px; text-align: left; }
.menu-item:last-child { border-bottom: 0; }
.menu-item:hover { color: var(--accent); }

/* ---------- cover grid ---------- */
/* Square covers without rounded corners or cards; title and meta under each. */
.grid-covers { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 22px 18px; }
.grid-covers.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@container (max-width: 760px) { .grid-covers.four { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.grid-item { flex-direction: column; align-items: stretch; gap: 2px; min-width: 0; text-align: left; }
.grid-art { display: block; width: 100%; aspect-ratio: 1; margin-bottom: 8px; background: var(--line) center / cover; }
.grid-item .pcover { width: 100%; margin-bottom: 8px; }
.grid-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 700; }
.grid-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--ink-soft); }
.grid-item:hover .grid-title { color: var(--accent); }
```

- [ ] **Step 7: Rewrite `src/renderer/src/components/CollectionHeader.tsx`**

```tsx
import { Play, Shuffle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Track } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'
import { splitLastWord } from './titleParts'

/** A title whose last word is set in italic accent ("Lagu yang *disukai*"). */
export function AccentTitle({ text }: { text: string }): React.JSX.Element {
  const [head, last] = splitLastWord(text)
  return (
    <>
      {head && `${head} `}
      <em>{last}</em>
    </>
  )
}

interface Props {
  /** 130 px square: a PlaylistCover (2×2 mosaic), a cover, an icon tile or an artist photo. */
  cover: ReactNode
  /** The label line, e.g. "Playlist", "Album · Hindia", "Artis" (shown in capitals). */
  kind: string
  /** A plain title (its last word becomes italic accent), or a node (e.g. an editable name). */
  title: ReactNode
  meta: string
  /** The list Putar and Acak start. No buttons when empty. */
  tracks: Track[]
  /** Secondary buttons after Putar and Acak. */
  children?: ReactNode
}

export function CollectionHeader({ cover, kind, title, meta, tracks, children }: Props): React.JSX.Element {
  const player = usePlayer()
  return (
    <header className="ch">
      <div className="ch-cover">{cover}</div>
      <div className="ch-info">
        <div className="label accent">{kind}</div>
        <h1 className="ch-title">{typeof title === 'string' ? <AccentTitle text={title} /> : title}</h1>
        {meta && <div className="ch-meta">{meta}</div>}
        <div className="ch-actions">
          {tracks.length > 0 && (
            <>
              <button className="btn" onClick={() => player.play(tracks, 0)}>
                <Play size={13} fill="currentColor" /> Putar
              </button>
              <button className="btn secondary" onClick={() => player.shufflePlay(tracks)}>
                <Shuffle size={13} /> Acak
              </button>
            </>
          )}
          {children}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 8: Rewrite `src/renderer/src/components/TrackRow.tsx`**

```tsx
import { Heart, ListPlus, Play, X } from 'lucide-react'
import { useState } from 'react'
import type { Track } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { ArtistLinks, pressable } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'

export const formatTime = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** The labels above a track list: NO · JUDUL · DURASI, over a 1 px ink rule. */
export function TrackListHead(): React.JSX.Element {
  return (
    <div className="tl-head label" aria-hidden="true">
      <span>No</span>
      <span>Judul</span>
      <span />
      <span>Durasi</span>
    </div>
  )
}

interface Props {
  track: Track
  /** Position in the list, shown as the row number. */
  index?: number
  onPlay: () => void
  /** Show a remove button (used inside a playlist). */
  onRemove?: () => void
}

export function TrackRow({ track, index, onPlay, onRemove }: Props): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [menuOpen, setMenuOpen] = useState(false)
  const isCurrent = player.track?.videoId === track.videoId
  const liked = lib.likes.some((x) => x.videoId === track.videoId)

  const toggleLike = async (): Promise<void> => {
    await window.phinas.setLiked(track, !liked)
    await lib.refresh()
  }

  const addTo = async (playlistId: string): Promise<void> => {
    setMenuOpen(false)
    await window.phinas.addTrack(playlistId, track)
    await lib.refresh()
  }

  return (
    // Clicking anywhere on the row plays it; the action buttons stop the click from reaching here.
    <div className={`tl-row${isCurrent ? ' playing' : ''}`} {...pressable(onPlay)} aria-label={`Putar ${track.title}`}>
      <span className="tl-num">{isCurrent ? <Play size={12} fill="currentColor" aria-hidden="true" /> : index !== undefined ? index + 1 : ''}</span>
      <div className="tl-meta">
        <span className="tl-title">{track.title}</span>
        <ArtistLinks className="tl-artist" artist={track.artist} />
      </div>
      <div className="tl-actions" onClick={(e) => e.stopPropagation()}>
        <button className={`icon-btn${liked ? ' on' : ''}`} onClick={toggleLike} aria-label={liked ? 'Hapus dari disukai' : 'Suka'}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu lagu" aria-expanded={menuOpen}>
            <ListPlus size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu" role="menu">
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    player.playNext(track)
                  }}
                >
                  Putar berikutnya
                </button>
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    player.addToQueue(track)
                  }}
                >
                  Tambah ke antrean
                </button>
                <div className="label menu-title">Tambah ke playlist</div>
                {lib.playlists.length === 0 && <div className="menu-empty">Belum ada playlist</div>}
                {lib.playlists.map((p) => (
                  <button key={p.id} role="menuitem" className="menu-item" onClick={() => addTo(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {onRemove && (
          <button className="icon-btn" onClick={onRemove} aria-label="Hapus dari playlist">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="tl-time">{track.durationSec > 0 ? formatTime(track.durationSec) : ''}</div>
    </div>
  )
}
```

- [ ] **Step 9: Create `src/renderer/src/components/CoverGrid.tsx`**

```tsx
import type { ReactNode } from 'react'

export interface GridItem {
  key: string
  title: string
  meta?: string
  /** A cover URL, or a node such as a PlaylistCover. */
  art: string | ReactNode
  onOpen: () => void
}

/** Square covers in a grid, title and meta under each (artist releases, search playlists, …). */
export function CoverGrid({ items, four = false }: { items: GridItem[]; four?: boolean }): React.JSX.Element {
  return (
    <div className={`grid-covers${four ? ' four' : ''}`}>
      {items.map((it) => (
        <button key={it.key} className="grid-item" onClick={it.onOpen} title={it.title}>
          {typeof it.art === 'string' ? <span className="grid-art" style={{ backgroundImage: `url("${it.art}")` }} /> : it.art}
          <span className="grid-title">{it.title}</span>
          {it.meta && <span className="grid-meta">{it.meta}</span>}
        </button>
      ))}
    </div>
  )
}

/** Placeholder squares while a grid loads. */
export function CoverGridSkeleton({ count, four = false }: { count: number; four?: boolean }): React.JSX.Element {
  return (
    <div className={`grid-covers${four ? ' four' : ''}`} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="grid-art skeleton" />
      ))}
    </div>
  )
}
```

- [ ] **Step 10: Icon covers in `LikedView.tsx` and `RecentView.tsx`**

In `src/renderer/src/screens/LikedView.tsx` replace:

```tsx
          <div className="pcover pcover-liked">
            <Heart size={64} fill="currentColor" />
          </div>
```

with:

```tsx
          <div className="pcover pcover-icon">
            <Heart size={48} fill="currentColor" />
          </div>
```

In `src/renderer/src/screens/RecentView.tsx` replace:

```tsx
          <div className="pcover pcover-liked">
            <History size={64} />
          </div>
```

with:

```tsx
          <div className="pcover pcover-icon">
            <History size={48} />
          </div>
```

- [ ] **Step 11: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 12: Commit**

```bash
git add src/renderer/src/components/titleParts.ts tests/title-parts.test.ts src/renderer/src/components/CollectionHeader.tsx src/renderer/src/components/TrackRow.tsx src/renderer/src/components/CoverGrid.tsx src/renderer/src/screens/LikedView.tsx src/renderer/src/screens/RecentView.tsx src/renderer/src/styles/lists.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): editorial collection header, ruled track list and cover grid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Jelajah

**Files:**
- Modify: `src/renderer/src/views.ts`
- Create: `src/renderer/src/screens/Explore.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Sidebar.tsx`
- Modify: `src/renderer/src/styles/explore.css`

- [ ] **Step 1: Add the view (`src/renderer/src/views.ts`)**

Replace:

```ts
export type View =
  | { name: 'home' }
  | { name: 'search' }
```

with:

```ts
export type View =
  | { name: 'home' }
  | { name: 'explore' }
  | { name: 'search' }
```

- [ ] **Step 2: Create `src/renderer/src/screens/Explore.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { FavoriteArtist, HomeFeed, Track } from '../../../shared/types'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import { formatTime } from '../components/TrackRow'
import { ArtistLinks, pressable } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

const FEED_ERROR = 'Tidak bisa memuat bagian ini. Cek koneksi internetmu.'

/** Numbered rows with a small cover: number, cover, title and artist, duration. Clicking plays from that row. */
function RankedRows({ tracks, onPlay }: { tracks: Track[]; onPlay: (index: number) => void }): React.JSX.Element {
  const player = usePlayer()
  return (
    <ol className="ex-rows">
      {tracks.map((t, i) => (
        <li key={`${t.videoId}-${i}`}>
          <div className={`ex-row press${player.track?.videoId === t.videoId ? ' playing' : ''}`} {...pressable(() => onPlay(i))}>
            <span className="ex-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="ex-thumb" style={{ backgroundImage: `url("${t.coverUrl}")` }} />
            <span className="ex-text">
              <span className="ex-title">{t.title}</span>
              <ArtistLinks className="ex-artist" artist={t.artist} />
            </span>
            <span className="ex-time">{t.durationSec > 0 ? formatTime(t.durationSec) : ''}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RowsSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <div className="ex-rows" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ex-skel skeleton" />
      ))}
    </div>
  )
}

/** Everything that left Beranda: moods and genres, the full chart, new releases, favourite artists, new videos. */
export function Explore({ nav }: { nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [failed, setFailed] = useState(false)
  const [artists, setArtists] = useState<FavoriteArtist[]>([])

  useEffect(() => {
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFailed(true))
    window.phinas.listFavoriteArtists(6).then(setArtists).catch(() => setArtists([]))
  }, [])

  /** A feed section shows while loading (placeholders) and on failure (the error line); hidden only when empty. */
  const shown = (count: number | undefined): boolean => !feed || (count ?? 0) > 0
  const error = <p className="muted">{FEED_ERROR}</p>

  return (
    <div className="explore">
      <h1 className="page-title">Jelajah</h1>

      {shown(feed?.genres.length) && (
        <section className="sec">
          <h2 className="section-title">Mood &amp; genre</h2>
          {feed ? (
            <div className="ex-pills">
              {feed.genres.map((g) => (
                <button key={g.params} className="ex-pill" onClick={() => nav({ name: 'genre', id: g.params, title: g.title })}>
                  {g.title}
                </button>
              ))}
            </div>
          ) : failed ? (
            error
          ) : (
            <div className="ex-pills" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="ex-pill skeleton" />
              ))}
            </div>
          )}
        </section>
      )}

      {shown(feed?.trending.length) && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="section-title">Lagi ramai</h2>
            {feed?.trendingId && (
              <button className="text-link ex-more" onClick={() => nav({ name: 'public', id: feed.trendingId!, author: 'YouTube Music' })}>
                Lihat semua
              </button>
            )}
          </div>
          {feed ? (
            <RankedRows tracks={feed.trending.slice(0, 10)} onPlay={(i) => player.play(feed.trending, i)} />
          ) : failed ? (
            error
          ) : (
            <RowsSkeleton count={5} />
          )}
        </section>
      )}

      {shown(feed?.releases.length) && (
        <section className="sec">
          <h2 className="section-title">Rilis baru</h2>
          {feed ? (
            <CoverGrid
              four
              items={feed.releases.slice(0, 8).map((r) => ({
                key: r.id,
                art: r.coverUrl,
                title: r.title,
                // "Album • 2026" or "Single • 2026" (see mapNewRelease).
                meta: r.author,
                onOpen: () => nav({ name: 'album', id: r.id })
              }))}
            />
          ) : failed ? (
            error
          ) : (
            <CoverGridSkeleton four count={4} />
          )}
        </section>
      )}

      {artists.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Artis favoritmu</h2>
          <ol className="ex-rows">
            {artists.map((a) => (
              <li key={a.artist}>
                <button className="ex-row" onClick={() => nav({ name: 'artist', id: a.artist })} aria-label={`Buka ${a.artist}`}>
                  <span className="ex-thumb round" style={{ backgroundImage: `url("${a.coverUrl}")` }} />
                  <span className="ex-text">
                    <span className="ex-title">{a.artist}</span>
                    <span className="ex-artist">{a.plays} kali diputar</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {shown(feed?.videos.length) && (
        <section className="sec">
          <h2 className="section-title">Video baru</h2>
          {feed ? (
            <RankedRows tracks={feed.videos.slice(0, 6)} onPlay={(i) => player.play(feed.videos, i)} />
          ) : failed ? (
            error
          ) : (
            <RowsSkeleton count={3} />
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Route it (`src/renderer/src/App.tsx`)**

Replace:

```tsx
import { Home } from './screens/Home'
```

with:

```tsx
import { Home } from './screens/Home'
import { Explore } from './screens/Explore'
```

Replace:

```tsx
      case 'home':
        return <Home nav={nav} name={profile.name} />
```

with:

```tsx
      case 'home':
        return <Home nav={nav} name={profile.name} />
      case 'explore':
        return <Explore nav={nav} />
```

- [ ] **Step 4: Sidebar entry (`src/renderer/src/components/Sidebar.tsx`)**

Replace:

```tsx
        <NavItem label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
```

with:

```tsx
        <NavItem label="Beranda" active={view.name === 'home'} onClick={() => nav({ name: 'home' })} />
        <NavItem label="Jelajah" active={view.name === 'explore'} onClick={() => nav({ name: 'explore' })} />
```

- [ ] **Step 5: Append to `src/renderer/src/styles/explore.css`**

```css

.ex-pills { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 16px; }
.ex-pill { height: 30px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; font-size: 12px; color: var(--ink); transition: border-color 0.15s, color 0.15s; }
.ex-pill:hover { border-color: var(--accent); color: var(--accent); }
.ex-pill.skeleton { width: 84px; border: 0; }
.ex-rows { list-style: none; margin: 0 0 16px; padding: 0; }
.ex-row { display: flex; align-items: center; gap: 14px; width: 100%; padding: 7px 8px; border-bottom: 1px solid var(--line); text-align: left; transition: background 0.15s; }
.ex-row:hover { background: color-mix(in srgb, var(--line) 55%, transparent); }
.ex-row.playing .ex-title, .ex-row.playing .ex-num { color: var(--accent); }
.ex-num { width: 22px; flex: none; font-family: var(--serif); font-size: 15px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.ex-thumb { width: 36px; height: 36px; flex: none; background: var(--line) center / cover; }
.ex-thumb.round { border-radius: 50%; }
.ex-text { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.35; }
.ex-title, .ex-artist { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ex-title { font-weight: 700; }
.ex-artist { font-size: 11px; color: var(--ink-soft); }
.ex-time { flex: none; font-size: 11px; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.ex-skel { height: 51px; margin-bottom: 1px; }
```

- [ ] **Step 6: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed. (Typecheck proves the `switch` in `App.tsx` covers `explore`.)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/views.ts src/renderer/src/screens/Explore.tsx src/renderer/src/App.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/styles/explore.css
git commit -m "$(cat <<'EOF'
feat(explore): Jelajah page with moods, chart, releases, artists and videos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Beranda

**Files:**
- Create: `src/renderer/src/screens/home/dayPart.ts`, `tests/home-label.test.ts`
- Create: `src/renderer/src/screens/home/lists.ts`, `tests/home-lists.test.ts`
- Create: `src/renderer/src/components/NumberedList.tsx`
- Create: `src/renderer/src/components/BerduaLine.tsx`
- Rewrite: `src/renderer/src/screens/Home.tsx`
- Modify: `src/renderer/src/styles/home.css`

- [ ] **Step 1: Write the failing tests**

Create `tests/home-label.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { dayPart, homeLabel } from '../src/renderer/src/screens/home/dayPart'

describe('dayPart', () => {
  test.each<[number, string]>([
    [0, 'malam'],
    [3, 'malam'],
    [4, 'pagi'],
    [10, 'pagi'],
    [11, 'siang'],
    [14, 'siang'],
    [15, 'sore'],
    [17, 'sore'],
    [18, 'malam'],
    [23, 'malam']
  ])('%i:00 is %s', (hour, part) => {
    expect(dayPart(hour)).toBe(part)
  })
})

describe('homeLabel', () => {
  // 19 November 2026 is a Thursday.
  const thursdayAfternoon = new Date(2026, 10, 19, 16, 30)

  test('day, day part and name, in capitals', () => {
    expect(homeLabel(thursdayAfternoon, 'Rafi')).toBe('KAMIS SORE · UNTUK RAFI')
  })
  test('without a name: UNTUKMU', () => {
    expect(homeLabel(thursdayAfternoon, '  ')).toBe('KAMIS SORE · UNTUKMU')
  })
  test('the placeholder name "Kamu" counts as no name', () => {
    expect(homeLabel(thursdayAfternoon, 'Kamu')).toBe('KAMIS SORE · UNTUKMU')
  })
  test('Sunday morning', () => {
    expect(homeLabel(new Date(2026, 10, 22, 7, 0), 'Nadia')).toBe('MINGGU PAGI · UNTUK NADIA')
  })
})
```

Create `tests/home-lists.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { forYouList, trendingList } from '../src/renderer/src/screens/home/lists'
import type { HomeFeed, Track } from '../src/shared/types'

const t = (id: string): Track => ({ videoId: id, title: id, artist: 'A', coverUrl: '', durationSec: 200 })
const feed = (over: Partial<HomeFeed> = {}): HomeFeed => ({
  trending: [t('trend')],
  picks: [t('pick')],
  genres: [],
  releases: [],
  videos: [],
  ...over
})

describe('forYouList', () => {
  test('personal recommendations win', () => {
    expect(forYouList([t('rec')], feed(), false)).toEqual({ tracks: [t('rec')], failed: false })
  })
  test('loading while the recommendations request is pending', () => {
    expect(forYouList(null, feed(), false)).toEqual({ tracks: null, failed: false })
  })
  test("no recommendations: the feed's picks", () => {
    expect(forYouList([], feed(), false)).toEqual({ tracks: [t('pick')], failed: false })
  })
  test('no recommendations and the feed still loading', () => {
    expect(forYouList([], null, false)).toEqual({ tracks: null, failed: false })
  })
  test('no recommendations and the feed failed', () => {
    expect(forYouList([], null, true)).toEqual({ tracks: null, failed: true })
  })
})

describe('trendingList', () => {
  test('the feed’s chart once loaded', () => {
    expect(trendingList(feed(), false)).toEqual({ tracks: [t('trend')], failed: false })
  })
  test('loading', () => {
    expect(trendingList(null, false)).toEqual({ tracks: null, failed: false })
  })
  test('failed', () => {
    expect(trendingList(null, true)).toEqual({ tracks: null, failed: true })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/home-label.test.ts tests/home-lists.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `src/renderer/src/screens/home/dayPart.ts`**

```ts
export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam'

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Malam before 4, pagi before 11, siang before 15, sore before 18, malam otherwise. */
export function dayPart(hour: number): DayPart {
  if (hour < 4) return 'malam'
  if (hour < 11) return 'pagi'
  if (hour < 15) return 'siang'
  if (hour < 18) return 'sore'
  return 'malam'
}

/** useProfile shows "Kamu" when no name was set; that counts as no name here. */
const NO_NAME = /^(kamu)?$/i

/** Beranda's label, e.g. "KAMIS SORE · UNTUK RAFI", or "… · UNTUKMU" without a name. */
export function homeLabel(now: Date, name: string): string {
  const who = NO_NAME.test(name.trim()) ? 'untukmu' : `untuk ${name.trim()}`
  return `${DAYS[now.getDay()]} ${dayPart(now.getHours())} · ${who}`.toUpperCase()
}
```

- [ ] **Step 4: Create `src/renderer/src/screens/home/lists.ts`**

```ts
import type { HomeFeed, Track } from '../../../../shared/types'

/** `tracks` is null while loading; `failed` shows the error line instead. */
export interface ListState {
  tracks: Track[] | null
  failed: boolean
}

/**
 * Untukmu: personal recommendations when there are any, otherwise the feed's picks.
 * `recs` is null until the recommendations request settles ([] when none or on failure).
 */
export function forYouList(recs: Track[] | null, feed: HomeFeed | null, feedFailed: boolean): ListState {
  if (recs === null) return { tracks: null, failed: false }
  if (recs.length > 0) return { tracks: recs, failed: false }
  if (feed) return { tracks: feed.picks, failed: false }
  return { tracks: null, failed: feedFailed }
}

/** Lagi ramai: the feed's trending chart. */
export function trendingList(feed: HomeFeed | null, feedFailed: boolean): ListState {
  if (feed) return { tracks: feed.trending, failed: false }
  return { tracks: null, failed: feedFailed }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/home-label.test.ts tests/home-lists.test.ts tests/continue.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `src/renderer/src/components/NumberedList.tsx`**

```tsx
import type { Track } from '../../../shared/types'
import { usePlayer } from '../player/PlayerProvider'

const num = (i: number): string => String(i + 1).padStart(2, '0')

interface Props {
  title: string
  /** Makes the serif title a link (Beranda's lists open Jelajah). */
  onTitle?: () => void
  /** null while loading (placeholder rows); an empty list hides the section. */
  tracks: Track[] | null
  failed: boolean
  errorText: string
  onPlay: (index: number) => void
  rows?: number
}

/** A short numbered text list: "01  Title — Artist". Clicking a row plays the list from it. */
export function NumberedList({ title, onTitle, tracks, failed, errorText, onPlay, rows = 4 }: Props): React.JSX.Element | null {
  const player = usePlayer()
  if (tracks && tracks.length === 0) return null
  return (
    <section className="nl" aria-label={title}>
      {onTitle ? (
        <button className="section-title" onClick={onTitle}>
          {title}
        </button>
      ) : (
        <h2 className="section-title">{title}</h2>
      )}
      {failed ? (
        <p className="muted">{errorText}</p>
      ) : tracks === null ? (
        <ol className="nl-rows" aria-busy="true">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="nl-row nl-skel">
              <span className="nl-num">{num(i)}</span>
              <span className="nl-bar skeleton" />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="nl-rows">
          {tracks.slice(0, rows).map((t, i) => (
            <li key={`${t.videoId}-${i}`}>
              <button className={`nl-row${player.track?.videoId === t.videoId ? ' playing' : ''}`} onClick={() => onPlay(i)}>
                <span className="nl-num">{num(i)}</span>
                <span className="nl-text">
                  {t.title} <span className="nl-artist">— {t.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

- [ ] **Step 7: Create `src/renderer/src/components/BerduaLine.tsx`**

```tsx
import { useListen } from '../sync/ListenTogetherProvider'

/**
 * Beranda's partner line: online dot, name (opens Berdua), presence, and the Listen Together
 * action of the current state. Only when signed in with a partner.
 */
export function BerduaLine({ onOpen }: { onOpen: () => void }): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'Pasangan'
  const online = connected && partnerHere
  const presence = !connected ? 'tidak terhubung' : partnerHere ? 'sedang online' : 'offline'

  let action: React.ReactNode
  if (status === 'active') {
    action = (
      <button className="text-link" onClick={l.end}>
        Akhiri
      </button>
    )
  } else if (status === 'inviting') {
    action = (
      <button className="text-link" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    action = (
      <span className="berdua-actions">
        <button className="text-link" onClick={l.accept}>
          Terima
        </button>
        <span aria-hidden="true">·</span>
        <button className="text-link" onClick={l.decline}>
          Tolak
        </button>
      </span>
    )
  } else {
    action = (
      <button className="text-link" onClick={l.invite} disabled={!online}>
        Ajak dengar bareng
      </button>
    )
  }

  return (
    <div className="berdua-line" role="group" aria-label="Berdua">
      <span className={`online-dot${online ? '' : ' off'}`} aria-hidden="true" />
      <button className="berdua-name" onClick={onOpen}>
        {name}
      </button>
      <span className="muted">{presence}</span>
      <span className="berdua-spacer" />
      {action}
    </div>
  )
}
```

- [ ] **Step 8: Rewrite `src/renderer/src/screens/Home.tsx`**

```tsx
import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomeFeed, Track } from '../../../shared/types'
import { BerduaLine } from '../components/BerduaLine'
import { NumberedList } from '../components/NumberedList'
import { ArtistLinks } from '../nav/NavProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'
import { continueTrack } from './home/continue'
import { homeLabel } from './home/dayPart'
import { forYouList, trendingList } from './home/lists'

/** The big top block: continue the loaded or last-played track, or a way to start. */
function CoverStory({ recent, nav }: { recent: Track[] | null; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  if (!player.track && recent === null) {
    return (
      <div className="story" aria-busy="true">
        <div className="story-cover skeleton" />
      </div>
    )
  }
  const pick = continueTrack(player.track, recent ?? [])
  if (!pick) {
    return (
      <div className="story">
        <div className="story-text">
          <h1 className="story-title">
            Mulai dari <em>sini.</em>
          </h1>
          <p className="muted">Cari lagu atau buka Jelajah</p>
          <div className="story-actions">
            <button className="btn" onClick={() => player.run('focusSearch')}>
              Cari
            </button>
            <button className="btn secondary" onClick={() => nav({ name: 'explore' })}>
              Jelajah
            </button>
          </div>
        </div>
      </div>
    )
  }
  const { track, isCurrent } = pick
  const playing = isCurrent && player.playing
  return (
    <div className="story">
      <div className="story-cover" style={{ backgroundImage: `url("${track.coverUrl}")` }} />
      <div className="story-text">
        <h1 className="story-title">
          Lanjutkan
          <em>{track.title}.</em>
        </h1>
        <ArtistLinks className="story-artist" artist={track.artist} />
        <div className="story-actions">
          {/* The loaded track pauses and resumes; otherwise the history plays from that track. */}
          <button className="btn" onClick={() => (isCurrent ? player.toggle() : player.play(recent ?? [track], 0))}>
            {playing ? (
              <>
                <Pause size={13} fill="currentColor" /> Jeda
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" /> Putar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Home({ nav, name }: { nav: Nav; name: string }): React.JSX.Element {
  const player = usePlayer()
  const [feed, setFeed] = useState<HomeFeed | null>(null)
  const [feedFailed, setFeedFailed] = useState(false)
  const [recent, setRecent] = useState<Track[] | null>(null)
  const [recs, setRecs] = useState<Track[] | null>(null)

  useEffect(() => {
    window.phinas.listRecentPlays(20).then(setRecent).catch(() => setRecent([]))
    // With no history yet, or when the request fails, the feed's picks are the fallback.
    window.phinas
      .getRecommendations()
      .then((r) => setRecs(r.personalized ? r.tracks : []))
      .catch(() => setRecs([]))
    window.phinas.getHomeFeed().then(setFeed).catch(() => setFeedFailed(true))
  }, [])

  const forYou = forYouList(recs, feed, feedFailed)
  const trending = trendingList(feed, feedFailed)
  const explore = (): void => nav({ name: 'explore' })

  return (
    <div className="home">
      <div className="label accent">{homeLabel(new Date(), name)}</div>
      <CoverStory recent={recent} nav={nav} />
      <BerduaLine onOpen={() => nav({ name: 'together' })} />
      <div className="home-lists">
        <NumberedList
          title="Untukmu"
          onTitle={explore}
          tracks={forYou.tracks}
          failed={forYou.failed}
          errorText="Tidak bisa memuat rekomendasi. Cek koneksi internetmu."
          onPlay={(i) => forYou.tracks && player.play(forYou.tracks, i)}
        />
        <NumberedList
          title="Lagi ramai"
          onTitle={explore}
          tracks={trending.tracks}
          failed={trending.failed}
          errorText="Tidak bisa memuat yang lagi tren. Cek koneksi internetmu."
          onPlay={(i) => trending.tracks && player.play(trending.tracks, i)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Append to `src/renderer/src/styles/home.css`**

```css

.home { padding-top: 36px; }
/* Cover story */
.story { display: flex; align-items: flex-end; gap: 24px; min-height: 170px; margin-top: 14px; }
.story-cover { width: 170px; height: 170px; flex: none; background: var(--line) center / cover; box-shadow: var(--cover-shadow); }
.story-text { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; min-width: 0; }
.story-title { font-family: var(--serif); font-size: 44px; font-weight: 400; line-height: 0.95; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.story-title em { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; padding-bottom: 0.06em; font-style: italic; color: var(--accent); }
.story-text .muted { margin: 0; font-size: 12px; }
.story-artist { font-size: 12px; color: var(--ink-soft); }
.story-actions { display: flex; gap: 8px; }
/* Berdua line */
.berdua-line { display: flex; align-items: center; gap: 8px; margin-top: 24px; padding: 10px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 12px; }
.berdua-name { padding: 0; font-weight: 700; color: var(--ink); }
.berdua-name:hover { color: var(--accent); }
.berdua-spacer { flex: 1; }
.berdua-actions { display: inline-flex; align-items: center; gap: 8px; color: var(--ink-faint); }
/* Untukmu and Lagi ramai, side by side; one column when the content is narrower than 760 px. */
.home-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px; margin-top: 22px; }
@container (max-width: 760px) { .home-lists { grid-template-columns: minmax(0, 1fr); } }
.nl-rows { list-style: none; margin: 0; padding: 0; }
.nl-row { justify-content: flex-start; gap: 12px; width: 100%; min-width: 0; padding: 4px 0; font-size: 12px; line-height: 1.6; text-align: left; color: var(--ink); }
.nl-row:hover .nl-text, .nl-row.playing .nl-text, .nl-row.playing .nl-num { color: var(--accent); }
.nl-num { flex: none; width: 20px; font-family: var(--serif); font-size: 14px; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.nl-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nl-artist { color: var(--ink-soft); }
.nl-skel { display: flex; align-items: center; }
.nl-bar { flex: 1; max-width: 220px; height: 10px; }
```

- [ ] **Step 10: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed. `grep -n "Bento\|ListenCard\|genreIcon" src/renderer/src/screens/Home.tsx` prints nothing.

- [ ] **Step 11: Commit**

```bash
git add src/renderer/src/screens/home/dayPart.ts src/renderer/src/screens/home/lists.ts tests/home-label.test.ts tests/home-lists.test.ts src/renderer/src/components/NumberedList.tsx src/renderer/src/components/BerduaLine.tsx src/renderer/src/screens/Home.tsx src/renderer/src/styles/home.css
git commit -m "$(cat <<'EOF'
feat(home): quiet Beranda with cover story, Berdua line and two short lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Restyle Search, Disukai, Riwayat and the playlist screens

Uses `CollectionHeader`, `AccentTitle`, `TrackListHead`, `TrackRow` and `CoverGrid` from Task 7. Behaviour (loading, saving, renaming, removing, playing) is unchanged.

**Files:**
- Rewrite: `src/renderer/src/screens/Search.tsx`
- Rewrite: `src/renderer/src/screens/LikedView.tsx`
- Rewrite: `src/renderer/src/screens/RecentView.tsx`
- Rewrite: `src/renderer/src/screens/PlaylistView.tsx`
- Rewrite: `src/renderer/src/screens/PartnerView.tsx`
- Rewrite: `src/renderer/src/screens/PublicPlaylistView.tsx`

- [ ] **Step 1: Rewrite `src/renderer/src/screens/Search.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import type { PublicPlaylist, Track } from '../../../shared/types'
import { CoverGrid } from '../components/CoverGrid'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

const DEBOUNCE_MS = 350

interface Props {
  query: string
  /** Bumped when Enter is pressed: search right away instead of waiting for typing to pause. */
  submitNonce: number
  /** A song was picked from the results. */
  onPick: (track: Track, typed: string) => void
  nav: Nav
}

export function Search({ query, submitNonce, onPick, nav }: Props): React.JSX.Element {
  const player = usePlayer()
  const [results, setResults] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Ignore answers from older requests when the user keeps typing.
  const requestId = useRef(0)
  const seenNonce = useRef(submitNonce)

  useEffect(() => {
    const q = query.trim()
    const id = ++requestId.current
    if (!q) {
      setResults([])
      setPlaylists([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const immediate = seenNonce.current !== submitNonce
    seenNonce.current = submitNonce
    const timer = setTimeout(async () => {
      // Playlists are a bonus: if they fail to load, the songs still show.
      window.phinas
        .searchPlaylists(q)
        .then((found) => id === requestId.current && setPlaylists(found))
        .catch(() => id === requestId.current && setPlaylists([]))
      try {
        const found = await window.phinas.search(q)
        if (id !== requestId.current) return
        setResults(found)
        setError(null)
      } catch {
        if (id !== requestId.current) return
        setError('Pencarian gagal. Cek koneksi internet kamu.')
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, immediate ? 0 : DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, submitNonce])

  const q = query.trim()

  return (
    <>
      {error && <div className="notice">{error}</div>}

      {q && (
        <>
          <h1 className="page-title">
            Hasil untuk <em>&ldquo;{q}&rdquo;</em>
          </h1>
          {loading && results.length === 0 && <p className="muted">Mencari...</p>}
          {!loading && !error && results.length === 0 && <p className="muted">Tidak ada hasil.</p>}
          {results.length > 0 && (
            <section className="sec">
              <h2 className="section-title">Lagu</h2>
              <TrackListHead />
              {results.map((t, i) => (
                <TrackRow
                  key={t.videoId}
                  track={t}
                  index={i}
                  onPlay={() => {
                    onPick(t, q)
                    // Only the picked song: the other results are mostly versions of the same one.
                    // Autoplay fills in what comes next from recommendations.
                    player.play([t], 0)
                  }}
                />
              ))}
            </section>
          )}
          {playlists.length > 0 && (
            <section className="sec">
              <h2 className="section-title">Playlist</h2>
              <CoverGrid
                items={playlists.map((p) => ({
                  key: p.id,
                  art: p.coverUrl,
                  title: p.title,
                  meta: p.author,
                  onOpen: () => nav({ name: 'public', id: p.id, author: p.author })
                }))}
              />
            </section>
          )}
        </>
      )}
    </>
  )
}
```

- [ ] **Step 2: Rewrite `src/renderer/src/screens/LikedView.tsx`**

```tsx
import { Heart } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'

export function LikedView(): React.JSX.Element {
  const player = usePlayer()
  const { likes } = useLibrary()
  return (
    <>
      <CollectionHeader
        cover={
          <div className="pcover pcover-icon">
            <Heart size={48} fill="currentColor" />
          </div>
        }
        kind="Playlist"
        title="Lagu yang disukai"
        meta={`${likes.length} lagu`}
        tracks={likes}
      />
      {likes.length === 0 ? <p className="muted">Belum ada lagu yang disukai. Tekan ikon hati di lagu mana pun.</p> : <TrackListHead />}
      {likes.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(likes, i)} />
      ))}
    </>
  )
}
```

- [ ] **Step 3: Rewrite `src/renderer/src/screens/RecentView.tsx`**

```tsx
import { History } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Track } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'

export function RecentView(): React.JSX.Element {
  const player = usePlayer()
  const [tracks, setTracks] = useState<Track[] | null>(null)

  useEffect(() => {
    window.phinas.listRecentPlays(50).then(setTracks).catch(() => setTracks([]))
  }, [])

  const list = tracks ?? []
  return (
    <>
      <CollectionHeader
        cover={
          <div className="pcover pcover-icon">
            <History size={48} />
          </div>
        }
        kind="Riwayat"
        title="Baru diputar"
        meta={`${list.length} lagu`}
        tracks={list}
      />
      {tracks && list.length === 0 && (
        <p className="muted">Belum ada riwayat. Lagu yang kamu dengarkan lebih dari 30 detik akan muncul di sini.</p>
      )}
      {list.length > 0 && <TrackListHead />}
      {list.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(list, i)} />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Rewrite `src/renderer/src/screens/PlaylistView.tsx`**

```tsx
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PlaylistWithTracks } from '../../../shared/types'
import { AccentTitle, CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

export function PlaylistView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [pl, setPl] = useState<PlaylistWithTracks | null>(null)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // Reload whenever the library changes (track added or removed elsewhere, renamed, ...).
  useEffect(() => {
    let alive = true
    window.phinas.getPlaylist(id).then((p) => {
      if (!alive) return
      setPl(p)
      setMissing(p === null)
    })
    return () => {
      alive = false
    }
  }, [id, lib.playlists])

  if (missing) return <p className="muted">Playlist ini sudah tidak ada.</p>
  if (!pl) return <p className="muted">Memuat...</p>

  const commitName = async (): Promise<void> => {
    setEditing(false)
    const name = draft.trim()
    if (name && name !== pl.name) {
      await window.phinas.renamePlaylist(pl.id, name)
      await lib.refresh()
    }
  }

  const remove = async (): Promise<void> => {
    if (!confirm(`Hapus playlist "${pl.name}"?`)) return
    await window.phinas.deletePlaylist(pl.id)
    await lib.refresh()
    nav({ name: 'home' })
  }

  return (
    <>
      <CollectionHeader
        cover={<PlaylistCover covers={pl.coverUrls} />}
        kind="Playlist"
        title={
          editing ? (
            <input
              className="title-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitName()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <button
              className="title-button"
              title="Klik untuk mengganti nama"
              onClick={() => {
                setDraft(pl.name)
                setEditing(true)
              }}
            >
              <AccentTitle text={pl.name} />
            </button>
          )
        }
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="icon-btn" onClick={remove} aria-label="Hapus playlist" title="Hapus playlist">
          <Trash2 size={16} />
        </button>
      </CollectionHeader>

      {pl.tracks.length === 0 ? (
        <p className="muted">Playlist ini masih kosong. Cari lagu lalu tambahkan dari menu di barisnya.</p>
      ) : (
        <TrackListHead />
      )}
      {pl.tracks.map((t, i) => (
        <TrackRow
          key={t.videoId}
          track={t}
          index={i}
          onPlay={() => player.play(pl.tracks, i)}
          onRemove={async () => {
            await window.phinas.removeTrack(pl.id, t.videoId)
            await lib.refresh()
          }}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 5: Rewrite `src/renderer/src/screens/PartnerView.tsx`**

```tsx
import { CopyPlus } from 'lucide-react'
import { CollectionHeader } from '../components/CollectionHeader'
import { PlaylistCover } from '../components/PlaylistCover'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

export function PartnerView({ id, nav }: { id: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const pl = lib.partner.find((p) => p.id === id)

  if (!pl) return <p className="muted">Playlist pasangan ini tidak tersedia.</p>

  const copy = async (): Promise<void> => {
    const c = await window.phinas.copyPartnerPlaylist(pl)
    await lib.refresh()
    nav({ name: 'playlist', id: c.id })
  }

  return (
    <>
      <CollectionHeader
        cover={<PlaylistCover covers={pl.coverUrls} />}
        kind={`Playlist dari ${pl.ownerName}`}
        title={pl.name}
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="btn secondary" onClick={copy}>
          <CopyPlus size={13} /> Salin ke library saya
        </button>
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
```

- [ ] **Step 6: Rewrite `src/renderer/src/screens/PublicPlaylistView.tsx`**

```tsx
import { CopyPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PublicPlaylistDetail } from '../../../shared/types'
import { CollectionHeader } from '../components/CollectionHeader'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { useLibrary } from '../library/LibraryProvider'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; playlist: PublicPlaylistDetail }

interface Props {
  id: string
  author?: string
  /** An album or single (opened from an artist page) instead of a playlist. */
  album?: boolean
  nav: Nav
}

/** A playlist or album from YouTube Music's public catalogue: play it, or save a copy to the library. */
export function PublicPlaylistView({ id, author, album = false, nav }: Props): React.JSX.Element {
  const player = usePlayer()
  const lib = useLibrary()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    ;(album ? window.phinas.getAlbum(id) : window.phinas.getPublicPlaylist(id))
      .then((playlist) => !cancelled && setState({ status: 'ready', playlist }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [id, album])

  const noun = album ? 'album' : 'playlist'
  if (state.status === 'loading') return <p className="muted">Memuat {noun}...</p>
  if (state.status === 'error') return <div className="notice">{album ? 'Album' : 'Playlist'} ini tidak bisa dibuka. Cek koneksi internet kamu.</div>

  const pl = state.playlist
  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const copy = await window.phinas.createPlaylist(pl.title)
      for (const t of pl.tracks) await window.phinas.addTrack(copy.id, t)
      await lib.refresh()
      nav({ name: 'playlist', id: copy.id })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CollectionHeader
        cover={<div className="pcover" style={{ backgroundImage: `url("${pl.coverUrl}")` }} />}
        kind={album ? `Album · ${pl.author}` : `Playlist dari ${author ?? pl.author}`}
        title={pl.title}
        meta={`${pl.tracks.length} lagu`}
        tracks={pl.tracks}
      >
        <button className="btn secondary" onClick={() => void save()} disabled={saving || pl.tracks.length === 0}>
          <CopyPlus size={13} /> {saving ? 'Menyimpan...' : 'Simpan ke library saya'}
        </button>
      </CollectionHeader>
      {pl.tracks.length > 0 && <TrackListHead />}
      {pl.tracks.map((t, i) => (
        <TrackRow key={`${t.videoId}-${i}`} track={t} index={i} onPlay={() => player.play(pl.tracks, i)} />
      ))}
    </>
  )
}
```

- [ ] **Step 7: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed. `grep -ln "MediaCard\|Shelf" src/renderer/src/screens/{Search,LikedView,RecentView,PlaylistView,PartnerView,PublicPlaylistView}.tsx` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/screens/Search.tsx src/renderer/src/screens/LikedView.tsx src/renderer/src/screens/RecentView.tsx src/renderer/src/screens/PlaylistView.tsx src/renderer/src/screens/PartnerView.tsx src/renderer/src/screens/PublicPlaylistView.tsx
git commit -m "$(cat <<'EOF'
feat(ui): editorial Search, Disukai, Riwayat and playlist screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Restyle Artis, Genre, Impor and Berdua

**Files:**
- Rewrite: `src/renderer/src/screens/ArtistView.tsx`
- Rewrite: `src/renderer/src/screens/GenreView.tsx`
- Rewrite: `src/renderer/src/screens/ImportView.tsx`
- Rewrite: `src/renderer/src/screens/TogetherView.tsx`
- Rewrite: `src/renderer/src/components/ListenCard.tsx`
- Modify: `src/renderer/src/styles/lists.css`
- Prune: `src/renderer/src/styles/legacy.css`

- [ ] **Step 1: Prune the old import, listen card and artist rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(import-[a-z-]+|listen-card|artist-more|artist-skel)\b'`
Expected: `prune-legacy-css: removed 28 rule(s)`.

- [ ] **Step 2: Append to `src/renderer/src/styles/lists.css`**

```css

/* ---------- Artis ---------- */
.artist-more { margin: 14px 0 22px; }

/* ---------- Impor ---------- */
.import-hint { max-width: 640px; line-height: 1.7; color: var(--ink-soft); }
.import-form { display: flex; gap: 10px; max-width: 640px; margin-top: 14px; }
.import-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; max-width: 640px; margin: 22px 0 8px; }
.import-summary .field { flex: 1; min-width: 200px; font-weight: 600; }
.import-missing { max-width: 640px; margin: 8px 0 20px; color: var(--ink-soft); }
.import-missing summary { padding: 8px 0; cursor: pointer; }
.import-missing ul { margin: 0; padding-left: 18px; }

/* ---------- Berdua ---------- */
.listen-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 0 0 26px; }
.listen-card-title { font-family: var(--serif); font-size: 30px; line-height: 1.05; }
.listen-card-title em { font-style: italic; color: var(--accent); }
.listen-card-actions { display: flex; gap: 8px; margin-top: 6px; }
```

- [ ] **Step 3: Rewrite `src/renderer/src/screens/ArtistView.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { ArtistDetail } from '../../../shared/types'
import { AccentTitle, CollectionHeader } from '../components/CollectionHeader'
import { CoverGrid } from '../components/CoverGrid'
import { TrackListHead, TrackRow } from '../components/TrackRow'
import { usePlayer } from '../player/PlayerProvider'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; artist: ArtistDetail }

/** How many songs show before "Lihat semua". */
const SONGS_PREVIEW = 10

/** An artist from YouTube Music: their songs, albums and singles. */
export function ArtistView({ name, nav }: { name: string; nav: Nav }): React.JSX.Element {
  const player = usePlayer()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [allSongs, setAllSongs] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setAllSongs(false)
    window.phinas
      .getArtist(name)
      .then((artist) => {
        if (cancelled) return
        setState({ status: 'ready', artist })
        // The page shows with the top songs; the full list replaces them when it arrives.
        window.phinas
          .getArtistSongs(artist.id)
          .then((songs) => {
            if (cancelled || songs.length <= artist.songs.length) return
            setState({ status: 'ready', artist: { ...artist, songs } })
          })
          .catch(() => {
            /* keep the top songs */
          })
      })
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [name])

  if (state.status === 'loading') {
    return (
      <div aria-busy="true" aria-label={`Memuat ${name}`}>
        <header className="ch">
          <div className="ch-cover artist-hero skeleton" />
          <div className="ch-info">
            <div className="label accent">Artis</div>
            <h1 className="ch-title">
              <AccentTitle text={name} />
            </h1>
          </div>
        </header>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="tl-skel skeleton" />
        ))}
      </div>
    )
  }
  if (state.status === 'error') return <div className="notice">Halaman {name} tidak bisa dibuka. Cek koneksi internet kamu.</div>

  const a = state.artist
  const shown = allSongs ? a.songs : a.songs.slice(0, SONGS_PREVIEW)
  return (
    <>
      <CollectionHeader
        cover={<div className="artist-hero" style={{ backgroundImage: `url("${a.photoUrl}")` }} />}
        kind="Artis"
        title={a.name}
        meta={a.releases.length ? `${a.releases.length} album & single` : ''}
        tracks={a.songs}
      />
      {a.songs.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Lagu populer</h2>
          <TrackListHead />
          {shown.map((t, i) => (
            <TrackRow key={`${t.videoId}-${i}`} track={t} index={i} onPlay={() => player.play(a.songs, i)} />
          ))}
          {a.songs.length > SONGS_PREVIEW && (
            <button className="btn secondary artist-more" onClick={() => setAllSongs((v) => !v)}>
              {allSongs ? 'Tampilkan lebih sedikit' : `Lihat semua (${a.songs.length})`}
            </button>
          )}
        </section>
      )}
      {a.releases.length > 0 && (
        <section className="sec">
          <h2 className="section-title">Album &amp; single</h2>
          <CoverGrid
            items={a.releases.map((r) => ({
              key: r.id,
              art: r.coverUrl,
              title: r.title,
              meta: r.author,
              onOpen: () => nav({ name: 'album', id: r.id })
            }))}
          />
        </section>
      )}
    </>
  )
}
```

- [ ] **Step 4: Rewrite `src/renderer/src/screens/GenreView.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { GenrePage } from '../../../shared/types'
import { AccentTitle } from '../components/CollectionHeader'
import { CoverGrid, CoverGridSkeleton } from '../components/CoverGrid'
import type { Nav } from '../views'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; page: GenrePage }

/** A mood or genre from YouTube Music: sections of playlists and albums. */
export function GenreView({ params, title, nav }: { params: string; title: string; nav: Nav }): React.JSX.Element {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    window.phinas
      .getGenre(params)
      .then((page) => !cancelled && setState({ status: 'ready', page }))
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [params])

  return (
    <>
      <h1 className="page-title">
        <AccentTitle text={title} />
      </h1>
      {state.status === 'loading' && <CoverGridSkeleton count={6} />}
      {state.status === 'error' && <div className="notice">{title} tidak bisa dibuka. Cek koneksi internet kamu.</div>}
      {state.status === 'ready' && state.page.shelves.length === 0 && <p className="muted">Belum ada isi untuk {title}.</p>}
      {state.status === 'ready' &&
        state.page.shelves.map((sh) => (
          <section key={sh.title} className="sec">
            <h2 className="section-title">{sh.title}</h2>
            <CoverGrid
              items={sh.playlists.map((p) => ({
                key: p.id,
                art: p.coverUrl,
                title: p.title,
                meta: p.author,
                onOpen: () => nav(sh.album ? { name: 'album', id: p.id } : { name: 'public', id: p.id, author: p.author })
              }))}
            />
          </section>
        ))}
    </>
  )
}
```

- [ ] **Step 5: Rewrite `src/renderer/src/screens/ImportView.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import type { ImportResult } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import type { Nav } from '../views'

type State =
  | { step: 'idle' }
  | { step: 'working' }
  | { step: 'error'; message: string }
  | { step: 'done'; result: ImportResult }

const cleanError = (e: unknown): string =>
  e instanceof Error ? e.message.replace(/^Error invoking remote method '\w+': Error: /, '') : 'Impor gagal.'

export function ImportView({ nav }: { nav: Nav }): React.JSX.Element {
  const lib = useLibrary()
  const [link, setLink] = useState('')
  const [state, setState] = useState<State>({ step: 'idle' })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!link.trim()) return
    setState({ step: 'working' })
    try {
      const result = await window.phinas.importSpotify(link.trim())
      setName(`${result.name} (dari Spotify)`)
      setState({ step: 'done', result })
    } catch (err) {
      setState({ step: 'error', message: cleanError(err) })
    }
  }

  const save = async (result: ImportResult): Promise<void> => {
    setSaving(true)
    try {
      const playlist = await window.phinas.createPlaylist(name.trim() || result.name)
      for (const t of result.matched) await window.phinas.addTrack(playlist.id, t)
      await lib.refresh()
      nav({ name: 'playlist', id: playlist.id })
    } catch (err) {
      setState({ step: 'error', message: cleanError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h1 className="page-title">
        Impor dari <em>Spotify</em>
      </h1>
      <p className="import-hint">
        Tempel link playlist atau album Spotify. Statusnya harus <strong>publik</strong>: di Spotify, buka playlist, pilih
        Bagikan, lalu Salin link. Lagunya dicari di YouTube Music, dan tidak perlu login atau akun Spotify di sini. Spotify
        hanya menampilkan sekitar 50-100 lagu pertama dari link publik.
      </p>

      <form className="import-form" onSubmit={run}>
        <input
          className="field"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          aria-label="Link Spotify"
          disabled={state.step === 'working'}
        />
        <button className="btn" type="submit" disabled={state.step === 'working' || !link.trim()}>
          {state.step === 'working' ? 'Mencari...' : 'Impor'}
        </button>
      </form>

      {state.step === 'error' && <div className="notice">{state.message}</div>}

      {state.step === 'done' && (
        <>
          <p className="import-summary">
            <strong>
              {state.result.matched.length} dari {state.result.total} lagu
            </strong>
            <span className="muted">ditemukan di YouTube Music.</span>
          </p>
          {state.result.matched.length === 0 ? (
            <div className="notice">Tidak ada lagu yang cocok, jadi tidak ada playlist yang dibuat.</div>
          ) : (
            <div className="import-summary">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nama playlist" />
              <button className="btn" disabled={saving} onClick={() => void save(state.result)}>
                {saving ? 'Menyimpan...' : `Buat playlist (${state.result.matched.length} lagu)`}
              </button>
            </div>
          )}
          {state.result.missing.length > 0 && (
            <details className="import-missing">
              <summary>{state.result.missing.length} lagu tidak ditemukan</summary>
              <ul>
                {state.result.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  )
}
```

- [ ] **Step 6: Rewrite `src/renderer/src/components/ListenCard.tsx`**

```tsx
import { useListen } from '../sync/ListenTogetherProvider'
import { liveLabel } from '../sync/status'
import { AccentTitle } from './CollectionHeader'

/** Berdua's listen-together block: invite, waiting, live status. Hidden when not signed in. */
export function ListenCard(): React.JSX.Element | null {
  const l = useListen()
  if (!l.available) return null
  const { status, connected, partnerHere } = l.state
  const name = l.partnerName ?? 'pasangan'

  let line: string
  let title = 'Dengarkan bareng'
  let actions: React.ReactNode
  if (status === 'active') {
    line = liveLabel(l.state, name)
    title = `Lagi bareng ${name}`
    actions = (
      <button className="btn" onClick={l.end}>
        Akhiri sesi
      </button>
    )
  } else if (status === 'inviting') {
    line = 'Ajakan terkirim'
    title = `Menunggu ${name}…`
    actions = (
      <button className="btn secondary" onClick={l.end}>
        Batalkan
      </button>
    )
  } else if (status === 'invited') {
    line = `${name} mengajak kamu`
    actions = (
      <>
        <button className="btn" onClick={l.accept}>
          Terima
        </button>
        <button className="btn secondary" onClick={l.decline}>
          Tolak
        </button>
      </>
    )
  } else {
    line = !connected ? 'Tidak bisa terhubung' : partnerHere ? `${name} online` : `${name} sedang offline`
    actions = (
      <button className="btn" onClick={l.invite} disabled={!connected || !partnerHere}>
        Ajak
      </button>
    )
  }

  return (
    <section className={`listen-card${status === 'active' ? ' live' : ''}`}>
      <div className="label accent">{line}</div>
      <div className="listen-card-title">
        <AccentTitle text={title} />
      </div>
      <div className="listen-card-actions">{actions}</div>
    </section>
  )
}
```

- [ ] **Step 7: Rewrite `src/renderer/src/screens/TogetherView.tsx`**

```tsx
import { CoverGrid } from '../components/CoverGrid'
import { ListenCard } from '../components/ListenCard'
import { PlaylistCover } from '../components/PlaylistCover'
import { useLibrary } from '../library/LibraryProvider'
import { useListen } from '../sync/ListenTogetherProvider'
import type { Nav } from '../views'

export function TogetherView({ nav }: { nav: Nav }): React.JSX.Element {
  const listen = useListen()
  const lib = useLibrary()
  return (
    <>
      <h1 className="page-title">
        <em>Berdua</em>
      </h1>
      {listen.available ? <ListenCard /> : <p className="muted">Masuk di Profil untuk dengarkan bareng dan melihat playlist pasangan.</p>}
      {lib.partner.length > 0 && (
        <section className="sec" aria-label="Playlist pasangan">
          <h2 className="section-title">Playlist pasangan</h2>
          <CoverGrid
            items={lib.partner.map((p) => ({
              key: p.id,
              art: <PlaylistCover covers={p.coverUrls} />,
              title: p.name,
              meta: p.ownerName,
              onOpen: () => nav({ name: 'partner', id: p.id })
            }))}
          />
        </section>
      )}
      {listen.available && lib.partner.length === 0 && <p className="muted">Pasangan belum membagikan playlist.</p>}
    </>
  )
}
```

- [ ] **Step 8: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed. `grep -rln "MediaCard\|Shelf\|BentoRow\|TrackRows" src/renderer/src --include='*.tsx' | grep -v "components/\(MediaCard\|Shelf\|Bento\).tsx"` prints nothing.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/screens/ArtistView.tsx src/renderer/src/screens/GenreView.tsx src/renderer/src/screens/ImportView.tsx src/renderer/src/screens/TogetherView.tsx src/renderer/src/components/ListenCard.tsx src/renderer/src/styles/lists.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(ui): editorial Artis, Genre, Impor and Berdua screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Profil

The theme choice data (Ikuti sistem / Siang / Malam) already exists from Task 2; this task gives Profil the editorial layout. Account and Notch sections keep their content.

**Files:**
- Rewrite: `src/renderer/src/screens/Profile.tsx`
- Modify: `src/renderer/src/styles/profile.css`
- Prune: `src/renderer/src/styles/legacy.css`

- [ ] **Step 1: Prune the old profile rules**

Run: `node scripts/prune-legacy-css.mjs '^\.(profile-[a-z-]+|avatar-lg|grid|card)\b'`
Expected: `prune-legacy-css: removed 13 rule(s)`.

- [ ] **Step 2: Append to `src/renderer/src/styles/profile.css`**

```css

.pf-head { display: flex; align-items: center; gap: 24px; padding: 36px 0 26px; }
.pf-avatar { display: grid; place-items: center; flex: none; width: 96px; height: 96px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-family: var(--serif); font-size: 44px; font-style: italic; }
.pf-who { flex: 1; min-width: 0; }
.pf-name { width: 100%; margin: 4px 0 6px; padding: 0; border: 0; background: none; outline: 0; color: var(--ink); font-family: var(--serif); font-size: 44px; line-height: 1; }
.pf-name:focus-visible { outline: 0; }
.pf-name:focus { border-bottom: 1px solid var(--accent); }
.pf-stats { display: flex; flex-wrap: wrap; gap: 6px 22px; font-size: 12px; color: var(--ink-soft); }
.pf-stats strong { color: var(--ink); }
.pf-sec { max-width: 640px; padding-bottom: 22px; }
.pf-sec p { color: var(--ink-soft); }
.pf-sec p strong { color: var(--ink); }
/* Ikuti sistem / Siang / Malam */
.pf-themes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--ink); }
.pf-theme { flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px 12px 0; border-bottom: 1px solid var(--line); text-align: left; }
.pf-theme strong { font-family: var(--serif); font-size: 18px; font-weight: 400; }
.pf-theme.active strong, .pf-theme:hover strong { color: var(--accent); }
.pf-theme.active strong { font-style: italic; }
.pf-theme .small { color: var(--ink-soft); }
.pf-check { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.pf-check input { margin-top: 3px; accent-color: var(--accent); }
.pf-row { display: flex; flex-wrap: wrap; gap: 8px; }
.pf-form { display: flex; flex-direction: column; gap: 8px; max-width: 320px; }
.pf-code { user-select: text; }
```

- [ ] **Step 3: Rewrite `src/renderer/src/screens/Profile.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyError } from '../../../shared/errors'
import type { MyProfile, SyncStatus } from '../../../shared/types'
import { useLibrary } from '../library/LibraryProvider'
import { useNotchEnabled } from '../notch/useNotchEnabled'
import type { ThemeMode } from '../theme/mode'
import { useUpdate } from '../update/useUpdate'

const THEMES: { id: ThemeMode; label: string; hint: string }[] = [
  { id: 'system', label: 'Ikuti sistem', hint: 'Siang atau malam mengikuti komputer' },
  { id: 'day', label: 'Siang', hint: 'Kertas terang' },
  { id: 'night', label: 'Malam', hint: 'Tinta gelap' }
]

const PROFILE_REFRESH_MS = 60_000

interface Props {
  name: string
  onName: (n: string) => void
  initial: string
  theme: ThemeMode
  onTheme: (t: ThemeMode) => void
}

export function Profile({ name, onName, initial, theme, onTheme }: Props): React.JSX.Element {
  const lib = useLibrary()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notch, setNotch] = useNotchEnabled()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [profile, setProfile] = useState<MyProfile | null>(null)

  // The status is cheap and local; the profile is a server call, so it is fetched less often.
  const profileAt = useRef(0)
  const wasSignedIn = useRef(false)
  const load = useCallback(async (forceProfile = false) => {
    const s = await window.phinas.syncStatus()
    setStatus(s)
    const justSignedIn = s.signedIn && !wasSignedIn.current
    wasSignedIn.current = s.signedIn
    if (!s.signedIn) {
      setProfile(null)
      return
    }
    if (!forceProfile && !justSignedIn && Date.now() - profileAt.current < PROFILE_REFRESH_MS) return
    profileAt.current = Date.now()
    setProfile(await window.phinas.myProfile().catch(() => null))
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'up') {
        await window.phinas.syncSignUp({ email, password, displayName, inviteCode, acceptedTerms: accepted })
      } else {
        await window.phinas.syncSignIn(email, password)
      }
      setPassword('')
      setInviteCode('')
      await load(true)
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const deleteAccount = async (): Promise<void> => {
    const ok = window.confirm(
      'Hapus akun Phinas? Playlist dan lagu yang disukai di server ikut terhapus, dan teman-temanmu tidak bisa melihatnya lagi. Data di komputer ini tetap ada.'
    )
    if (!ok) return
    try {
      await window.phinas.deleteAccount()
      await load(true)
      await lib.refreshPartner()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <>
      <header className="pf-head">
        <div className="pf-avatar">{initial}</div>
        <div className="pf-who">
          <span className="label accent">Profil</span>
          <input className="pf-name" value={name} maxLength={30} onChange={(e) => onName(e.target.value)} aria-label="Nama tampilan" />
          <div className="pf-stats">
            <span>
              <strong>{lib.playlists.length}</strong> playlist
            </span>
            <span>
              <strong>{lib.likes.length}</strong> lagu disukai
            </span>
            {status?.signedIn && <span>{status.email}</span>}
          </div>
        </div>
      </header>

      <section className="sec pf-sec">
        <h2 className="section-title">Tema</h2>
        <div className="pf-themes" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              className={`pf-theme${theme === t.id ? ' active' : ''}`}
              onClick={() => onTheme(t.id)}
            >
              <strong>{t.label}</strong>
              <span className="small">{t.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sec pf-sec">
        <h2 className="section-title">Notch</h2>
        <label className="pf-check">
          <input type="checkbox" checked={notch ?? true} disabled={notch === null} onChange={(e) => setNotch(e.target.checked)} />
          <span>Tampilkan notch</span>
        </label>
        <p>Pill kecil di tengah atas layar saat ada lagu. Arahkan kursor untuk membuka kontrolnya.</p>
      </section>

      <UpdateSection />

      <section className="sec pf-sec">
        <h2 className="section-title">Akun</h2>
        {status && !status.configured && <div className="notice">Supabase belum dikonfigurasi. Isi file .env lalu jalankan ulang app.</div>}
        {status?.configured && status.signedIn && (
          <>
            {profile?.disabled && <div className="notice">{friendlyError(new Error('phinas:account_disabled'))}</div>}
            <p>
              Masuk sebagai <strong>{status.email}</strong>.{' '}
              {status.pending === 0 ? 'Semua perubahan sudah tersinkron.' : `${status.pending} perubahan belum tersinkron.`}
            </p>
            {profile && (
              <p>
                Kode temanmu: <strong className="pf-code">{profile.friendCode}</strong>
              </p>
            )}
            {status.lastError && <div className="notice">Sync gagal: {status.lastError}. Akan dicoba lagi otomatis.</div>}
            {error && <div className="notice">{error}</div>}
            <div className="pf-row">
              <button
                className="btn secondary"
                onClick={async () => {
                  await window.phinas.syncSignOut()
                  await load(true)
                  await lib.refreshPartner()
                }}
              >
                Keluar
              </button>
              <button className="btn secondary" onClick={() => void deleteAccount()}>
                Hapus akun
              </button>
            </div>
          </>
        )}
        {status?.configured && !status.signedIn && (
          <form className="pf-form" onSubmit={submit}>
            {mode === 'up' && (
              <input className="field" placeholder="Nama" value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} required />
            )}
            <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className="field"
              type="password"
              placeholder="Password"
              value={password}
              minLength={mode === 'up' ? 6 : undefined}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'up' && (
              <>
                <input
                  className="field"
                  placeholder="Kode undangan"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  required
                />
                <label className="pf-check">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
                  <span>
                    Saya setuju dengan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('terms')
                      }}
                    >
                      Syarat &amp; Ketentuan
                    </a>{' '}
                    dan{' '}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        void window.phinas.openLegal('privacy')
                      }}
                    >
                      Kebijakan Privasi
                    </a>
                    .
                  </span>
                </label>
              </>
            )}
            {error && <div className="notice">{error}</div>}
            <button className="btn" type="submit">
              {mode === 'up' ? 'Daftar' : 'Masuk'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setMode(mode === 'up' ? 'in' : 'up')
                setError(null)
              }}
            >
              {mode === 'up' ? 'Sudah punya akun? Masuk' : 'Punya kode undangan? Daftar'}
            </button>
          </form>
        )}
      </section>
    </>
  )
}

/** Version, and a manual "check for updates". */
function UpdateSection(): React.JSX.Element {
  const u = useUpdate()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const check = async (): Promise<void> => {
    setChecking(true)
    try {
      await window.phinas.checkForUpdate()
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }
  let line = u ? `Phinas ${u.current}` : 'Phinas'
  if (u?.state === 'available' || u?.state === 'ready') line += ` · versi ${u.latest} tersedia`
  else if (u?.state === 'downloading') line += ` · mengunduh ${u.latest} (${u.progress ?? 0}%)`
  else if (checked) line += ' · sudah versi terbaru'
  return (
    <section className="sec pf-sec">
      <h2 className="section-title">Pembaruan</h2>
      <p>{line}</p>
      <div className="pf-row">
        <button className="btn secondary" onClick={() => void check()} disabled={checking || u?.state === 'downloading'}>
          {checking ? 'Memeriksa...' : 'Cek pembaruan'}
        </button>
        {(u?.state === 'available' || u?.state === 'ready') && (
          <button className="btn" onClick={() => void window.phinas.installUpdate()}>
            {u.state === 'ready' ? 'Mulai ulang & perbarui' : 'Unduh versi baru'}
          </button>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/Profile.tsx src/renderer/src/styles/profile.css src/renderer/src/styles/legacy.css
git commit -m "$(cat <<'EOF'
feat(profile): editorial Profil with Ikuti sistem / Siang / Malam

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Notch serif and accent

The notch keeps its layout, motion and dark pill (it must stay black to merge with a camera notch). It takes the Malam accent sent by the app (Task 2) and sets the title and the sung line in Newsreader.

**Files:**
- Modify: `src/renderer/src/notch/main.tsx`
- Modify: `src/renderer/src/notch/Notch.tsx`
- Modify: `src/renderer/src/notch/notch.css`

- [ ] **Step 1: Load the serif (`src/renderer/src/notch/main.tsx`)**

Replace:

```tsx
import '@fontsource/montserrat/700.css'
```

with:

```tsx
import '@fontsource/montserrat/700.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
```

- [ ] **Step 2: Drop the second accent (`src/renderer/src/notch/Notch.tsx`)**

Replace:

```tsx
    '--accent': state.accent,
    '--accent-text': state.accent,
    '--on-accent': state.onAccent,
```

with:

```tsx
    // Already made for a dark surface by the app (the Malam accent), so it works as text too.
    '--accent': state.accent,
    '--on-accent': state.onAccent,
```

- [ ] **Step 3: Restyle `src/renderer/src/notch/notch.css`**

Add a serif variable. Replace:

```css
:root {
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
```

with:

```css
:root {
  --serif: 'Newsreader', Georgia, serif;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
```

Delete the light tone. Remove these lines entirely:

```css
.pill.light {
  --surface: rgba(255, 255, 255, 0.96);
  --text: #111;
  --muted: rgba(0, 0, 0, 0.58);
  --line: rgba(0, 0, 0, 0.08);
  --track: rgba(0, 0, 0, 0.14);
}
```

Delete the blurred cover. Replace:

```css
/* Same look as the app's Dynamic theme: the cover, blurred, tinted by its colour. */
.ambient {
  position: absolute; inset: -30%;
  background-size: cover; background-position: center;
  filter: blur(40px) saturate(1.6) brightness(0.55);
  opacity: 0.6;
  animation: fade-in 0.8s ease both;
}
.tint { position: absolute; inset: 0; background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 26%, transparent), transparent 60%); opacity: 0.9; pointer-events: none; }
.pill.light .tint { background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%); }
@keyframes fade-in { from { opacity: 0; } to { opacity: 0.6; } }
```

with:

```css
/* A faint wash of the song's colour, like the app's pages. */
.tint { position: absolute; inset: 0; background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%); opacity: 0.9; pointer-events: none; }
```

Serif title. Replace:

```css
.title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

with:

```css
.title { font-family: var(--serif); font-size: 17px; font-weight: 400; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

Serif italic sung line. Replace:

```css
.lyrics .now { font-size: 14px; font-weight: 700; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

with:

```css
.lyrics .now { font-family: var(--serif); font-size: 16px; font-style: italic; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

Single-colour progress. Replace:

```css
.fill { position: relative; height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent-text)); transition: width 0.25s linear; }
```

with:

```css
.fill { position: relative; height: 100%; border-radius: 4px; background: var(--accent); transition: width 0.25s linear; }
```

Play button text colour. Replace:

```css
.ico.main { width: 42px; height: 42px; border-radius: 50%; background: var(--accent); color: #fff; opacity: 1; box-shadow: 0 6px 18px -4px var(--accent); }
.ico.like.on { color: var(--accent-text); opacity: 1; }

.ico.on { color: var(--accent-text); opacity: 1; }
```

with:

```css
.ico.main { width: 42px; height: 42px; border-radius: 50%; background: var(--accent); color: var(--on-accent); opacity: 1; box-shadow: 0 6px 18px -4px var(--accent); }
.ico.like.on { color: var(--accent); opacity: 1; }

.ico.on { color: var(--accent); opacity: 1; }
```

Replace:

```css
.picker-state { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--accent-text); flex-shrink: 0; }
```

with:

```css
.picker-state { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--accent); flex-shrink: 0; }
```

Check: `grep -n "accent-text\|pill.light\|ambient\|fade-in" src/renderer/src/notch/notch.css src/renderer/src/notch/Notch.tsx` prints nothing.

- [ ] **Step 4: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/notch/main.tsx src/renderer/src/notch/Notch.tsx src/renderer/src/notch/notch.css
git commit -m "$(cat <<'EOF'
feat(notch): serif title and lyric, song accent only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Remove what nothing uses

**Files:**
- Delete: `src/renderer/src/components/Bento.tsx`, `src/renderer/src/components/Shelf.tsx`, `src/renderer/src/components/MediaCard.tsx`
- Delete: `src/renderer/src/styles/legacy.css`, `scripts/prune-legacy-css.mjs`
- Modify: `src/renderer/src/theme/tokens.css`
- Modify: `src/renderer/src/main.tsx`
- Move + rewrite: `src/renderer/src/screens/home/genreIcon.ts` → `src/renderer/src/theme/moodColors.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/theme/useCover.ts`

- [ ] **Step 1: Confirm the components are unused, then delete them**

Run: `grep -rn "components/Bento\|components/Shelf\|components/MediaCard\|from './Bento'\|from './Shelf'\|from './MediaCard'" src/renderer/src`
Expected: no output. Then:

```bash
git rm src/renderer/src/components/Bento.tsx src/renderer/src/components/Shelf.tsx src/renderer/src/components/MediaCard.tsx
```

- [ ] **Step 2: Confirm no screen still uses a legacy-only class, then delete legacy.css**

Run:

```bash
grep -rnoE "className=[^>]*\b(sb-[a-z-]+|lib-row[a-z-]*|library-[a-z]+|mcard[a-z-]*|shelf[a-z-]*|bento[a-z-]*|tile[a-z-]*|continue[a-z-]*|cover-card[a-z-]*|cover-row|cover-grid|cover-stack|track-row[a-z-]*|queue-[a-z]+|genre-[a-z]+|artist-grid|artist-photo|collection-[a-z]+|row-[a-z]+|pb-[a-z]+|playerbar|np-[a-z]+|nowplaying[a-z-]*|round-btn|recent-[a-z]+|liked-tile[a-z-]*|profile-[a-z]+|avatar-lg|chips?)\b" src/renderer/src --include='*.tsx'
```

Expected: no output. Then:

```bash
git rm src/renderer/src/styles/legacy.css scripts/prune-legacy-css.mjs
```

- [ ] **Step 3: Drop the legacy import (`src/renderer/src/main.tsx`)**

Replace:

```tsx
import './theme/tokens.css'
// Old rules go first so the new files win wherever both still match.
import './styles/legacy.css'
import './styles/base.css'
```

with:

```tsx
import './theme/tokens.css'
import './styles/base.css'
```

- [ ] **Step 4: Drop the legacy aliases and glass variables (`src/renderer/src/theme/tokens.css`)**

Delete this block at the end of the file:

```css
/* Old names still read by styles/legacy.css while areas are rebuilt. Removed with it (Task 14). */
:root {
  --bg: var(--paper);
  --text: var(--ink);
  --muted: var(--ink-soft);
  --hover: color-mix(in srgb, var(--ink) 6%, transparent);
  --glass: transparent;
  --glass-strong: var(--paper);
  --accent-text: var(--accent);
  --grad-top: var(--wash);
  --radius: 0px;
}
```

Check: `grep -rnE "var\(--(bg|text|muted|hover|glass|glass-strong|accent-text|grad-top|radius)\)" src/renderer/src --include='*.css' | grep -v notch/` prints nothing, and `grep -rn "backdrop-filter\|blur(" src/renderer/src/styles src/renderer/src/theme` prints nothing.

- [ ] **Step 5: Keep only the mood colours**

Run: `git mv src/renderer/src/screens/home/genreIcon.ts src/renderer/src/theme/moodColors.ts`

Replace the whole content of `src/renderer/src/theme/moodColors.ts` with:

```ts
/** A mood's colour: it tints the app (accent and wash) while you listen from that mood. */
export interface MoodColors {
  accent: string
}

/** Each mood's colour: calm, mid-saturation tones (no neon). useTheme makes them readable per mode. */
const MOOD_COLORS: Record<string, MoodColors> = {
  chill: { accent: '#5b8def' },
  commute: { accent: '#3fa7a0' },
  energize: { accent: '#e8932a' },
  energise: { accent: '#e8932a' },
  'feel good': { accent: '#d9a93a' },
  focus: { accent: '#6366f1' },
  gaming: { accent: '#3fae6a' },
  party: { accent: '#b05bd6' },
  romance: { accent: '#e0607e' },
  sad: { accent: '#64748b' },
  sleep: { accent: '#4f5bb3' },
  workout: { accent: '#e4572e' }
}

export const moodColors = (title: string): MoodColors | null => MOOD_COLORS[title.trim().toLowerCase()] ?? null
```

In `src/renderer/src/App.tsx` replace:

```tsx
import { moodColors, type MoodColors } from './screens/home/genreIcon'
```

with:

```tsx
import { moodColors, type MoodColors } from './theme/moodColors'
```

- [ ] **Step 6: Fix the stale comment in `src/renderer/src/theme/useCover.ts`**

Replace:

```ts
 * Used for the ambient background and for reading the Dynamic theme colors.
```

with:

```ts
 * Used to read the cover's colour for the accent and the page wash.
```

- [ ] **Step 7: Full check**

Run: `npm run typecheck && npm test && npm run build`
Expected: all succeed; `ls src/renderer/src/styles` lists exactly `base.css explore.css frame.css home.css lists.css profile.css`.

- [ ] **Step 8: Commit**

```bash
git add -A src/renderer/src/components src/renderer/src/styles src/renderer/src/theme src/renderer/src/screens/home src/renderer/src/main.tsx src/renderer/src/App.tsx scripts/prune-legacy-css.mjs
git status --short   # only the files of this task
git commit -m "$(cat <<'EOF'
refactor(ui): remove bento, shelves, media cards, glass and legacy styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Screenshots for review

`src/main/dev-shot.ts` (with `PHINAS_SHOT`, `PHINAS_SHOT_SCRIPT`, `PHINAS_SHOT_DELAY`, `PHINAS_SHOT_PROFILE` in `src/main/index.ts`) already captures the hidden window after running a script, and `executeJavaScript` waits for a returned promise, so the script can switch the mode (through Profil's theme choice) and the cover (by playing a Lagi ramai row) without new app code. Only its debug probe still reads pre-redesign variables; this task updates it and takes 12 shots: Beranda, Jelajah, a playlist (the full chart opened from Jelajah), Search and Profil in Siang and Malam with Lagi ramai #1 playing, plus Beranda in both modes with Lagi ramai #2 (a second cover). The shot profile is not signed in, so the Berdua line does not appear. Network access is needed (feed, covers).

**Files:**
- Modify: `src/main/dev-shot.ts`

- [ ] **Step 1: Update the probe in `src/main/dev-shot.ts`**

Replace:

```ts
        const probe = await win.webContents.executeJavaScript(
          `JSON.stringify({accent: document.documentElement.style.getPropertyValue('--accent'), gradTop: document.documentElement.style.getPropertyValue('--grad-top'), mode: document.documentElement.dataset.mode, titleColor: (document.querySelector('.row.playing .title')||{}).style ? getComputedStyle(document.querySelector('.row.playing .title')).color : null})`
        )
```

with:

```ts
        const probe = await win.webContents.executeJavaScript(
          `(() => { const r = document.documentElement; return JSON.stringify({ theme: r.dataset.theme, accent: r.style.getPropertyValue('--accent'), onAccent: r.style.getPropertyValue('--on-accent'), wash: r.style.getPropertyValue('--wash') }) })()`
        )
```

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 2: Write the shot script body**

Set `SCRATCH` to your session's scratchpad directory (an absolute path), then create `$SCRATCH/shot-body.js` containing exactly:

```js
;(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const until = async (fn, ms = 30000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const v = fn()
      if (v) return v
      await wait(250)
    }
    throw new Error('timed out waiting for the page')
  }
  const byText = (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text)
  const go = async (label) => {
    ;(await until(() => byText('.nav-item', label))).click()
    await wait(800)
  }
  // Mode: Profil's theme choice (stored in the shot profile).
  document.querySelector('.nav-me').click()
  ;(await until(() => byText('.pf-theme strong', MODE))).closest('button').click()
  // Cover: play a Lagi ramai row on Beranda, then let the cover colour settle (600 ms fade).
  await go('Beranda')
  const rows = await until(() => {
    const r = document.querySelectorAll('section[aria-label="Lagi ramai"] .nl-row')
    return r.length > COVER ? r : null
  })
  rows[COVER].click()
  await wait(3000)
  if (SCREEN === 'jelajah') await go('Jelajah')
  if (SCREEN === 'playlist') {
    await go('Jelajah')
    ;(await until(() => byText('.ex-more', 'Lihat semua'))).click()
    await until(() => document.querySelector('.tl-row'))
  }
  if (SCREEN === 'cari') {
    const input = document.querySelector('.searchpill input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'raim laode')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await until(() => document.querySelector('.tl-row'))
    input.blur()
  }
  if (SCREEN === 'profil') document.querySelector('.nav-me').click()
  await wait(1500)
  return { mode: document.documentElement.dataset.theme, screen: SCREEN, title: document.querySelector('.player-title')?.textContent }
})()
```

- [ ] **Step 3: Take the shots**

Run (from `/Users/mac/Dev/phinas-desktop`, with `SCRATCH` set as above; takes several minutes):

```bash
cd /Users/mac/Dev/phinas-desktop
shot() { # $1 Siang|Malam  $2 Lagi ramai row (0-based)  $3 beranda|jelajah|playlist|cari|profil  $4 file name
  printf "const MODE = '%s', COVER = %s, SCREEN = '%s'\n" "$1" "$2" "$3" > "$SCRATCH/shot.js"
  cat "$SCRATCH/shot-body.js" >> "$SCRATCH/shot.js"
  rm -f "$SCRATCH/$4.png"
  (PHINAS_SHOT="$SCRATCH/$4.png" PHINAS_SHOT_PROFILE="$SCRATCH/profile" PHINAS_SHOT_DELAY=6000 \
    PHINAS_SHOT_SCRIPT="$SCRATCH/shot.js" npx electron-vite dev > "$SCRATCH/$4.log" 2>&1 &)
  for i in $(seq 1 150); do [ -f "$SCRATCH/$4.png" ] && break; sleep 1; done
  sleep 1; pkill -f "electron-vite dev"; sleep 2
  ls -la "$SCRATCH/$4.png"; grep "dev-shot" "$SCRATCH/$4.log"
}
for mode in Siang Malam; do
  for screen in beranda jelajah playlist cari profil; do shot "$mode" 0 "$screen" "$screen-$(echo $mode | tr A-Z a-z)"; done
  shot "$mode" 1 beranda "beranda-$(echo $mode | tr A-Z a-z)-cover2"
done
```

Expected for each shot: the PNG exists, and the log shows `[dev-shot] script result:` with `"mode":"day"` for Siang and `"mode":"night"` for Malam, a `page state` line whose `accent` is a `#rrggbb` value other than the terracotta defaults (`#9c4526` / `#e7a46c`) unless the cover is greyscale, and `[dev-shot] wrote …`. If a log shows `[dev-shot] failed: … timed out`, the feed did not load (check the network) or a selector changed; fix and rerun that one shot.

- [ ] **Step 4: Look at every shot**

Open each PNG in `$SCRATCH` with the Read tool and check:
- Siang: warm paper `#f4efe6`, dark ink text, Newsreader titles; Malam: ink `#1c1714`, light text. No glass, no blurred cover, no card backgrounds.
- The top of the page (and the right panel when open) carries a soft wash of the cover's colour that fades into the paper; `beranda-*-cover2` has a visibly different wash and accent from `beranda-*`.
- Sidebar: italic serif `phinas` below the window buttons, text navigation with the accent dot before the active item (Beranda / Jelajah), PLAYLIST label, avatar at the bottom.
- Bottom player: 56 px, under the content only, accent play button, thin accent progress line.
- Beranda: `{HARI} {BAGIAN HARI} · UNTUKMU` label in accent, 170 px cover with "Lanjutkan" and the italic accent title ending in a period, ▶ Jeda/Putar button, Untukmu and Lagi ramai side by side with `01`–`04`.
- Jelajah: Mood & genre pills, Lagi ramai numbered rows with 36 px covers and durations, Rilis baru as a 4-column grid, Video baru rows.
- Playlist: 130 px cover, label line, 46 px serif title with an italic accent last word, Putar (filled) and Acak (outline), `NO · JUDUL · DURASI` head over an ink rule; the playing row (if in the chart) shows ▶ in accent.
- Search: "Hasil untuk “raim laode”", Lagu list in the same track-list pattern, Playlist grid of square covers.
- Profil: rule-separated sections with serif italic titles; Tema shows Ikuti sistem / Siang / Malam with the active one italic in accent.

Note anything that does not match in the task report; do not change code in this task beyond Step 1.

- [ ] **Step 5: Full check**

Run: `npm run typecheck && npm test`
Expected: both succeed.

- [ ] **Step 6: Commit (the probe only; screenshots stay in the scratchpad)**

```bash
git add src/main/dev-shot.ts
git commit -m "$(cat <<'EOF'
chore(dev): screenshot probe reports the editorial tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Then report the 12 screenshot paths (`$SCRATCH/<screen>-<mode>.png` and the two `-cover2` files) so the user can review them, and ask the user for a live run (`npm run dev`) to check the 600 ms colour fade, switching the OS appearance while on Ikuti sistem, a mood from Jelajah, Listen Together with a signed-in partner (Berdua line and session block), and the notch.
