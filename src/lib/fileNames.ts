import { cleanName } from './parseNames'

const MAX_NAME_LENGTH = 80

/** Characters Windows, macOS or ZIP tools reject in file names, including control characters. */
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f\u007f]/g

/** Cut to a number of visible characters without splitting Thai marks from their letter. */
function truncateGraphemes(text: string, max: number): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
    return segments
      .slice(0, max)
      .map((s) => s.segment)
      .join('')
  }
  return Array.from(text).slice(0, max).join('')
}

/** A name that is safe to use as a file name. Thai and spaces are kept. */
export function safeFileName(name: string): string {
  const cleaned = cleanName(name.replace(UNSAFE, ' ')).replace(/^\.+/, '')
  const cut = truncateGraphemes(cleaned, MAX_NAME_LENGTH).trim()
  return cut || 'certificate'
}

/** `001_Anna Lee.pdf`. Numbers get more digits when there are 1000 or more. */
export function numberedFileName(index: number, total: number, name: string, extension: string): string {
  const width = Math.max(3, String(total).length)
  return `${String(index + 1).padStart(width, '0')}_${safeFileName(name)}.${extension}`
}

/** `certificates_2026-09-13.pdf` */
export function batchFileName(suffix: string, extension: string, date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `certificates${suffix}_${y}-${m}-${d}.${extension}`
}
