import { useEffect, useMemo, useRef, useState } from 'react'
import { drawBackground } from '../lib/drawPage'
import { loadFont } from '../lib/fonts'
import { PAGE_H_MM, PAGE_W_MM, SAFE_MARGIN_MM } from '../lib/geometry'
import { cleanName } from '../lib/parseNames'
import { drawName, measureNameMm } from '../lib/renderName'
import type { CertificateState, UpdateState } from '../state/certificate'

const SAMPLE_NAME = 'Participant Name'

interface Props {
  state: CertificateState
  update: UpdateState
}

/** Size a canvas to its CSS box at the screen's pixel density. Returns px per mm. */
function prepareCanvas(canvas: HTMLCanvasElement, cssWidth: number): number {
  const dpr = window.devicePixelRatio || 1
  const scale = (cssWidth / PAGE_W_MM) * dpr
  const w = Math.round(PAGE_W_MM * scale)
  const h = Math.round(PAGE_H_MM * scale)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  return scale
}

export function PreviewPanel({ state, update }: Props) {
  const { background, backgroundFit, names, nameLayer, showSafeArea } = state
  const stageRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const nameCanvasRef = useRef<HTMLCanvasElement>(null)
  const [cssWidth, setCssWidth] = useState(0)
  const [position, setPosition] = useState(0)
  const [fontVersion, setFontVersion] = useState(0)

  // Rows that have a name, with their row number in the names table.
  const rows = useMemo(
    () =>
      names
        .map((name, index) => ({ row: index + 1, text: cleanName(name) }))
        .filter((r) => r.text.length > 0),
    [names],
  )
  const current = Math.min(position, Math.max(rows.length - 1, 0))
  const currentText = rows[current]?.text ?? SAMPLE_NAME

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setCssWidth(entry.contentRect.width))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  // Background on its own canvas, so moving the name does not redraw a large image.
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas || cssWidth === 0) return
    const scale = prepareCanvas(canvas, cssWidth)
    const ctx = canvas.getContext('2d')
    if (ctx) drawBackground(ctx, background, backgroundFit, scale)
  }, [background, backgroundFit, cssWidth])

  useEffect(() => {
    let cancelled = false
    void loadFont(nameLayer.font, nameLayer.bold, currentText).then(() => {
      if (!cancelled) setFontVersion((v) => v + 1)
    })
    return () => {
      cancelled = true
    }
  }, [nameLayer.font, nameLayer.bold, currentText])

  useEffect(() => {
    const canvas = nameCanvasRef.current
    if (!canvas || cssWidth === 0) return
    const scale = prepareCanvas(canvas, cssWidth)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawName(ctx, currentText, nameLayer, scale)
  }, [currentText, nameLayer, cssWidth, fontVersion])

  async function jumpToLongest() {
    if (rows.length === 0) return
    await loadFont(nameLayer.font, nameLayer.bold, rows.map((r) => r.text).join(''))
    let longest = 0
    let longestWidth = -1
    rows.forEach((r, i) => {
      const width = measureNameMm(r.text, nameLayer)
      if (width > longestWidth) {
        longest = i
        longestWidth = width
      }
    })
    setPosition(longest)
  }

  const { xMm, yMm } = nameLayer.anchor
  const cross = 4

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <div className="button-row">
          <button type="button" onClick={() => setPosition(current - 1)} disabled={current <= 0} aria-label="Previous name">
            ‹ Prev
          </button>
          <button
            type="button"
            onClick={() => setPosition(current + 1)}
            disabled={current >= rows.length - 1}
            aria-label="Next name"
          >
            Next ›
          </button>
          <button type="button" onClick={() => void jumpToLongest()} disabled={rows.length < 2}>
            Longest name
          </button>
        </div>
        <span className="muted preview-position" data-testid="preview-position">
          {rows.length > 0
            ? `Name ${current + 1} of ${rows.length}, row ${rows[current].row}`
            : 'Sample name. Paste names to see them here.'}
        </span>
      </div>

      <div className="preview-stage" ref={stageRef}>
        <canvas ref={bgCanvasRef} className="preview-canvas" />
        <canvas ref={nameCanvasRef} className="preview-canvas" data-testid="preview-name-canvas" />
        <svg
          className="preview-overlay"
          viewBox={`0 0 ${PAGE_W_MM} ${PAGE_H_MM}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {showSafeArea && (
            <rect
              className="guide-safe"
              x={SAFE_MARGIN_MM}
              y={SAFE_MARGIN_MM}
              width={PAGE_W_MM - 2 * SAFE_MARGIN_MM}
              height={PAGE_H_MM - 2 * SAFE_MARGIN_MM}
            />
          )}
          <g className="guide-anchor">
            <line x1={xMm - cross} y1={yMm} x2={xMm + cross} y2={yMm} />
            <line x1={xMm} y1={yMm - cross} x2={xMm} y2={yMm + cross} />
          </g>
        </svg>
        {!background && <div className="preview-empty">No background yet</div>}
      </div>

      <div className="preview-footer">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showSafeArea}
            onChange={(e) => update({ showSafeArea: e.target.checked })}
          />
          Show safe area ({SAFE_MARGIN_MM} mm from the edge)
        </label>
        <span className="muted">
          Anchor X {xMm.toFixed(1)} mm, Y {yMm.toFixed(1)} mm
        </span>
      </div>
    </div>
  )
}
