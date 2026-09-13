import '@fontsource/sarabun/400.css'
import '@fontsource/sarabun/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/kanit/400.css'
import '@fontsource/kanit/700.css'

export type FontId = 'sarabun' | 'inter' | 'kanit'

export interface FontOption {
  id: FontId
  label: string
  family: string
}

export const FONTS: FontOption[] = [
  { id: 'sarabun', label: 'Sarabun (Thai and English)', family: 'Sarabun' },
  { id: 'kanit', label: 'Kanit (Thai and English)', family: 'Kanit' },
  { id: 'inter', label: 'Inter (English, Thai falls back to Sarabun)', family: 'Inter' },
]

/**
 * CSS font stack. Inter has no Thai letters, so Thai names fall back to
 * Sarabun, which keeps the preview and the export identical on every computer.
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
