import {
  backgroundRect,
  checkRatio,
  effectiveDpi,
  IDEAL_DPI,
  MIN_DPI,
  pageWidthPx,
  ptToMm,
  type BackgroundFit,
} from './geometry'

export type CheckLevel = 'ok' | 'info' | 'warn'

export interface CheckMessage {
  level: CheckLevel
  text: string
}

export interface BackgroundInfo {
  kind: 'png' | 'jpg' | 'pdf'
  /** Pixels for images, points for PDF. */
  width: number
  height: number
  pageCount: number
}

const POWERPOINT_FIX =
  'In PowerPoint, go to Design, Slide Size, Custom Slide Size, pick A4 Paper and Landscape, then export again.'

export function checkBackground(bg: BackgroundInfo, fit: BackgroundFit): CheckMessage[] {
  const messages: CheckMessage[] = []
  const { ratio, matches, shape } = checkRatio(bg.width, bg.height)
  const ratioText = `${ratio.toFixed(3)}:1`

  switch (shape) {
    case 'a4':
      messages.push({ level: 'ok', text: 'Shape matches A4 landscape.' })
      break
    case '16:9':
      messages.push({
        level: 'warn',
        text: `This is a 16:9 widescreen shape, the default PowerPoint slide size. A4 landscape is narrower (1.414:1), so it will not cover the page. ${POWERPOINT_FIX}`,
      })
      break
    case '4:3':
      messages.push({
        level: 'warn',
        text: `This is a 4:3 shape, the old PowerPoint slide size. A4 landscape is 1.414:1, so it will not cover the page. ${POWERPOINT_FIX}`,
      })
      break
    case 'a4-portrait':
      messages.push({
        level: 'warn',
        text: 'This background is A4 portrait. This version supports A4 landscape only. Turn the design to landscape and export it again.',
      })
      break
    case 'portrait':
      messages.push({
        level: 'warn',
        text: `This background is portrait (${ratioText}). This version supports A4 landscape only (1.414:1).`,
      })
      break
    default:
      messages.push({
        level: 'warn',
        text: `This background is a ${ratioText} shape. A4 landscape is 1.414:1, so it will not cover the page exactly.`,
      })
  }

  if (!matches) {
    messages.push({ level: 'info', text: 'Choose Fit or Fill below, or replace the file.' })
  }

  if (bg.kind === 'pdf') {
    const w = Math.round(ptToMm(bg.width))
    const h = Math.round(ptToMm(bg.height))
    messages.push({ level: 'ok', text: `PDF page ${w} x ${h} mm. PDF backgrounds keep their original quality.` })
    if (bg.pageCount > 1) {
      messages.push({ level: 'warn', text: `This PDF has ${bg.pageCount} pages. Only page 1 is used.` })
    }
  } else {
    const dpi = Math.round(effectiveDpi(bg.width, backgroundRect(bg.width, bg.height, fit)))
    if (dpi < MIN_DPI) {
      messages.push({
        level: 'warn',
        text: `Low resolution: about ${dpi} DPI on A4, so it may print blurry. Use an image at least ${pageWidthPx(MIN_DPI)} px wide, ideally ${pageWidthPx(IDEAL_DPI)} px.`,
      })
    } else if (dpi < IDEAL_DPI - 5) {
      messages.push({
        level: 'info',
        text: `About ${dpi} DPI on A4. Fine for printing. ${pageWidthPx(IDEAL_DPI)} px wide (300 DPI) is ideal.`,
      })
    } else {
      messages.push({ level: 'ok', text: `About ${dpi} DPI on A4. Good for printing.` })
    }
  }

  return messages
}
