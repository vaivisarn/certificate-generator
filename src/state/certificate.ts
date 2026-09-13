import type { Background } from '../lib/background'
import type { BackgroundFit } from '../lib/geometry'

/** The one shared state object all panels read and update. */
export interface CertificateState {
  background: Background | null
  backgroundFit: BackgroundFit
}

export const initialState: CertificateState = {
  background: null,
  backgroundFit: 'fit',
}

export type UpdateState = (patch: Partial<CertificateState>) => void
