import { ptToMm } from './geometry'

export type BackgroundKind = 'png' | 'jpg' | 'pdf'

export interface Background {
  kind: BackgroundKind
  fileName: string
  /** Original file bytes, embedded once into exported PDFs. */
  bytes: ArrayBuffer
  /** Source size: pixels for images, points for a PDF page. */
  width: number
  height: number
  /** Pixel size for images. Null for PDF, which is usually vector. */
  pixelWidth: number | null
  /** Drawable used for the on screen preview. */
  preview: ImageBitmap | HTMLCanvasElement
  /** Page count of a PDF. Only page 1 is used. */
  pageCount: number
}

export class BackgroundError extends Error {}

/** Resolution the PDF preview is rendered at. Enough for a sharp screen preview. */
const PDF_PREVIEW_DPI = 150

function sniffKind(bytes: Uint8Array): BackgroundKind | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  // "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf'
  return null
}

export async function loadBackground(file: File): Promise<Background> {
  const bytes = await file.arrayBuffer()
  // Check the real file contents, not the extension.
  const kind = sniffKind(new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength)))
  if (!kind) {
    throw new BackgroundError(`"${file.name}" is not a PNG, JPG or PDF file.`)
  }
  return kind === 'pdf' ? loadPdf(file.name, bytes) : loadImage(file.name, kind, bytes)
}

async function loadImage(fileName: string, kind: BackgroundKind, bytes: ArrayBuffer): Promise<Background> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: kind === 'png' ? 'image/png' : 'image/jpeg' }))
  } catch {
    throw new BackgroundError(`"${fileName}" could not be read. The file may be damaged.`)
  }
  return {
    kind,
    fileName,
    bytes,
    width: bitmap.width,
    height: bitmap.height,
    pixelWidth: bitmap.width,
    preview: bitmap,
    pageCount: 1,
  }
}

async function loadPdf(fileName: string, bytes: ArrayBuffer): Promise<Background> {
  // pdf.js is large, so load it only when someone actually picks a PDF.
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) })
  let doc
  try {
    doc = await task.promise
  } catch {
    await task.destroy()
    throw new BackgroundError(`"${fileName}" could not be opened. It may be damaged or password protected.`)
  }

  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: PDF_PREVIEW_DPI / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise

    return {
      kind: 'pdf',
      fileName,
      bytes,
      width: base.width,
      height: base.height,
      pixelWidth: null,
      preview: canvas,
      pageCount: doc.numPages,
    }
  } finally {
    await task.destroy()
  }
}

/** Size of the PDF page in mm, for display. */
export function pdfPageSizeMm(bg: Background): { w: number; h: number } {
  return { w: ptToMm(bg.width), h: ptToMm(bg.height) }
}
