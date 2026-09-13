import { describe, expect, it } from 'vitest'
import { batchFileName, numberedFileName, safeFileName } from '../src/lib/fileNames'
import { jpegOrientation } from '../src/lib/jpegOrientation'

describe('safeFileName', () => {
  it('keeps Thai, spaces and ordinary punctuation', () => {
    expect(safeFileName('น้ำฝน ใจดี')).toBe('น้ำฝน ใจดี')
    expect(safeFileName("Mr. John O'Neil")).toBe("Mr. John O'Neil")
  })

  it('removes characters that break file systems', () => {
    expect(safeFileName('A/B\\C:D*E?F"G<H>I|J')).toBe('A B C D E F G H I J')
  })

  it('does not start with a dot and is never empty', () => {
    expect(safeFileName('..hidden')).toBe('hidden')
    expect(safeFileName('///')).toBe('certificate')
  })

  it('cuts long names without splitting Thai marks from their letter', () => {
    // 'ปิ่น' is 2 visible characters, so 50 of them is 100, over the 80 limit.
    const long = 'ปิ่น'.repeat(50)
    const cut = safeFileName(long)
    expect(cut.length).toBeLessThan(long.length)
    expect(cut.endsWith('ปิ่น')).toBe(true)
  })
})

describe('numberedFileName', () => {
  it('pads to three digits', () => {
    expect(numberedFileName(0, 500, 'Anna Lee', 'pdf')).toBe('001_Anna Lee.pdf')
    expect(numberedFileName(499, 500, 'กิ่งแก้ว', 'png')).toBe('500_กิ่งแก้ว.png')
  })

  it('uses more digits for 1000 or more names', () => {
    expect(numberedFileName(6, 1200, 'Bob', 'pdf')).toBe('0007_Bob.pdf')
  })
})

describe('batchFileName', () => {
  it('adds the date', () => {
    expect(batchFileName('', 'pdf', new Date(2026, 8, 3))).toBe('certificates_2026-09-03.pdf')
    expect(batchFileName('_png', 'zip', new Date(2026, 11, 25))).toBe('certificates_png_2026-12-25.zip')
  })
})

/** Minimal JPEG header with an EXIF orientation tag. */
function jpegWithOrientation(orientation: number, littleEndian: boolean): Uint8Array {
  const tiff = new Uint8Array(26)
  const v = new DataView(tiff.buffer)
  v.setUint16(0, littleEndian ? 0x4949 : 0x4d4d)
  v.setUint16(2, 42, littleEndian)
  v.setUint32(4, 8, littleEndian) // first IFD right after the header
  v.setUint16(8, 1, littleEndian) // one entry
  v.setUint16(10, 0x0112, littleEndian)
  v.setUint16(12, 3, littleEndian) // SHORT
  v.setUint32(14, 1, littleEndian)
  v.setUint16(18, orientation, littleEndian)

  const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0])
  const segmentLength = 2 + exif.length + tiff.length
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff,
    ...exif,
    ...tiff,
    0xff, 0xda, 0, 2,
  ])
}

describe('jpegOrientation', () => {
  it('reads the orientation tag in both byte orders', () => {
    expect(jpegOrientation(jpegWithOrientation(6, true))).toBe(6)
    expect(jpegOrientation(jpegWithOrientation(8, false))).toBe(8)
  })

  it('returns 1 for a JPEG without EXIF and for other files', () => {
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1)
    expect(jpegOrientation(new Uint8Array([]))).toBe(1)
  })
})
