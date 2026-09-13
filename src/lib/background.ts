export type BackgroundKind = 'png' | 'jpg' | 'pdf'

export interface Background {
  kind: BackgroundKind
  fileName: string
  /** Original file bytes, embedded once into exported PDFs. */
  bytes: ArrayBuffer
  /** Source size: pixels for images, points for a PDF page (after rotation). */
  width: number
  height: number
  /**
   * Drawable used for the on screen preview. For images this is the full
   * resolution picture, for a PDF a 150 DPI rendering.
   */
  preview: ImageBitmap | HTMLCanvasElement
  /** Page count of a PDF. Only page 1 is used. */
  pageCount: number
  /** Visible area of the PDF page in points, [x1, y1, x2, y2]. */
  pdfView?: [number, number, number, number]
  /** Rotation of the PDF page in degrees. */
  pdfRotation?: number
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
    preview: bitmap,
    pageCount: 1,
  }
}

/** Open a PDF with pdf.js, run `callback` on its first page, then close it. */
async function withFirstPdfPage<T>(
  bytes: ArrayBuffer,
  callback: (page: import('pdfjs-dist').PDFPageProxy, pageCount: number) => Promise<T>,
): Promise<T> {
  // pdf.js is large, so load it only when someone actually picks a PDF.
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  // pdf.js takes ownership of the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) })
  try {
    const doc = await task.promise
    return await callback(await doc.getPage(1), doc.numPages)
  } finally {
    await task.destroy()
  }
}

async function renderPage(page: import('pdfjs-dist').PDFPageProxy, dpi: number): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: dpi / 72 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport }).promise
  return canvas
}

async function loadPdf(fileName: string, bytes: ArrayBuffer): Promise<Background> {
  try {
    return await withFirstPdfPage(bytes, async (page, pageCount) => {
      const base = page.getViewport({ scale: 1 })
      const [x1, y1, x2, y2] = page.view
      return {
        kind: 'pdf',
        fileName,
        bytes,
        width: base.width,
        height: base.height,
        preview: await renderPage(page, PDF_PREVIEW_DPI),
        pageCount,
        pdfView: [x1, y1, x2, y2],
        pdfRotation: page.rotate,
      }
    })
  } catch {
    throw new BackgroundError(`"${fileName}" could not be opened. It may be damaged or password protected.`)
  }
}

/** Render page 1 of a PDF background at a given resolution, for PNG export. */
export function renderPdfBackground(bg: Background, dpi: number): Promise<HTMLCanvasElement> {
  return withFirstPdfPage(bg.bytes, (page) => renderPage(page, dpi))
}
