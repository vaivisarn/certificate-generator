import type { Background } from './background'
import type { BackgroundFit } from './geometry'
import type { TextLayer } from '../state/certificate'

export interface ExportJob {
  background: Background | null
  backgroundFit: BackgroundFit
  layer: TextLayer
  /** Cleaned, non empty names in export order. */
  names: string[]
}

export interface ExportProgress {
  label: string
  done: number
  total: number
}

export type OnProgress = (progress: ExportProgress) => void

export interface ExportResult {
  blob: Blob
  fileName: string
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')
}

export function isCancelled(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * Let the browser repaint and handle clicks (such as Cancel) between names.
 * Uses scheduler.yield or a message, not setTimeout, because Chrome slows
 * timers to once a second when the tab is in the background.
 */
export function yieldToUi(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    channel.port2.postMessage(null)
  })
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), type, quality)
  })
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before freeing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
