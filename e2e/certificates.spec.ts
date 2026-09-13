import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { unzipSync } from 'fflate'
import { PDFDocument } from 'pdf-lib'
import {
  enterNames,
  exportFile,
  loadBackground,
  LONG_NAME,
  LONG_THAI_NAME,
  makeNames,
  nameImagePlacement,
  pageSizes,
  pngSize,
  renderPdfPages,
  SHORT_NAME,
} from './helpers'

const A4_LANDSCAPE = '841.89 x 595.28'

test.beforeEach(async ({ page }) => {
  // Start every test from a clean layout.
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('500 mixed Thai and English names export to one A4 landscape PDF', async ({ page, context }, testInfo) => {
  const names = makeNames(500)
  await loadBackground(page, 'sample-certificate.png')
  await enterNames(page, names)

  const pdfPath = testInfo.outputPath('certificates.pdf')
  const { bytes, fileName, seconds } = await exportFile(page, /Combined PDF/, pdfPath)
  console.log(`Combined PDF: 500 pages in ${seconds.toFixed(1)} s, ${(bytes.length / 1024 / 1024).toFixed(1)} MB`)

  expect(fileName).toMatch(/^certificates_\d{4}-\d{2}-\d{2}\.pdf$/)
  expect(seconds).toBeLessThan(90)

  // The file opens, has 500 pages, and every page is exactly A4 landscape.
  const doc = await PDFDocument.load(bytes)
  expect(doc.getPageCount()).toBe(500)
  expect([...pageSizes(doc)]).toEqual([A4_LANDSCAPE])

  // Short and long names are centred on the anchor (148.5 mm), and the long
  // names shrink to the 240 mm maximum width. The name image has a 1 mm margin.
  const short = nameImagePlacement(doc.getPage(0))
  const long = nameImagePlacement(doc.getPage(1))
  const longThai = nameImagePlacement(doc.getPage(2))
  for (const placement of [short, long, longThai]) {
    expect(Math.abs(placement.xMm + placement.wMm / 2 - 148.5)).toBeLessThan(1.5)
  }
  expect(short.wMm).toBeLessThan(60)
  expect(long.wMm).toBeGreaterThan(230)
  expect(long.wMm).toBeLessThanOrEqual(240 + 2 + 0.5)
  expect(longThai.wMm).toBeLessThanOrEqual(240 + 2 + 0.5)

  // Render a few pages so a person can check the Thai marks by eye.
  const pageNumbers = [1, 2, 3, 4, 6, 500]
  const images = await renderPdfPages(context, pdfPath, pageNumbers)
  const outDir = testInfo.outputPath('pages')
  await mkdir(outDir, { recursive: true })
  await Promise.all(images.map((png, i) => writeFile(path.join(outDir, `page-${pageNumbers[i]}.png`), png)))
  for (const png of images) expect(pngSize(png)).toEqual({ width: 1263, height: 893 })
})

test('PDF per person ZIP has one A4 page per name with numbered file names', async ({ page }, testInfo) => {
  const names = makeNames(20)
  await loadBackground(page, 'sample-certificate.pdf')
  await enterNames(page, names)

  const { bytes, fileName } = await exportFile(page, /PDF per person/, testInfo.outputPath('pdf.zip'))
  expect(fileName).toMatch(/^certificates_pdf_\d{4}-\d{2}-\d{2}\.zip$/)

  const files = unzipSync(new Uint8Array(bytes))
  const entries = Object.keys(files)
  expect(entries).toHaveLength(20)
  expect(entries[0]).toBe(`001_${SHORT_NAME}.pdf`)
  expect(entries[2]).toBe(`003_${LONG_THAI_NAME}.pdf`)
  expect(entries[19]).toMatch(/^020_.+\.pdf$/)

  for (const entry of [entries[0], entries[1], entries[19]]) {
    const doc = await PDFDocument.load(files[entry])
    expect(doc.getPageCount()).toBe(1)
    expect([...pageSizes(doc)]).toEqual([A4_LANDSCAPE])
  }
})

test('PNG export gives 300 DPI images, as a ZIP and as a single file', async ({ page }, testInfo) => {
  const names = makeNames(5)
  await loadBackground(page, 'sample-certificate.png')
  await enterNames(page, names)

  const zip = await exportFile(page, /PNG per person/, testInfo.outputPath('png.zip'))
  const files = unzipSync(new Uint8Array(zip.bytes))
  expect(Object.keys(files)).toHaveLength(5)
  for (const png of Object.values(files)) expect(pngSize(png)).toEqual({ width: 3508, height: 2480 })

  // Single PNG of the name shown in the preview (row 2 after Next).
  await page.getByRole('button', { name: 'Next name' }).click()
  const single = await exportFile(page, /PNG of the name/, testInfo.outputPath('single.png'))
  expect(single.fileName).toBe(`002_${LONG_NAME}.png`)
  expect(pngSize(single.bytes)).toEqual({ width: 3508, height: 2480 })
})

test('pasting Excel cells with Thai names, tabs and quotes', async ({ page }) => {
  const pasted = 'ปิ่นทิพย์ ศรีสุข\tHR\r\n\r\n"น้ำฝน\nใจดี"\tIT\r\n"Somchai ""Tom"" Jaidee"\tSales\r\nผู้ใหญ่ มั่นคง\tHR\r\nผู้ใหญ่ มั่นคง\tHR\r\n'
  await page.locator('#names-paste').focus()
  await page.evaluate((text) => {
    const data = new DataTransfer()
    data.setData('text/plain', text)
    document.querySelector('#names-paste')!.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  }, pasted)

  await expect(page.getByTestId('names-count')).toHaveText('5 names')
  const rows = page.locator('.names-table tbody input')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0)).toHaveValue('ปิ่นทิพย์ ศรีสุข')
  await expect(rows.nth(1)).toHaveValue('น้ำฝน ใจดี')
  await expect(rows.nth(2)).toHaveValue('Somchai "Tom" Jaidee')
  await expect(page.getByText('Same as row 5')).toBeVisible()
})

test('a saved template reloads the exact layout', async ({ page }, testInfo) => {
  await page.getByTestId('anchor-x').fill('131.7')
  await page.getByTestId('anchor-y').fill('98.3')
  await page.getByTestId('font-size').fill('44.5')
  await page.getByTestId('font-select').selectOption('kanit')
  await page.getByTestId('max-width').fill('215')

  const saved = await exportFile(page, /Save template/, testInfo.outputPath('template.json'))
  const json = JSON.parse(saved.bytes.toString('utf8'))
  expect(json.textLayers.name).toMatchObject({ anchor: { xMm: 131.7, yMm: 98.3 }, sizePt: 44.5, font: 'kanit', maxWidthMm: 215 })

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Reset layout' }).click()
  await expect(page.getByTestId('anchor-x')).toHaveValue('148.5')

  await page.getByTestId('template-input').setInputFiles(testInfo.outputPath('template.json'))
  await expect(page.getByTestId('anchor-x')).toHaveValue('131.7')
  await expect(page.getByTestId('anchor-y')).toHaveValue('98.3')
  await expect(page.getByTestId('font-size')).toHaveValue('44.5')
  await expect(page.getByTestId('font-select')).toHaveValue('kanit')
  await expect(page.getByTestId('max-width')).toHaveValue('215')
})
