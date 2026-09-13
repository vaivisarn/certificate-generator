import { memo, useEffect, useRef, useState } from 'react'
import { FontFileError, FONTS, loadCustomFont, loadFont, type FontId } from '../lib/fonts'
import { PAGE_W_MM, SAFE_MARGIN_MM } from '../lib/geometry'
import { cleanName } from '../lib/parseNames'
import { layoutName } from '../lib/renderName'
import type { TextLayer, UpdateState } from '../state/certificate'
import { NumberField } from './NumberField'

interface Props {
  names: string[]
  nameLayer: TextLayer
  customFontName: string | null
  update: UpdateState
}

interface ShrinkSummary {
  shrunkCount: number
  smallestPt: number
  smallestRow: number
}

/** Below this share of the base size, shrunk names start to look out of place. */
const HEAVY_SHRINK = 0.6

const HEX_COLOUR = /^#[0-9a-f]{6}$/i

export const StylePanel = memo(function StylePanel({ names, nameLayer, customFontName, update }: Props) {
  const fontInputRef = useRef<HTMLInputElement>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const [fontLoading, setFontLoading] = useState(false)
  const [lastSummary, setSummary] = useState<ShrinkSummary | null>(null)
  const [colourDraft, setColourDraft] = useState<string | null>(null)
  const summary = names.some((n) => cleanName(n)) ? lastSummary : null

  const { font, bold, sizePt, maxWidthMm, autoShrink, color, anchor } = nameLayer

  function setLayer(patch: Partial<TextLayer>) {
    update({ nameLayer: { ...nameLayer, ...patch } })
  }

  // How much automatic shrink affects the whole list. Width does not depend
  // on the anchor, so moving the name does not re-run this.
  useEffect(() => {
    let cancelled = false
    const rows = names.map((n, i) => ({ row: i + 1, text: cleanName(n) })).filter((r) => r.text)
    if (rows.length === 0) return
    const layer: TextLayer = { anchor: { xMm: 0, yMm: 0 }, color: '#000000', font, bold, sizePt, maxWidthMm, autoShrink }
    void loadFont(font, bold, rows.map((r) => r.text).join('')).then(() => {
      if (cancelled) return
      let shrunkCount = 0
      let smallestPt = sizePt
      let smallestRow = rows[0].row
      for (const r of rows) {
        const l = layoutName(r.text, layer)
        if (l.shrunk) shrunkCount++
        if (l.sizePt < smallestPt) {
          smallestPt = l.sizePt
          smallestRow = r.row
        }
      }
      setSummary({ shrunkCount, smallestPt, smallestRow })
    })
    return () => {
      cancelled = true
    }
  }, [names, font, bold, sizePt, maxWidthMm, autoShrink, customFontName])

  async function onFontFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setFontError(null)
    setFontLoading(true)
    try {
      const label = await loadCustomFont([...files].slice(0, 2))
      update({ customFontName: label, nameLayer: { ...nameLayer, font: 'custom' } })
    } catch (err) {
      setFontError(err instanceof FontFileError ? err.message : 'Could not load that font file.')
    } finally {
      setFontLoading(false)
      if (fontInputRef.current) fontInputRef.current.value = ''
    }
  }

  const maxReachesPastSafe =
    anchor.xMm - maxWidthMm / 2 < SAFE_MARGIN_MM || anchor.xMm + maxWidthMm / 2 > PAGE_W_MM - SAFE_MARGIN_MM

  return (
    <div className="style">
      <div className="field">
        <label className="field-label" htmlFor="font-select">
          Font
        </label>
        <select
          id="font-select"
          value={font}
          onChange={(e) => setLayer({ font: e.target.value as FontId })}
          data-testid="font-select"
        >
          {FONTS.map((f) =>
            f.id === 'custom' ? (
              <option key={f.id} value={f.id} disabled={!customFontName}>
                {customFontName ? `Custom: ${customFontName}` : 'Custom font (load a file first)'}
              </option>
            ) : (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ),
          )}
        </select>
        <div className="font-load">
          <button type="button" onClick={() => fontInputRef.current?.click()} disabled={fontLoading}>
            {fontLoading ? 'Loading...' : 'Load font file'}
          </button>
          <span className="hint">For example TH Sarabun New. Pick the regular file, and the bold file too if you have it.</span>
        </div>
        <input
          ref={fontInputRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          multiple
          hidden
          data-testid="font-input"
          onChange={(e) => void onFontFiles(e.target.files)}
        />
        {fontError && <p className="message message-warn">{fontError}</p>}
        {font === 'custom' && (
          <p className="hint">The font file stays on this computer. Load it again after reloading the page.</p>
        )}
      </div>

      <div className="field-row">
        <NumberField
          label="Size"
          unit="pt"
          value={sizePt}
          min={6}
          max={300}
          step={1}
          onChange={(v) => setLayer({ sizePt: v })}
          testId="font-size"
        />
        <div className="colour-field">
          <label className="number-label" htmlFor="colour-text">
            Colour
          </label>
          <span className="colour-inputs">
            <input
              type="color"
              value={color}
              onChange={(e) => setLayer({ color: e.target.value })}
              aria-label="Pick colour"
            />
            <input
              id="colour-text"
              type="text"
              className="hex"
              value={colourDraft ?? color}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                const value = e.target.value.trim()
                setColourDraft(value)
                if (HEX_COLOUR.test(value)) setLayer({ color: value.toLowerCase() })
              }}
              onBlur={() => setColourDraft(null)}
            />
          </span>
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={bold} onChange={(e) => setLayer({ bold: e.target.checked })} />
        Bold
      </label>

      <div className="field shrink">
        <div className="field-row">
          <NumberField
            label="Max width"
            unit="mm"
            value={maxWidthMm}
            min={10}
            max={PAGE_W_MM}
            step={5}
            onChange={(v) => setLayer({ maxWidthMm: v })}
            testId="max-width"
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoShrink}
              onChange={(e) => setLayer({ autoShrink: e.target.checked })}
              data-testid="auto-shrink"
            />
            Shrink long names to fit
          </label>
        </div>

        <ul className="messages">
          {summary && autoShrink && summary.shrunkCount === 0 && (
            <li className="message message-ok">All names fit at {sizePt} pt.</li>
          )}
          {summary && autoShrink && summary.shrunkCount > 0 && (
            <li
              className={`message ${summary.smallestPt < sizePt * HEAVY_SHRINK ? 'message-warn' : 'message-info'}`}
              data-testid="shrink-summary"
            >
              {summary.shrunkCount} name{summary.shrunkCount === 1 ? '' : 's'} shrunk to fit. Smallest is{' '}
              {summary.smallestPt.toFixed(1)} pt (row {summary.smallestRow}).
              {summary.smallestPt < sizePt * HEAVY_SHRINK && ' That is much smaller than the rest. Try a smaller size or a wider max width.'}
            </li>
          )}
          {!autoShrink && (
            <li className="message message-info">Automatic shrink is off. Long names may run past the edge.</li>
          )}
          {autoShrink && maxReachesPastSafe && (
            <li className="message message-warn">
              At this position the max width reaches past the safe area, so the longest names may be cut off when
              printed.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
})
