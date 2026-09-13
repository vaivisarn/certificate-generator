// Layout templates: position and style saved as a small JSON file.
// Names and the background file are never included. Templates may be
// emailed around, and participant names must stay on this computer.

import { FONTS, type FontId } from '../lib/fonts'
import { PAGE_H_MM, PAGE_W_MM, type BackgroundFit } from '../lib/geometry'
import { defaultNameLayer, initialState, type CertificateState, type TextLayer } from './certificate'

export const TEMPLATE_APP = 'certificate-generator'
export const TEMPLATE_VERSION = 1

export interface TemplateFile {
  app: typeof TEMPLATE_APP
  templateVersion: number
  appVersion: string
  savedAt: string
  page: { size: 'A4'; orientation: 'landscape'; widthMm: number; heightMm: number }
  background: {
    fit: BackgroundFit
    /** Reminder of which background the layout was made for. The file itself is not saved. */
    fileName: string | null
  }
  /** Keyed by layer. v0.1 has only "name". */
  textLayers: { name: TextLayer }
  /** Reminder of a custom font file. The font itself is not saved. */
  customFontName: string | null
}

export type TemplateSource = Pick<CertificateState, 'background' | 'backgroundFit' | 'nameLayer' | 'customFontName'>

export function toTemplate(source: TemplateSource, now = new Date()): TemplateFile {
  return {
    app: TEMPLATE_APP,
    templateVersion: TEMPLATE_VERSION,
    appVersion: __APP_VERSION__,
    savedAt: now.toISOString(),
    page: { size: 'A4', orientation: 'landscape', widthMm: PAGE_W_MM, heightMm: PAGE_H_MM },
    background: { fit: source.backgroundFit, fileName: source.background?.fileName ?? null },
    textLayers: { name: { ...source.nameLayer, anchor: { ...source.nameLayer.anchor } } },
    customFontName: source.customFontName,
  }
}

export class TemplateError extends Error {}

export interface ParsedTemplate {
  backgroundFit: BackgroundFit
  nameLayer: TextLayer
  backgroundFileName: string | null
  /** Things the user should know, such as a font file to load again. */
  notes: string[]
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i

/**
 * Read a template, from a file or from browser storage. Unknown fields are
 * ignored and bad values fall back to the defaults, so an older or hand
 * edited file still loads.
 * `customFontLoaded` is the label of a font file loaded in this session, if any.
 */
export function parseTemplate(data: unknown, customFontLoaded: string | null): ParsedTemplate {
  if (!isObject(data) || data.app !== TEMPLATE_APP) {
    throw new TemplateError('This file is not a certificate template.')
  }

  const notes: string[] = []
  let fixedValues = 0

  const version = typeof data.templateVersion === 'number' ? data.templateVersion : TEMPLATE_VERSION
  if (version > TEMPLATE_VERSION) {
    notes.push('This template was saved by a newer version of the app. Some settings may be ignored.')
  }

  function number(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fixedValues++
      return fallback
    }
    return Math.min(max, Math.max(min, value))
  }

  function boolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value
    fixedValues++
    return fallback
  }

  const background = isObject(data.background) ? data.background : {}
  const fit: BackgroundFit = background.fit === 'fill' ? 'fill' : 'fit'
  const backgroundFileName = typeof background.fileName === 'string' ? background.fileName : null

  const layers = isObject(data.textLayers) ? data.textLayers : {}
  const layer = isObject(layers.name) ? layers.name : {}
  const anchor = isObject(layer.anchor) ? layer.anchor : {}
  const d = defaultNameLayer

  let font: FontId = d.font
  if (FONTS.some((f) => f.id === layer.font)) {
    font = layer.font as FontId
  } else {
    fixedValues++
  }

  const savedCustomFont = typeof data.customFontName === 'string' ? data.customFontName : null
  if (font === 'custom' && !customFontLoaded) {
    font = d.font
    notes.push(
      `This layout uses the custom font ${savedCustomFont ? `"${savedCustomFont}"` : 'file'}. Load the font file again in Style to use it. Sarabun is shown until then.`,
    )
  } else if (font === 'custom' && savedCustomFont && savedCustomFont !== customFontLoaded) {
    notes.push(`This layout was made with the font "${savedCustomFont}", but "${customFontLoaded}" is loaded now.`)
  }

  let color = d.color
  if (typeof layer.color === 'string' && HEX_COLOUR.test(layer.color)) {
    color = layer.color.toLowerCase()
  } else {
    fixedValues++
  }

  const nameLayer: TextLayer = {
    anchor: {
      xMm: number(anchor.xMm, 0, PAGE_W_MM, d.anchor.xMm),
      yMm: number(anchor.yMm, 0, PAGE_H_MM, d.anchor.yMm),
    },
    font,
    sizePt: number(layer.sizePt, 6, 300, d.sizePt),
    color,
    bold: boolean(layer.bold, d.bold),
    maxWidthMm: number(layer.maxWidthMm, 10, PAGE_W_MM, d.maxWidthMm),
    autoShrink: boolean(layer.autoShrink, d.autoShrink),
  }

  if (fixedValues > 0) {
    notes.push(
      `${fixedValues} setting${fixedValues === 1 ? ' was' : 's were'} missing or not valid and ${fixedValues === 1 ? 'uses its' : 'use their'} default.`,
    )
  }

  return { backgroundFit: fit, nameLayer, backgroundFileName, notes }
}

/** Parse the text of a template file. */
export function parseTemplateText(text: string, customFontLoaded: string | null): ParsedTemplate {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new TemplateError('This file is not a certificate template. It could not be read as JSON.')
  }
  return parseTemplate(data, customFontLoaded)
}

export function templateFileName(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `certificate-template_${y}-${m}-${day}.json`
}

/** Default layout values, used by "Reset layout". */
export function defaultLayout(): Pick<CertificateState, 'backgroundFit' | 'nameLayer' | 'showGuides'> {
  return {
    backgroundFit: initialState.backgroundFit,
    nameLayer: { ...defaultNameLayer, anchor: { ...defaultNameLayer.anchor } },
    showGuides: initialState.showGuides,
  }
}
