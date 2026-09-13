// Remember the last layout in this browser, so a reload keeps the position
// and style. Names and background files are never stored.

import type { CertificateState } from './certificate'
import { parseTemplate, toTemplate, type TemplateFile } from './template'

const STORAGE_KEY = 'certificate-generator:settings:v1'

interface StoredSettings {
  template: TemplateFile
  showGuides: boolean
}

export type SavedSettings = Pick<CertificateState, 'backgroundFit' | 'nameLayer' | 'customFontName' | 'showGuides'>

export interface RestoredSettings {
  patch: Partial<CertificateState>
  notes: string[]
}

export function loadSettings(): RestoredSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<StoredSettings>
    // A font file is never stored, so no custom font is loaded after a reload.
    const parsed = parseTemplate(stored.template, null)
    return {
      patch: {
        backgroundFit: parsed.backgroundFit,
        nameLayer: parsed.nameLayer,
        showGuides: typeof stored.showGuides === 'boolean' ? stored.showGuides : true,
      },
      notes: parsed.notes,
    }
  } catch {
    // Private browsing, blocked storage or an old format: start fresh.
    return null
  }
}

export function saveSettings(settings: SavedSettings): void {
  try {
    const stored: StoredSettings = {
      template: toTemplate({ ...settings, background: null }),
      showGuides: settings.showGuides,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage full or blocked. The app works without it.
  }
}

export function clearSettings(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}
