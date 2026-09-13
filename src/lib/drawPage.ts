import type { Background } from './background'
import { backgroundRect, PAGE_H_MM, PAGE_W_MM, type BackgroundFit } from './geometry'

/**
 * Draw the page background onto a canvas.
 * `scale` is canvas pixels per millimetre. The canvas edge crops anything
 * outside the page, which is how "fill" crops the overflow.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background | null,
  fit: BackgroundFit,
  scale: number,
): void {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_W_MM * scale, PAGE_H_MM * scale)
  if (!bg) return

  const rect = backgroundRect(bg.width, bg.height, fit)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bg.preview, rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale)
}
