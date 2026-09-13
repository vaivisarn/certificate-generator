import '@fontsource/sarabun/400.css'
import '@fontsource/sarabun/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/kanit/400.css'
import '@fontsource/kanit/700.css'

export type FontId = 'sarabun' | 'inter' | 'kanit' | 'custom'

export interface FontOption {
  id: FontId
  label: string
  family: string
}

/** Internal family name for a font file the user loads, e.g. TH Sarabun New. */
const CUSTOM_FAMILY = 'Certificate Custom Font'

export const FONTS: FontOption[] = [
  { id: 'sarabun', label: 'Sarabun (Thai and English)', family: 'Sarabun' },
  { id: 'kanit', label: 'Kanit (Thai and English)', family: 'Kanit' },
  { id: 'inter', label: 'Inter (English, Thai falls back to Sarabun)', family: 'Inter' },
  { id: 'custom', label: 'Custom font', family: CUSTOM_FAMILY },
]

/**
 * CSS font stack. Fonts without Thai letters fall back to Sarabun, which keeps
 * the preview and the export identical on every computer.
 */
export function fontStack(id: FontId): string {
  const family = FONTS.find((f) => f.id === id)?.family ?? 'Sarabun'
  return family === 'Sarabun' ? '"Sarabun", sans-serif' : `"${family}", "Sarabun", sans-serif`
}

export function canvasFont(id: FontId, bold: boolean, sizePx: number): string {
  return `${bold ? 700 : 400} ${sizePx}px ${fontStack(id)}`
}

/**
 * Make sure the font files needed for `text` are downloaded before drawing on
 * a canvas. A canvas does not wait for web fonts, it silently uses a fallback.
 */
export async function loadFont(id: FontId, bold: boolean, text: string): Promise<void> {
  try {
    await document.fonts.load(canvasFont(id, bold, 40), text || 'A')
  } catch {
    // Drawing still works with the fallback font.
  }
}

let customFaces: FontFace[] = []

export class FontFileError extends Error {}

/**
 * Load one or two font files (regular and bold) from the user's computer.
 * A file name containing "bold" is used for bold text. The files stay in the
 * browser and are never uploaded. Returns a label for the loaded font.
 */
export async function loadCustomFont(files: File[]): Promise<string> {
  if (files.length === 0) throw new FontFileError('No font file chosen.')

  const faces = await Promise.all(
    files.map(async (file) => {
      const weight = /bold/i.test(file.name) ? '700' : '400'
      const face = new FontFace(CUSTOM_FAMILY, await file.arrayBuffer(), { weight })
      try {
        return await face.load()
      } catch {
        throw new FontFileError(`"${file.name}" is not a font file this browser can read. Use TTF, OTF, WOFF or WOFF2.`)
      }
    }),
  )

  customFaces.forEach((face) => document.fonts.delete(face))
  faces.forEach((face) => document.fonts.add(face))
  customFaces = faces

  return files
    .map((f) => f.name.replace(/\.(ttf|otf|woff2?)$/i, ''))
    .join(' + ')
}
