import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { rectToPt } from '../src/lib/pdfImage'
import { ZipBuilder } from '../src/lib/zip'

describe('ZipBuilder', () => {
  it('stores files with Thai names that unzip back unchanged', async () => {
    const zip = new ZipBuilder()
    const first = new Uint8Array([1, 2, 3, 4])
    const second = new TextEncoder().encode('%PDF-1.7 sample')
    zip.add('001_น้ำฝน ใจดี.pdf', first)
    zip.add('002_Anna Lee.pdf', second)
    const blob = await zip.finish()

    expect(blob.type).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['001_น้ำฝน ใจดี.pdf', '002_Anna Lee.pdf'])
    expect(files['001_น้ำฝน ใจดี.pdf']).toEqual(first)
    expect(files['002_Anna Lee.pdf']).toEqual(second)
  })
})

describe('rectToPt', () => {
  it('turns a full page rectangle in mm into the full A4 page in points', () => {
    const r = rectToPt({ x: 0, y: 0, w: 297, h: 210 })
    expect(r.x).toBeCloseTo(0, 6)
    expect(r.y).toBeCloseTo(0, 1)
    expect(r.width).toBeCloseTo(841.89, 1)
    expect(r.height).toBeCloseTo(595.28, 1)
  })

  it('flips the y axis, PDF measures from the bottom of the page', () => {
    // A 10 mm box touching the top edge sits 200 mm above the bottom.
    const r = rectToPt({ x: 10, y: 0, w: 10, h: 10 })
    expect(r.x).toBeCloseTo(28.35, 2)
    expect(r.y).toBeCloseTo((200 / 25.4) * 72, 1)
    expect(r.height).toBeCloseTo(28.35, 2)
  })
})
