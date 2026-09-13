import { describe, expect, it } from 'vitest'
import {
  boxInside,
  clampAnchor,
  directionFromKey,
  effectiveSizePt,
  insidePage,
  insideSafeArea,
  nudge,
  roundMm,
} from '../src/lib/placement'

describe('nudge', () => {
  const start = { xMm: 148.5, yMm: 105 }

  it('moves in mm, up is towards the top of the page', () => {
    expect(nudge(start, 'up', 1)).toEqual({ xMm: 148.5, yMm: 104 })
    expect(nudge(start, 'down', 5)).toEqual({ xMm: 148.5, yMm: 110 })
    expect(nudge(start, 'left', 0.5)).toEqual({ xMm: 148, yMm: 105 })
    expect(nudge(start, 'right', 0.5)).toEqual({ xMm: 149, yMm: 105 })
  })

  it('does not drift from floating point sums', () => {
    let a = { xMm: 0, yMm: 0 }
    for (let i = 0; i < 7; i++) a = nudge(a, 'right', 0.1 * 1)
    expect(a.xMm).toBe(0.7)
  })

  it('stops at the page edge', () => {
    expect(nudge({ xMm: 2, yMm: 1 }, 'left', 5)).toEqual({ xMm: 0, yMm: 1 })
    expect(nudge({ xMm: 295, yMm: 208 }, 'down', 5)).toEqual({ xMm: 295, yMm: 210 })
  })
})

describe('clampAnchor and roundMm', () => {
  it('rounds to 0.1 mm', () => {
    expect(roundMm(148.4499)).toBe(148.4)
    expect(roundMm(148.45)).toBe(148.5)
  })

  it('keeps the anchor on the page', () => {
    expect(clampAnchor({ xMm: -3, yMm: 400 })).toEqual({ xMm: 0, yMm: 210 })
  })
})

describe('directionFromKey', () => {
  it('maps arrow keys only', () => {
    expect(directionFromKey('ArrowUp')).toBe('up')
    expect(directionFromKey('ArrowLeft')).toBe('left')
    expect(directionFromKey('a')).toBeNull()
  })
})

describe('effectiveSizePt (automatic shrink)', () => {
  it('keeps the size for a name that fits', () => {
    expect(effectiveSizePt(120, 40, 240, true)).toBe(40)
    expect(effectiveSizePt(240, 40, 240, true)).toBe(40)
  })

  it('shrinks a long name in proportion so it fits the max width exactly', () => {
    expect(effectiveSizePt(300, 40, 240, true)).toBe(32)
    expect(effectiveSizePt(480, 40, 240, true)).toBe(20)
  })

  it('does nothing when automatic shrink is off', () => {
    expect(effectiveSizePt(480, 40, 240, false)).toBe(40)
  })

  it('a short and a long name end up no wider than max width', () => {
    const short = 60
    const long = 390
    for (const width of [short, long]) {
      const size = effectiveSizePt(width, 40, 240, true)
      expect((width * size) / 40).toBeLessThanOrEqual(240 + 1e-9)
    }
  })

  it('ignores empty text and a zero max width', () => {
    expect(effectiveSizePt(0, 40, 240, true)).toBe(40)
    expect(effectiveSizePt(300, 40, 0, true)).toBe(40)
  })
})

describe('safe area checks', () => {
  it('a centred name is inside the safe area', () => {
    expect(insideSafeArea({ left: 60, top: 95, right: 237, bottom: 115 })).toBe(true)
  })

  it('a name 5 mm from the edge is on the page but outside the safe area', () => {
    const box = { left: 5, top: 95, right: 200, bottom: 115 }
    expect(insidePage(box)).toBe(true)
    expect(insideSafeArea(box)).toBe(false)
  })

  it('a name past the page edge is outside the page', () => {
    expect(insidePage({ left: -2, top: 95, right: 200, bottom: 115 })).toBe(false)
    expect(boxInside({ left: 10, top: 10, right: 287, bottom: 200 }, 10)).toBe(true)
  })
})
