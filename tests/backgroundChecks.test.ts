import { describe, expect, it } from 'vitest'
import { checkBackground } from '../src/lib/backgroundChecks'

const levels = (msgs: { level: string }[]) => msgs.map((m) => m.level)

describe('checkBackground', () => {
  it('a 300 DPI A4 PNG has no warnings', () => {
    const msgs = checkBackground({ kind: 'png', width: 3508, height: 2480, pageCount: 1 }, 'fit')
    expect(levels(msgs)).toEqual(['ok', 'ok'])
  })

  it('a 16:9 slide names PowerPoint and how to fix it', () => {
    const msgs = checkBackground({ kind: 'png', width: 3840, height: 2160, pageCount: 1 }, 'fit')
    expect(msgs[0].level).toBe('warn')
    expect(msgs[0].text).toContain('16:9')
    expect(msgs[0].text).toContain('PowerPoint')
    expect(msgs[0].text).toContain('A4 Paper')
  })

  it('warns below 150 DPI with the minimum width in pixels', () => {
    const msgs = checkBackground({ kind: 'jpg', width: 1000, height: 707, pageCount: 1 }, 'fit')
    const low = msgs.find((m) => m.text.startsWith('Low resolution'))
    expect(low?.level).toBe('warn')
    expect(low?.text).toContain('1754 px')
    expect(low?.text).toContain('3508 px')
  })

  it('between 150 and 300 DPI is information, not a warning', () => {
    const msgs = checkBackground({ kind: 'png', width: 2000, height: 1414, pageCount: 1 }, 'fit')
    expect(levels(msgs)).toEqual(['ok', 'info'])
  })

  it('a PDF skips the DPI check and flags extra pages', () => {
    const msgs = checkBackground({ kind: 'pdf', width: 841.89, height: 595.28, pageCount: 3 }, 'fit')
    expect(msgs.some((m) => m.text.includes('DPI'))).toBe(false)
    expect(msgs.at(-1)).toEqual({ level: 'warn', text: 'This PDF has 3 pages. Only page 1 is used.' })
  })

  it('fill lowers the DPI shown for a wide image', () => {
    const fit = checkBackground({ kind: 'png', width: 1920, height: 1080, pageCount: 1 }, 'fit')
    const fill = checkBackground({ kind: 'png', width: 1920, height: 1080, pageCount: 1 }, 'fill')
    expect(fit.at(-1)?.text).toContain('164 DPI')
    expect(fill.at(-1)?.text).toContain('131 DPI')
  })
})
