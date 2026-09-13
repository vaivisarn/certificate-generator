/**
 * EXIF orientation of a JPEG, 1 when upright or unknown.
 * Browsers rotate photos by this tag when showing them, but a PDF shows the
 * raw pixels. A rotated JPEG is therefore redrawn before it goes into a PDF.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.byteLength
  if (length < 4 || view.getUint16(0) !== 0xffd8) return 1

  let offset = 2
  while (offset + 4 <= length) {
    const marker = view.getUint16(offset)
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1
    const size = view.getUint16(offset + 2)

    // APP1 segment starting with "Exif\0\0"
    if (marker === 0xffe1 && offset + 18 <= length && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10
      const little = view.getUint16(tiff) === 0x4949
      const ifd = tiff + view.getUint32(tiff + 4, little)
      if (ifd + 2 > length) return 1
      const count = view.getUint16(ifd, little)
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12
        if (entry + 12 > length) return 1
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little)
      }
      return 1
    }
    offset += 2 + size
  }
  return 1
}
