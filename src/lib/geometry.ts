// All layout geometry is in millimetres. Pixels only exist at draw time.

export const PAGE_W_MM = 297
export const PAGE_H_MM = 210
export const PAGE_RATIO = PAGE_W_MM / PAGE_H_MM // 1.414

/** A4 landscape in PDF points (1 pt = 1/72 inch). */
export const PAGE_W_PT = 841.89
export const PAGE_H_PT = 595.28

export const MM_PER_INCH = 25.4
export const PT_PER_INCH = 72

/** Most office printers cannot print closer to the edge than this. */
export const SAFE_MARGIN_MM = 10

export const DEFAULT_ANCHOR = { xMm: PAGE_W_MM / 2, yMm: PAGE_H_MM / 2 }

/** A background ratio within this fraction of A4 is treated as a match. */
export const RATIO_TOLERANCE = 0.015

/** Below this the print may look soft (1754 px across A4 width). */
export const MIN_DPI = 150
export const IDEAL_DPI = 300

export interface RectMm {
  x: number
  y: number
  w: number
  h: number
}

export type BackgroundFit = 'fit' | 'fill'

/** Pixels per millimetre at a given DPI. */
export function pxPerMm(dpi: number): number {
  return dpi / MM_PER_INCH
}

export function mmToPx(mm: number, scale: number): number {
  return mm * scale
}

export function pxToMm(px: number, scale: number): number {
  return px / scale
}

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH
}

export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH
}

/** Pixel width of A4 landscape at a given DPI, e.g. 3508 at 300 DPI. */
export function pageWidthPx(dpi: number): number {
  return Math.round(PAGE_W_MM * pxPerMm(dpi))
}

export function pageHeightPx(dpi: number): number {
  return Math.round(PAGE_H_MM * pxPerMm(dpi))
}

export type RatioShape = 'a4' | 'a4-portrait' | '16:9' | '16:10' | '4:3' | 'portrait' | 'other'

export interface RatioCheck {
  ratio: number
  /** Relative difference from A4 landscape, 0.02 means 2 percent off. */
  deviation: number
  matches: boolean
  shape: RatioShape
}

const KNOWN_SHAPES: { shape: RatioShape; ratio: number }[] = [
  { shape: '16:9', ratio: 16 / 9 },
  { shape: '16:10', ratio: 16 / 10 },
  { shape: '4:3', ratio: 4 / 3 },
]

export function checkRatio(width: number, height: number): RatioCheck {
  const ratio = width / height
  const deviation = Math.abs(ratio - PAGE_RATIO) / PAGE_RATIO
  const matches = deviation <= RATIO_TOLERANCE

  let shape: RatioShape = 'other'
  if (matches) {
    shape = 'a4'
  } else if (Math.abs(1 / ratio - PAGE_RATIO) / PAGE_RATIO <= RATIO_TOLERANCE) {
    shape = 'a4-portrait'
  } else if (ratio < 1) {
    shape = 'portrait'
  } else {
    const known = KNOWN_SHAPES.find((k) => Math.abs(ratio - k.ratio) / k.ratio <= 0.02)
    if (known) shape = known.shape
  }

  return { ratio, deviation, matches, shape }
}

/**
 * Where the background sits on the page, in mm.
 * A matching ratio fills the page exactly. Otherwise "fit" shows the whole
 * image with blank margins and "fill" covers the page and lets the page edge
 * crop the overflow.
 */
export function backgroundRect(width: number, height: number, fit: BackgroundFit): RectMm {
  const { ratio, matches } = checkRatio(width, height)
  if (matches) return { x: 0, y: 0, w: PAGE_W_MM, h: PAGE_H_MM }

  const wider = ratio > PAGE_RATIO
  const matchWidth = fit === 'fit' ? wider : !wider
  const w = matchWidth ? PAGE_W_MM : PAGE_H_MM * ratio
  const h = matchWidth ? PAGE_W_MM / ratio : PAGE_H_MM
  return { x: (PAGE_W_MM - w) / 2, y: (PAGE_H_MM - h) / 2, w, h }
}

/** Print resolution of an image once placed on the page. */
export function effectiveDpi(widthPx: number, rect: RectMm): number {
  return (widthPx / rect.w) * MM_PER_INCH
}
