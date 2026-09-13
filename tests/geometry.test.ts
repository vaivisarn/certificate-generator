import { describe, expect, it } from 'vitest'
import {
  backgroundRect,
  checkRatio,
  effectiveDpi,
  mmToPt,
  PAGE_H_MM,
  PAGE_H_PT,
  PAGE_W_MM,
  PAGE_W_PT,
  pageHeightPx,
  pageWidthPx,
  pxToMm,
  mmToPx,
} from '../src/lib/geometry'

describe('page constants', () => {
  it('A4 landscape in points', () => {
    expect(mmToPt(PAGE_W_MM)).toBeCloseTo(PAGE_W_PT, 1)
    expect(mmToPt(PAGE_H_MM)).toBeCloseTo(PAGE_H_PT, 1)
  })

  it('A4 landscape at 300 DPI is 3508 x 2480 px', () => {
    expect(pageWidthPx(300)).toBe(3508)
    expect(pageHeightPx(300)).toBe(2480)
    expect(pageWidthPx(150)).toBe(1754)
  })

  it('mm to px round trip', () => {
    const scale = 2.5
    expect(mmToPx(148.5, scale)).toBe(371.25)
    expect(pxToMm(mmToPx(148.5, scale), scale)).toBe(148.5)
  })
})

describe('checkRatio', () => {
  it('accepts exact A4', () => {
    expect(checkRatio(3508, 2480)).toMatchObject({ matches: true, shape: 'a4' })
  })

  it('accepts a Chrome printed PDF page that is slightly off', () => {
    expect(checkRatio(841.92, 594.96).matches).toBe(true)
  })

  it('accepts 1.5 percent off, rejects 2 percent off', () => {
    const a4 = PAGE_W_MM / PAGE_H_MM
    expect(checkRatio(a4 * 1.014 * 1000, 1000).matches).toBe(true)
    expect(checkRatio(a4 * 1.02 * 1000, 1000).matches).toBe(false)
  })

  it('recognises a PowerPoint 16:9 export', () => {
    expect(checkRatio(1920, 1080)).toMatchObject({ matches: false, shape: '16:9' })
    expect(checkRatio(13.333, 7.5).shape).toBe('16:9')
  })

  it('recognises 4:3 and portrait', () => {
    expect(checkRatio(1024, 768).shape).toBe('4:3')
    expect(checkRatio(2480, 3508).shape).toBe('a4-portrait')
    expect(checkRatio(1000, 1500).shape).toBe('portrait')
  })
})

describe('backgroundRect', () => {
  it('covers the page exactly when the ratio matches', () => {
    expect(backgroundRect(3508, 2480, 'fit')).toEqual({ x: 0, y: 0, w: 297, h: 210 })
    expect(backgroundRect(3508, 2480, 'fill')).toEqual({ x: 0, y: 0, w: 297, h: 210 })
  })

  it('fit keeps a wide image inside the page with top and bottom margins', () => {
    const r = backgroundRect(1920, 1080, 'fit')
    expect(r.w).toBe(297)
    expect(r.h).toBeCloseTo(167.06, 2)
    expect(r.x).toBe(0)
    expect(r.y).toBeCloseTo((210 - 167.06) / 2, 2)
  })

  it('fill covers the page with a wide image and crops the sides', () => {
    const r = backgroundRect(1920, 1080, 'fill')
    expect(r.h).toBe(210)
    expect(r.w).toBeCloseTo(373.33, 2)
    expect(r.x).toBeLessThan(0)
    expect(r.x + r.w / 2).toBeCloseTo(148.5, 6)
  })

  it('fit and fill for a tall image', () => {
    const fit = backgroundRect(1000, 1000, 'fit')
    expect(fit).toMatchObject({ w: 210, h: 210, y: 0 })
    const fill = backgroundRect(1000, 1000, 'fill')
    expect(fill).toMatchObject({ w: 297, h: 297, x: 0 })
    expect(fill.y).toBeCloseTo(-43.5, 6)
  })
})

describe('effectiveDpi', () => {
  it('is 300 for a 3508 px wide A4 image', () => {
    expect(effectiveDpi(3508, { x: 0, y: 0, w: 297, h: 210 })).toBeCloseTo(300, 0)
  })

  it('drops when fill stretches an image beyond the page width', () => {
    const fit = effectiveDpi(1920, backgroundRect(1920, 1080, 'fit'))
    const fill = effectiveDpi(1920, backgroundRect(1920, 1080, 'fill'))
    expect(Math.round(fit)).toBe(164)
    expect(Math.round(fill)).toBe(131)
  })
})
