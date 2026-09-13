import type { TextLayer } from '../state/certificate'
import { canvasFont } from './fonts'
import { ptToMm } from './geometry'
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
