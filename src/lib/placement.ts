import { PAGE_H_MM, PAGE_W_MM, SAFE_MARGIN_MM } from './geometry'

export interface Anchor {
  xMm: number
  yMm: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export const STEP_SIZES_MM = [0.5, 1, 5] as const
/** Shift plus an arrow key always moves by this much. */
export const LARGE_STEP_MM = 5

/** Positions are kept to 0.1 mm, finer than any printer can place. */
export function roundMm(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Keep the anchor on the page, rounded to 0.1 mm. */
export function clampAnchor(anchor: Anchor): Anchor {
  return {
    xMm: clamp(roundMm(anchor.xMm), 0, PAGE_W_MM),
    yMm: clamp(roundMm(anchor.yMm), 0, PAGE_H_MM),
  }
}

export function nudge(anchor: Anchor, direction: Direction, stepMm: number): Anchor {
  const dx = direction === 'left' ? -stepMm : direction === 'right' ? stepMm : 0
  const dy = direction === 'up' ? -stepMm : direction === 'down' ? stepMm : 0
  return clampAnchor({ xMm: anchor.xMm + dx, yMm: anchor.yMm + dy })
}

export function directionFromKey(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      return null
  }
}

/**
 * Font size after automatic shrink. Text width grows in proportion to font
 * size, so a name that is 20 percent too wide gets a font 20 percent smaller.
 * `naturalWidthMm` is the width at `sizePt`.
 */
export function effectiveSizePt(
  naturalWidthMm: number,
  sizePt: number,
  maxWidthMm: number,
  autoShrink: boolean,
): number {
  if (!autoShrink || naturalWidthMm <= maxWidthMm || naturalWidthMm <= 0 || maxWidthMm <= 0) return sizePt
  return sizePt * (maxWidthMm / naturalWidthMm)
}

export interface BoxMm {
  left: number
  top: number
  right: number
  bottom: number
}

/** Is the box inside the page with `marginMm` to spare on every side? */
export function boxInside(box: BoxMm, marginMm: number): boolean {
  return (
    box.left >= marginMm &&
    box.top >= marginMm &&
    box.right <= PAGE_W_MM - marginMm &&
    box.bottom <= PAGE_H_MM - marginMm
  )
}

export function insideSafeArea(box: BoxMm): boolean {
  return boxInside(box, SAFE_MARGIN_MM)
}

export function insidePage(box: BoxMm): boolean {
  return boxInside(box, 0)
}
