import type { NotchLayout } from '../../shared/ipc'

/** Physical camera notch width on current MacBooks, in points. */
export const MAC_NOTCH_WIDTH = 200
/** A plain menu bar is 24-25 pt; with a notch it grows to about 32-38 pt. */
const NOTCH_MENU_BAR_MIN = 30
const FLOATING_PILL_HEIGHT = 38
/** Transparent margin around the pill inside the window, so the shadow is not cut off. */
export const PAD = 20
const EXPANDED_SIZE = { w: 440, h: 252 }

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Electron has no notch API. On macOS a menu bar taller than 30 pt (workArea starts lower than
 * the display) means the display has a notch. Windows has no notch: a floating pill is used.
 */
export function detectNotch(platform: string, bounds: Rect, workArea: Rect): NotchLayout {
  const bar = workArea.y - bounds.y
  const hasNotch = platform === 'darwin' && bar > NOTCH_MENU_BAR_MIN
  const barHeight = hasNotch ? bar : FLOATING_PILL_HEIGHT
  const notchWidth = hasNotch ? MAC_NOTCH_WIDTH : 0
  return {
    hasNotch,
    notchWidth,
    barHeight,
    compact: { w: hasNotch ? notchWidth + 190 : 300, h: barHeight },
    expanded: EXPANDED_SIZE,
    pad: PAD
  }
}

/**
 * Window rectangle for the notch, centred on the display's top edge.
 * The window is as big as the pill plus its margin: the pill is animated inside it.
 * Every pill hangs from the top edge, like Apple's Dynamic Island. On Windows the taskbar may sit
 * at the top, so the pill hangs from the taskbar's bottom edge instead.
 */
export function computeBounds(
  platform: string,
  bounds: Rect,
  workArea: Rect,
  layout: NotchLayout,
  expanded: boolean
): Rect {
  const pill = expanded ? layout.expanded : layout.compact
  const width = pill.w + layout.pad * 2
  const height = pill.h + layout.pad
  const baseY = platform === 'win32' ? Math.max(bounds.y, workArea.y) : bounds.y
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: baseY,
    width,
    height
  }
}
