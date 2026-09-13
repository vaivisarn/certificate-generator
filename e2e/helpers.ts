import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, type BrowserContext, type Page } from '@playwright/test'
import { decodePDFRawStream, PDFArray, PDFRawStream, type PDFDocument, type PDFPage } from 'pdf-lib'

export const SAMPLES = path.resolve('samples')

/** Made up people. Never put real participant names in this public repo. */
const THAI_FIRST = ['ปิ่นทิพย์', 'น้ำฝน', 'ผู้ใหญ่', 'กิ่งแก้ว', 'ธีร์ธวัช', 'สมชาย', 'วรรณา', 'ณัฐพล', 'ศิริพร', 'ภูมิใจ']
const THAI_LAST = ['ศรีสุข', 'ใจดี', 'มั่นคง', 'วงศ์ทอง', 'พูนผล', 'แก้วมณี', 'รุ่งเรือง', 'ทองคำ', 'สุขสันต์', 'บุญมี']
const ENGLISH_FIRST = ['Anna', 'Ben', 'Chloe', 'David', 'Emma', 'Felix', 'Grace', 'Henry', 'Isla', 'Jack']
const ENGLISH_LAST = ['Lee', 'Smith', 'Tan', 'Garcia', 'Brown', "O'Connor", 'Nguyen', 'Walker', 'Kim', 'Hughes']

export const SHORT_NAME = 'Al Li'
export const LONG_NAME = 'Maximilian Alexander Wolfeschlegelsteinhausen Bergerdorff'
export const LONG_THAI_NAME = 'นางสาวกิ่งแก้วประกายมณี ศรีสุขสวัสดิ์วงศ์ทองพูนผลรุ่งเรือง'

/** 500 mixed Thai and English names. Rows 1 to 3 are the short and long test names. */
export function makeNames(count = 500): string[] {
  const names = [SHORT_NAME, LONG_NAME, LONG_THAI_NAME]
  for (let i = 0; names.length < count; i++) {
    names.push(
      i % 2 === 0
        ? `${THAI_FIRST[i % 10]} ${THAI_LAST[Math.floor(i / 10) % 10]}`
        : `${ENGLISH_FIRST[i % 10]} ${ENGLISH_LAST[Math.floor(i / 10) % 10]}`,
    )
  }
  return names
}

export async function loadBackground(page: Page, fileName: string): Promise<void> {
  await page.getByTestId('background-input').setInputFiles(path.join(SAMPLES, fileName))
  await expect(page.getByText(fileName)).toBeVisible()
}

/** Type names into the paste box and confirm, as a user would after pasting. */
export async function enterNames(page: Page, names: string[]): Promise<void> {
  await page.locator('#names-paste').fill(names.join('\n'))
  await page.getByRole('button', { name: /Use these names|Replace list/ }).click()
  await expect(page.getByTestId('names-count')).toHaveText(`${names.length} names`)
}

/** Click an export button and return the downloaded file's bytes and name. */
export async function exportFile(
  page: Page,
  buttonName: RegExp,
  savePath: string,
  timeout = 150_000,
): Promise<{ bytes: Buffer; fileName: string; seconds: number }> {
  const started = Date.now()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout }),
    page.getByRole('button', { name: buttonName }).click(),
  ])
  await download.saveAs(savePath)
  const seconds = (Date.now() - started) / 1000
  return { bytes: await readFile(savePath), fileName: download.suggestedFilename(), seconds }
}

/** Width and height from a PNG header. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const PT_TO_MM = 25.4 / 72

/**
 * Where the name image sits on a page, read from the page's drawing
 * commands. The app names that image object "Img-n".
 */
export function nameImagePlacement(page: PDFPage): { xMm: number; yMm: number; wMm: number; hMm: number } {
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => page.doc.context.lookup(ref)) : [contents]
  const text = streams
    .filter((s): s is PDFRawStream => s instanceof PDFRawStream)
    .map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'))
    .join('\n')
  const matches = [...text.matchAll(/([-\d.]+) 0 0 ([-\d.]+) ([-\d.]+) ([-\d.]+) cm\s+\/Img-\d+ Do/g)]
  const last = matches.at(-1)
  if (!last) throw new Error('No name image found on the page.')
  const [w, h, x, y] = last.slice(1, 5).map(Number)
  const pageHeight = page.getHeight()
  return { xMm: x * PT_TO_MM, yMm: (pageHeight - y - h) * PT_TO_MM, wMm: w * PT_TO_MM, hMm: h * PT_TO_MM }
}

export function pageSizes(doc: PDFDocument): Set<string> {
  return new Set(doc.getPages().map((p) => `${p.getWidth().toFixed(2)} x ${p.getHeight().toFixed(2)}`))
}

/**
 * Render PDF pages to PNG with pdf.js in the browser, the same library the
 * app uses. The files are served from a made up address inside the test.
 */
export async function renderPdfPages(
  context: BrowserContext,
  pdfPath: string,
  pageNumbers: number[],
  scale = 1.5,
): Promise<Buffer[]> {
  const pdfjsBuild = path.resolve('node_modules/pdfjs-dist/build')
  const page = await context.newPage()
  await page.route('http://pdf-check.test/**', async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/') {
      await route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><script type="module">
          import * as pdfjs from '/pdf.mjs'
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
          window.pdfjsLib = pdfjs
        </script>`,
      })
    } else if (pathname === '/file.pdf') {
      await route.fulfill({ contentType: 'application/pdf', body: await readFile(pdfPath) })
    } else {
      await route.fulfill({ contentType: 'text/javascript', body: await readFile(path.join(pdfjsBuild, path.basename(pathname))) })
    }
  })
  await page.goto('http://pdf-check.test/')
  await page.waitForFunction(() => 'pdfjsLib' in window)

  const dataUrls = await page.evaluate(
    async ({ pageNumbers, scale }) => {
      const pdfjs = (window as never as { pdfjsLib: typeof import('pdfjs-dist') }).pdfjsLib
      const doc = await pdfjs.getDocument({ url: '/file.pdf' }).promise
      const urls: string[] = []
      for (const n of pageNumbers) {
        const pdfPage = await doc.getPage(n)
        const viewport = pdfPage.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await pdfPage.render({ canvas, viewport }).promise
        urls.push(canvas.toDataURL('image/png'))
      }
      return urls
    },
    { pageNumbers, scale },
  )
  await page.close()
  return dataUrls.map((url) => Buffer.from(url.split(',')[1], 'base64'))
}
