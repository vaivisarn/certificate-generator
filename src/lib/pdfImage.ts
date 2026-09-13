// Put raw pixels into a PDF as image objects, compressed with fflate.
// This skips pdf-lib's PNG decoder, which is slow when repeated 500 times.

import { zlibSync } from 'fflate'
import {
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  PDFHexString,
  pushGraphicsState,
  type PDFDocument,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib'
import { mmToPt, PAGE_H_PT, type RectMm } from './geometry'
import type { NameBitmap } from './renderName'

const FLATE = { Filter: 'FlateDecode' } as const

function registerStream(doc: PDFDocument, data: Uint8Array, dict: Record<string, unknown>): PDFRef {
  const stream = doc.context.stream(zlibSync(data, { level: 6 }), { ...FLATE, ...dict } as never)
  return doc.context.register(stream)
}

function softMask(doc: PDFDocument, alpha: Uint8Array, width: number, height: number): PDFRef {
  return registerStream(doc, alpha, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceGray',
    BitsPerComponent: 8,
  })
}

/**
 * The name as a one colour image with a soft mask.
 * The colour part uses a one entry palette and 1 bit per pixel, so it is all
 * zeros and compresses to almost nothing. The mask carries the letter shapes.
 */
export function embedNameImage(doc: PDFDocument, bitmap: NameBitmap, colourHex: string): PDFRef {
  const { width, height, alpha } = bitmap
  const mask = softMask(doc, alpha, width, height)
  const indices = new Uint8Array(Math.ceil(width / 8) * height)
  return registerStream(doc, indices, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: ['Indexed', 'DeviceRGB', 0, PDFHexString.of(colourHex.replace('#', ''))],
    BitsPerComponent: 1,
    SMask: mask,
  })
}

/** Any canvas drawable as a full colour image. Used when a background cannot be embedded directly. */
export function embedCanvasImage(doc: PDFDocument, source: CanvasImageSource, width: number, height: number): PDFRef {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser cannot draw on a canvas.')
  ctx.drawImage(source, 0, 0, width, height)
  const rgba = ctx.getImageData(0, 0, width, height).data

  const rgb = new Uint8Array(width * height * 3)
  const alpha = new Uint8Array(width * height)
  let opaque = true
  for (let i = 0, p = 0, q = 0; i < alpha.length; i++, p += 4, q += 3) {
    rgb[q] = rgba[p]
    rgb[q + 1] = rgba[p + 1]
    rgb[q + 2] = rgba[p + 2]
    alpha[i] = rgba[p + 3]
    if (rgba[p + 3] !== 255) opaque = false
  }

  return registerStream(doc, rgb, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
    ...(opaque ? {} : { SMask: softMask(doc, alpha, width, height) }),
  })
}

/** PDF placement for a rectangle given in mm from the top left of the page. */
export function rectToPt(rect: RectMm): { x: number; y: number; width: number; height: number } {
  return {
    x: mmToPt(rect.x),
    y: PAGE_H_PT - mmToPt(rect.y + rect.h),
    width: mmToPt(rect.w),
    height: mmToPt(rect.h),
  }
}

/** Draw an image object on a page at a rectangle in mm. */
export function drawImageObject(page: PDFPage, ref: PDFRef, rect: RectMm): void {
  const { x, y, width, height } = rectToPt(rect)
  const name = page.node.newXObject('Img', ref)
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(width, 0, 0, height, x, y),
    drawObject(name),
    popGraphicsState(),
  )
}
