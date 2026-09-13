import { describe, expect, it } from 'vitest'
import { defaultNameLayer, type TextLayer } from '../src/state/certificate'
import {
  parseTemplate,
  parseTemplateText,
  TemplateError,
  templateFileName,
  toTemplate,
  type TemplateSource,
} from '../src/state/template'

const layer: TextLayer = {
  anchor: { xMm: 131.7, yMm: 98.3 },
  font: 'kanit',
  sizePt: 44.5,
  color: '#8a1c1c',
  bold: false,
  maxWidthMm: 215,
  autoShrink: false,
}

const source: TemplateSource = {
  background: null,
  backgroundFit: 'fill',
  nameLayer: layer,
  customFontName: null,
}

describe('toTemplate and parseTemplate', () => {
  it('round trips the exact layout through JSON', () => {
    const text = JSON.stringify(toTemplate(source))
    const parsed = parseTemplateText(text, null)
    expect(parsed.nameLayer).toEqual(layer)
    expect(parsed.backgroundFit).toBe('fill')
    expect(parsed.notes).toEqual([])
  })

  it('never contains names or background data', () => {
    const template = toTemplate({
      ...source,
      background: { fileName: 'artwork.png', bytes: new ArrayBuffer(8) } as never,
    })
    const text = JSON.stringify(template)
    expect(text).not.toContain('names')
    expect(text).not.toContain('bytes')
    expect(template.background.fileName).toBe('artwork.png')
  })

  it('records the page size and a template version', () => {
    const template = toTemplate(source, new Date('2026-09-13T08:00:00Z'))
    expect(template.page).toEqual({ size: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 })
    expect(template.templateVersion).toBe(1)
    expect(template.savedAt).toBe('2026-09-13T08:00:00.000Z')
  })
})

describe('parseTemplate rejects other files', () => {
  it('rejects JSON that is not a template', () => {
    expect(() => parseTemplate({ hello: 'world' }, null)).toThrow(TemplateError)
    expect(() => parseTemplate([1, 2], null)).toThrow(TemplateError)
    expect(() => parseTemplate(null, null)).toThrow(TemplateError)
  })

  it('rejects text that is not JSON', () => {
    expect(() => parseTemplateText('Anna Lee\nBob', null)).toThrow(TemplateError)
  })
})

describe('parseTemplate is forgiving with bad values', () => {
  it('uses defaults for missing or wrong values and says how many', () => {
    const parsed = parseTemplate(
      { app: 'certificate-generator', textLayers: { name: { sizePt: 'big', color: 'red', font: 'Comic Sans' } } },
      null,
    )
    expect(parsed.nameLayer.sizePt).toBe(defaultNameLayer.sizePt)
    expect(parsed.nameLayer.color).toBe(defaultNameLayer.color)
    expect(parsed.nameLayer.font).toBe(defaultNameLayer.font)
    expect(parsed.nameLayer.anchor).toEqual(defaultNameLayer.anchor)
    expect(parsed.notes.at(-1)).toMatch(/settings were missing or not valid/)
  })

  it('keeps the anchor on the page and the size in range', () => {
    const template = toTemplate({ ...source, nameLayer: { ...layer, anchor: { xMm: -20, yMm: 500 }, sizePt: 900 } })
    const parsed = parseTemplate(template, null)
    expect(parsed.nameLayer.anchor).toEqual({ xMm: 0, yMm: 210 })
    expect(parsed.nameLayer.sizePt).toBe(300)
  })

  it('notes a template from a newer version', () => {
    const template = { ...toTemplate(source), templateVersion: 99 }
    expect(parseTemplate(template, null).notes[0]).toMatch(/newer version/)
  })
})

describe('custom fonts', () => {
  const withCustom = toTemplate({ ...source, nameLayer: { ...layer, font: 'custom' }, customFontName: 'THSarabunNew' })

  it('falls back to Sarabun and asks for the font file when it is not loaded', () => {
    const parsed = parseTemplate(withCustom, null)
    expect(parsed.nameLayer.font).toBe('sarabun')
    expect(parsed.notes[0]).toContain('"THSarabunNew"')
  })

  it('keeps the custom font when a font file is loaded', () => {
    const parsed = parseTemplate(withCustom, 'THSarabunNew')
    expect(parsed.nameLayer.font).toBe('custom')
    expect(parsed.notes).toEqual([])
  })

  it('mentions a different font file', () => {
    const parsed = parseTemplate(withCustom, 'Other Font')
    expect(parsed.nameLayer.font).toBe('custom')
    expect(parsed.notes[0]).toContain('"Other Font"')
  })
})

describe('templateFileName', () => {
  it('includes the date', () => {
    expect(templateFileName(new Date(2026, 8, 13))).toBe('certificate-template_2026-09-13.json')
  })
})
