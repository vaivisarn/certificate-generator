import { renderPdfBackground } from './background'
import { drawBackground } from './drawPage'
import {
  canvasToBlob,
  throwIfCancelled,
  yieldToUi,
  type ExportJob,
  type ExportResult,
  type OnProgress,
} from './exportJob'
import { batchFileName, numberedFileName } from './fileNames'
import { loadFont } from './fonts'
import { IDEAL_DPI, pageHeightPx, pageWidthPx, pxPerMm } from './geometry'
import { drawName } from './renderName'
import { ZipBuilder } from './zip'

/** 300 DPI gives 3508 x 2480 px, sharp enough to print from an email. */
export const PNG_DPI = IDEAL_DPI

/** A page canvas and a function that draws one name onto it. */
async function preparePage(job: ExportJob): Promise<(name: string) => HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = pageWidthPx(PNG_DPI)
  canvas.height = pageHeightPx(PNG_DPI)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw on a canvas.')

  // A PDF preview is only 150 DPI, so draw the PDF again at full resolution.
  const image = job.background?.kind === 'pdf' ? await renderPdfBackground(job.background, PNG_DPI) : undefined
  await loadFont(job.layer.font, job.layer.bold, job.names.join(''))

  const scale = pxPerMm(PNG_DPI)
  return (name) => {
    drawBackground(ctx, job.background, job.backgroundFit, scale, image ?? job.background?.preview)
    drawName(ctx, name, job.layer, scale)
    return canvas
  }
}

/** One PNG for a single name. */
export async function exportSinglePng(job: ExportJob, index: number): Promise<ExportResult> {
  const render = await preparePage(job)
  const name = job.names[index]
  const blob = await canvasToBlob(render(name))
  return { blob, fileName: numberedFileName(index, job.names.length, name, 'png') }
}

/** A ZIP with one PNG per name, named 001_Name.png. */
export async function exportPngZip(job: ExportJob, onProgress: OnProgress, signal: AbortSignal): Promise<ExportResult> {
  const total = job.names.length
  onProgress({ label: 'Preparing', done: 0, total })
  const render = await preparePage(job)

  const zip = new ZipBuilder()
  try {
    for (let i = 0; i < total; i++) {
      throwIfCancelled(signal)
      const blob = await canvasToBlob(render(job.names[i]))
      zip.add(numberedFileName(i, total, job.names[i], 'png'), new Uint8Array(await blob.arrayBuffer()))
      onProgress({ label: 'Creating PNG files', done: i + 1, total })
      await yieldToUi()
    }
    throwIfCancelled(signal)
    onProgress({ label: 'Writing the ZIP file', done: total, total })
    return { blob: await zip.finish(), fileName: batchFileName('_png', 'zip') }
  } catch (err) {
    zip.abort()
    throw err
  }
}
