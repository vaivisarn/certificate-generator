import { PDFDocument, type PDFPage } from 'pdf-lib'
import { renderPdfBackground, type Background } from './background'
import {
  throwIfCancelled,
  yieldToUi,
  type ExportJob,
  type ExportResult,
  type OnProgress,
} from './exportJob'
import { batchFileName, numberedFileName } from './fileNames'
import { loadFont } from './fonts'
import { backgroundRect, PAGE_H_PT, PAGE_W_PT, type BackgroundFit } from './geometry'
import { jpegOrientation } from './jpegOrientation'
import { drawImageObject, embedCanvasImage, embedNameImage, rectToPt } from './pdfImage'
import { renderNameBitmap } from './renderName'
import { ZipBuilder } from './zip'

/** Resolution used when a background has to be redrawn instead of embedded as is. */
const FALLBACK_DPI = 300

const CREATOR = `Certificate Generator v${__APP_VERSION__}`

type DrawBackground = (page: PDFPage) => void

/**
 * Embed the background once and return a function that draws that same
 * object on any page, so 500 pages share one copy of the image.
 * Pages crop anything outside them, which is how "fill" crops.
 */
async function prepareBackground(doc: PDFDocument, bg: Background | null, fit: BackgroundFit): Promise<DrawBackground> {
  if (!bg) return () => {}
  const rect = backgroundRect(bg.width, bg.height, fit)
  const placement = rectToPt(rect)

  try {
    if (bg.kind === 'jpg' && jpegOrientation(new Uint8Array(bg.bytes)) <= 1) {
      const image = await doc.embedJpg(bg.bytes)
      return (page) => page.drawImage(image, placement)
    }
    if (bg.kind === 'png') {
      const image = await doc.embedPng(bg.bytes)
      return (page) => page.drawImage(image, placement)
    }
    if (bg.kind === 'pdf' && !bg.pdfRotation && bg.pdfView) {
      const source = await PDFDocument.load(bg.bytes)
      const [left, bottom, right, top] = bg.pdfView
      const [embedded] = await doc.embedPages([source.getPage(0)], [{ left, bottom, right, top }])
      return (page) => page.drawPage(embedded, placement)
    }
  } catch (err) {
    // Unusual files (password protected PDF, rare PNG types) are redrawn below.
    console.warn('Background could not be embedded directly, redrawing it instead.', err)
  }

  let source: CanvasImageSource
  let width: number
  let height: number
  if (bg.kind === 'pdf') {
    const canvas = await renderPdfBackground(bg, FALLBACK_DPI)
    source = canvas
    width = canvas.width
    height = canvas.height
  } else {
    // The preview bitmap is already the right way up and full resolution.
    source = bg.preview
    width = bg.width
    height = bg.height
  }
  const ref = embedCanvasImage(doc, source, width, height)
  return (page) => drawImageObject(page, ref, rect)
}

function addNameToPage(doc: PDFDocument, page: PDFPage, name: string, job: ExportJob): void {
  const bitmap = renderNameBitmap(name, job.layer)
  if (!bitmap) return
  const ref = embedNameImage(doc, bitmap, job.layer.color)
  drawImageObject(page, ref, bitmap.rectMm)
}

function newPage(doc: PDFDocument): PDFPage {
  // Exactly A4 landscape, no margins.
  return doc.addPage([PAGE_W_PT, PAGE_H_PT])
}

function setMetadata(doc: PDFDocument, title: string): void {
  doc.setTitle(title)
  doc.setCreator(CREATOR)
  doc.setProducer(CREATOR)
}

async function prepareFonts(job: ExportJob): Promise<void> {
  await loadFont(job.layer.font, job.layer.bold, job.names.join(''))
}

/** One PDF, one page per name. */
export async function exportCombinedPdf(job: ExportJob, onProgress: OnProgress, signal: AbortSignal): Promise<ExportResult> {
  const total = job.names.length
  onProgress({ label: 'Preparing', done: 0, total })
  await prepareFonts(job)

  const doc = await PDFDocument.create()
  setMetadata(doc, 'Certificates')
  const drawBackground = await prepareBackground(doc, job.background, job.backgroundFit)

  for (let i = 0; i < total; i++) {
    throwIfCancelled(signal)
    const page = newPage(doc)
    drawBackground(page)
    addNameToPage(doc, page, job.names[i], job)
    onProgress({ label: 'Drawing pages', done: i + 1, total })
    await yieldToUi()
  }

  throwIfCancelled(signal)
  onProgress({ label: 'Writing the PDF file', done: total, total })
  await yieldToUi()
  const bytes = await doc.save()
  throwIfCancelled(signal)
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), fileName: batchFileName('', 'pdf') }
}

/** A ZIP with one single page PDF per name, named 001_Name.pdf. */
export async function exportPdfZip(job: ExportJob, onProgress: OnProgress, signal: AbortSignal): Promise<ExportResult> {
  const total = job.names.length
  onProgress({ label: 'Preparing', done: 0, total })
  await prepareFonts(job)

  // Build the background page once, then reopen that small file for each
  // person. Much faster than embedding a large background 500 times.
  const template = await PDFDocument.create()
  const drawBackground = await prepareBackground(template, job.background, job.backgroundFit)
  drawBackground(newPage(template))
  const templateBytes = await template.save()

  const zip = new ZipBuilder()
  try {
    for (let i = 0; i < total; i++) {
      throwIfCancelled(signal)
      const doc = await PDFDocument.load(templateBytes)
      setMetadata(doc, 'Certificate')
      addNameToPage(doc, doc.getPage(0), job.names[i], job)
      zip.add(numberedFileName(i, total, job.names[i], 'pdf'), await doc.save())
      onProgress({ label: 'Creating PDF files', done: i + 1, total })
      await yieldToUi()
    }
    throwIfCancelled(signal)
    onProgress({ label: 'Writing the ZIP file', done: total, total })
    return { blob: await zip.finish(), fileName: batchFileName('_pdf', 'zip') }
  } catch (err) {
    zip.abort()
    throw err
  }
}
