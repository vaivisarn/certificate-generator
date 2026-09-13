import type { TextLayer } from '../state/certificate'
import { canvasFont } from './fonts'
import { pxPerMm, ptToMm, type RectMm } from './geometry'
import { effectiveSizePt, type BoxMm } from './placement'

/** Font size in canvas pixels for a canvas drawn at `scale` px per mm. */
export function fontSizePx(sizePt: number, scale: number): number {
  return ptToMm(sizePt) * scale
}

export interface NameLayout {
  /** Font size actually used, after automatic shrink. */
  sizePt: number
  shrunk: boolean
  /** Ink width at the layer's base size, before any shrink. */
  naturalWidthMm: number
  /** Where the ink of the letters sits on the page, in mm. */
  box: BoxMm
}

let measureCtx: CanvasRenderingContext2D | null = null

/** Measure at a fixed pixel size, then scale. Avoids font size rounding. */
const MEASURE_PX = 100

/**
 * Work out size and position of a name. Load the font with `loadFont` first,
 * or the measurement uses a fallback font.
 */
export function layoutName(text: string, layer: TextLayer): NameLayout {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  const { xMm, yMm } = layer.anchor
  if (!measureCtx || !text) {
    return { sizePt: layer.sizePt, shrunk: false, naturalWidthMm: 0, box: { left: xMm, right: xMm, top: yMm, bottom: yMm } }
  }

  measureCtx.font = canvasFont(layer.font, layer.bold, MEASURE_PX)
  measureCtx.textAlign = 'center'
  measureCtx.textBaseline = 'middle'
  const m = measureCtx.measureText(text)

  const baseMmPerPx = ptToMm(layer.sizePt) / MEASURE_PX
  const naturalWidthMm = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * baseMmPerPx
  const sizePt = effectiveSizePt(naturalWidthMm, layer.sizePt, layer.maxWidthMm, layer.autoShrink)
  const mmPerPx = ptToMm(sizePt) / MEASURE_PX

  return {
    sizePt,
    shrunk: sizePt < layer.sizePt,
    naturalWidthMm,
    box: {
      left: xMm - m.actualBoundingBoxLeft * mmPerPx,
      right: xMm + m.actualBoundingBoxRight * mmPerPx,
      top: yMm - m.actualBoundingBoxAscent * mmPerPx,
      bottom: yMm + m.actualBoundingBoxDescent * mmPerPx,
    },
  }
}

/**
 * Draw a name centred on the layer anchor.
 * Horizontal centre is the middle of the text. Vertical centre is the middle
 * of the font's em box, the same for every name, so names with and without
 * Thai tone marks sit at the same height.
 * `scale` is canvas pixels per mm.
 */
export function drawName(
  ctx: CanvasRenderingContext2D,
  text: string,
  layer: TextLayer,
  scale: number,
  layout: NameLayout = layoutName(text, layer),
): void {
  ctx.font = canvasFont(layer.font, layer.bold, fontSizePx(layout.sizePt, scale))
  ctx.fillStyle = layer.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, layer.anchor.xMm * scale, layer.anchor.yMm * scale)
}

/** Resolution of the name image placed in PDFs. Sharp even under a loupe. */
export const NAME_DPI = 600

export interface NameBitmap {
  width: number
  height: number
  /** Coverage of each pixel, 0 is empty and 255 is full ink. Row by row from the top. */
  alpha: Uint8Array
  /** Where the bitmap goes on the page, in mm. */
  rectMm: RectMm
}

let bitmapCanvas: HTMLCanvasElement | null = null

function edgesAreEmpty(data: Uint8ClampedArray, width: number, height: number): boolean {
  const at = (x: number, y: number) => data[(y * width + x) * 4 + 3]
  for (let x = 0; x < width; x++) if (at(x, 0) || at(x, height - 1)) return false
  for (let y = 0; y < height; y++) if (at(0, y) || at(width - 1, y)) return false
  return true
}

/**
 * Draw a name at high resolution and crop it to the letters.
 * The browser shapes the text, so Thai vowels and tone marks sit exactly as in
 * the preview. Only the ink coverage is kept: the colour is applied in the PDF.
 * Load the font with `loadFont` first.
 */
export function renderNameBitmap(text: string, layer: TextLayer, dpi = NAME_DPI): NameBitmap | null {
  if (!text) return null
  bitmapCanvas ??= document.createElement('canvas')
  const ctx = bitmapCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser cannot draw on a canvas.')

  const scale = pxPerMm(dpi)
  const layout = layoutName(text, layer)
  const inkLayer: TextLayer = { ...layer, color: '#000000' }

  // Start with a 1 mm margin around the measured letters. If any ink touches
  // the edge, the measurement was short, so try again with more room.
  for (let padMm = 1, attempt = 0; ; padMm *= 4, attempt++) {
    const left = Math.floor((layout.box.left - padMm) * scale)
    const top = Math.floor((layout.box.top - padMm) * scale)
    const width = Math.ceil((layout.box.right + padMm) * scale) - left
    const height = Math.ceil((layout.box.bottom + padMm) * scale) - top

    bitmapCanvas.width = width
    bitmapCanvas.height = height
    ctx.setTransform(1, 0, 0, 1, -left, -top)
    drawName(ctx, text, inkLayer, scale, layout)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const data = ctx.getImageData(0, 0, width, height).data

    if (attempt === 2 || edgesAreEmpty(data, width, height)) {
      const alpha = new Uint8Array(width * height)
      for (let i = 0, j = 3; i < alpha.length; i++, j += 4) alpha[i] = data[j]
      return {
        width,
        height,
        alpha,
        rectMm: { x: left / scale, y: top / scale, w: width / scale, h: height / scale },
      }
    }
  }
}
