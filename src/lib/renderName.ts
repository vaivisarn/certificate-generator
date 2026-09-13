import type { TextLayer } from '../state/certificate'
import { canvasFont } from './fonts'
import { ptToMm } from './geometry'

/** Font size in canvas pixels for a canvas drawn at `scale` px per mm. */
export function fontSizePx(sizePt: number, scale: number): number {
  return ptToMm(sizePt) * scale
}

/**
 * Draw a name centred on the layer anchor.
 * Horizontal centre is the middle of the text width. Vertical centre is the
 * middle of the font's em box, the same for every name, so names with and
 * without Thai tone marks sit at the same height.
 * `scale` is canvas pixels per mm.
 */
export function drawName(ctx: CanvasRenderingContext2D, text: string, layer: TextLayer, scale: number): void {
  ctx.font = canvasFont(layer.font, layer.bold, fontSizePx(layer.sizePt, scale))
  ctx.fillStyle = layer.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, layer.anchor.xMm * scale, layer.anchor.yMm * scale)
}

let measureCtx: CanvasRenderingContext2D | null = null

/** Width of the name in mm at the layer's font and size. */
export function measureNameMm(text: string, layer: TextLayer): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  // Measure at a fixed size and scale, which avoids font size rounding.
  const refPx = 100
  measureCtx.font = canvasFont(layer.font, layer.bold, refPx)
  const widthPx = measureCtx.measureText(text).width
  return (widthPx / refPx) * ptToMm(layer.sizePt)
}
