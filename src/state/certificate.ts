import type { Background } from '../lib/background'
import type { FontId } from '../lib/fonts'
import { DEFAULT_ANCHOR, type BackgroundFit } from '../lib/geometry'

/**
 * One piece of text drawn on every certificate. v0.1 has only the name, but
 * keeping it as a layer makes a second field (date, number) easy to add.
 */
export interface TextLayer {
  /** The text is centred on this point, in mm from the top left of the page. */
  anchor: { xMm: number; yMm: number }
  font: FontId
  sizePt: number
  /** CSS hex colour, e.g. #1d2430. */
  color: string
  bold: boolean
  /** Longest allowed text width in mm. */
  maxWidthMm: number
  /** Shrink the font for names wider than maxWidthMm. */
  autoShrink: boolean
}

export const defaultNameLayer: TextLayer = {
  anchor: { ...DEFAULT_ANCHOR },
  font: 'sarabun',
  sizePt: 40,
  color: '#1d2430',
  bold: true,
  maxWidthMm: 240,
  autoShrink: true,
}

/** The one shared state object all panels read and update. */
export interface CertificateState {
  background: Background | null
  backgroundFit: BackgroundFit
  /** Participant names in export order. Never saved to disk or storage. */
  names: string[]
  nameLayer: TextLayer
  showSafeArea: boolean
}

export const initialState: CertificateState = {
  background: null,
  backgroundFit: 'fit',
  names: [],
  nameLayer: defaultNameLayer,
  showSafeArea: true,
}

export type UpdateState = (patch: Partial<CertificateState>) => void
