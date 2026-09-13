import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Background } from '../lib/background'
import { drawBackground } from '../lib/drawPage'
import { loadFont } from '../lib/fonts'
import { DEFAULT_ANCHOR, PAGE_H_MM, PAGE_W_MM, SAFE_MARGIN_MM, type BackgroundFit } from '../lib/geometry'
import { cleanName } from '../lib/parseNames'
import {
  clampAnchor,
  directionFromKey,
  insidePage,
  insideSafeArea,
  LARGE_STEP_MM,
  nudge,
  STEP_SIZES_MM,
  type Anchor,
  type Direction,
} from '../lib/placement'
import { drawName, layoutName } from '../lib/renderName'
import type { TextLayer, UpdateState } from '../state/certificate'
import { NumberField } from './NumberField'

const SAMPLE_NAME = 'Participant Name'
/** Extra grab margin around the name for dragging, in mm. */
const GRAB_PAD_MM = 3

interface Props {
  background: Background | null
  backgroundFit: BackgroundFit
  names: string[]
  nameLayer: TextLayer
  customFontName: string | null
  showGuides: boolean
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

interface Drag {
  pointerId: number
  startX: number
  startY: number
  startAnchor: Anchor
  mmPerPx: number
}

export const PreviewPanel = memo(function PreviewPanel({
  background,
  backgroundFit,
  names,
  nameLayer,
  customFontName,
  showGuides,
  update,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const nameCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [cssWidth, setCssWidth] = useState(0)
  const [position, setPosition] = useState(0)
  const [fontVersion, setFontVersion] = useState(0)
  const [stepMm, setStepMm] = useState<number>(1)
  const [hoverName, setHoverName] = useState(false)
  const [dragging, setDragging] = useState(false)

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

  // Cheap to measure one name, so it runs every render. A font finishing
  // loading bumps fontVersion, which re-renders and re-measures.
  const layout = layoutName(currentText, nameLayer)

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
  }, [nameLayer.font, nameLayer.bold, currentText, customFontName])

  useEffect(() => {
    const canvas = nameCanvasRef.current
    if (!canvas || cssWidth === 0) return
    const scale = prepareCanvas(canvas, cssWidth)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawName(ctx, currentText, nameLayer, scale)
  }, [currentText, nameLayer, cssWidth, fontVersion])

  function setAnchor(anchor: Anchor) {
    update({ nameLayer: { ...nameLayer, anchor: clampAnchor(anchor) } })
  }

  function move(direction: Direction, step = stepMm) {
    setAnchor(nudge(nameLayer.anchor, direction, step))
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.closest('input, select, textarea')) return
    const direction = directionFromKey(e.key)
    if (!direction) return
    e.preventDefault()
    move(direction, e.shiftKey ? LARGE_STEP_MM : stepMm)
  }

  function pointerMm(e: PointerEvent): { x: number; y: number; mmPerPx: number } {
    const rect = e.currentTarget.getBoundingClientRect()
    const mmPerPx = PAGE_W_MM / rect.width
    return { x: (e.clientX - rect.left) * mmPerPx, y: (e.clientY - rect.top) * mmPerPx, mmPerPx }
  }

  function overName(x: number, y: number): boolean {
    const { box } = layout
    return (
      x >= box.left - GRAB_PAD_MM &&
      x <= box.right + GRAB_PAD_MM &&
      y >= box.top - GRAB_PAD_MM &&
      y <= box.bottom + GRAB_PAD_MM
    )
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    stageRef.current?.focus()
    const p = pointerMm(e)
    if (!overName(p.x, p.y)) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startAnchor: nameLayer.anchor,
      mmPerPx: p.mmPerPx,
    }
    setDragging(true)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) {
      const p = pointerMm(e)
      setHoverName(overName(p.x, p.y))
      return
    }
    setAnchor({
      xMm: drag.startAnchor.xMm + (e.clientX - drag.startX) * drag.mmPerPx,
      yMm: drag.startAnchor.yMm + (e.clientY - drag.startY) * drag.mmPerPx,
    })
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== e.pointerId) return
    dragRef.current = null
    setDragging(false)
  }

  async function jumpToLongest() {
    if (rows.length === 0) return
    await loadFont(nameLayer.font, nameLayer.bold, rows.map((r) => r.text).join(''))
    let longest = 0
    let longestWidth = -1
    rows.forEach((r, i) => {
      const width = layoutName(r.text, nameLayer).naturalWidthMm
      if (width > longestWidth) {
        longest = i
        longestWidth = width
      }
    })
    setPosition(longest)
  }

  const { xMm, yMm } = nameLayer.anchor
  const { box } = layout
  const cross = 4
  const halfMax = nameLayer.maxWidthMm / 2

  const warnings: { level: 'info' | 'warn'; text: string }[] = []
  if (!insidePage(box)) {
    warnings.push({ level: 'warn', text: 'This name runs past the page edge and will be cut off.' })
  } else if (!insideSafeArea(box)) {
    warnings.push({
      level: 'warn',
      text: `This name is within ${SAFE_MARGIN_MM} mm of the edge. Most office printers cannot print there.`,
    })
  }
  if (layout.shrunk) {
    warnings.push({
      level: 'info',
      text: `This name is shrunk to ${layout.sizePt.toFixed(1)} pt to fit the ${nameLayer.maxWidthMm} mm maximum width.`,
    })
  }

  return (
    <div className="preview" onKeyDown={onKeyDown}>
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

      <div
        className={`preview-stage${hoverName || dragging ? ' over-name' : ''}${dragging ? ' is-dragging' : ''}`}
        ref={stageRef}
        tabIndex={0}
        aria-label="Certificate preview. Drag the name, or use the arrow keys to move it."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHoverName(false)}
      >
        <canvas ref={bgCanvasRef} className="preview-canvas" />
        <canvas ref={nameCanvasRef} className="preview-canvas" data-testid="preview-name-canvas" />
        <svg
          className="preview-overlay"
          viewBox={`0 0 ${PAGE_W_MM} ${PAGE_H_MM}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {showGuides && (
            <>
              <rect
                className="guide-safe"
                x={SAFE_MARGIN_MM}
                y={SAFE_MARGIN_MM}
                width={PAGE_W_MM - 2 * SAFE_MARGIN_MM}
                height={PAGE_H_MM - 2 * SAFE_MARGIN_MM}
              />
              {nameLayer.autoShrink && (
                <g className="guide-maxwidth">
                  <line x1={xMm - halfMax} y1={yMm - 8} x2={xMm - halfMax} y2={yMm + 8} />
                  <line x1={xMm + halfMax} y1={yMm - 8} x2={xMm + halfMax} y2={yMm + 8} />
                </g>
              )}
              <g className="guide-anchor">
                <line x1={xMm - cross} y1={yMm} x2={xMm + cross} y2={yMm} />
                <line x1={xMm} y1={yMm - cross} x2={xMm} y2={yMm + cross} />
              </g>
            </>
          )}
          {(hoverName || dragging) && (
            <rect
              className="guide-namebox"
              x={box.left - 1}
              y={box.top - 1}
              width={box.right - box.left + 2}
              height={box.bottom - box.top + 2}
            />
          )}
        </svg>
        {!background && <div className="preview-empty">No background yet</div>}
      </div>

      {warnings.length > 0 && (
        <ul className="messages">
          {warnings.map((w) => (
            <li key={w.text} className={`message message-${w.level}`}>
              {w.text}
            </li>
          ))}
        </ul>
      )}

      <div className="placement">
        <div className="placement-row">
          <div className="dpad" role="group" aria-label="Move the name">
            <button type="button" className="dpad-up" onClick={() => move('up')} aria-label={`Move up ${stepMm} mm`}>
              ↑
            </button>
            <button type="button" className="dpad-left" onClick={() => move('left')} aria-label={`Move left ${stepMm} mm`}>
              ←
            </button>
            <button type="button" className="dpad-right" onClick={() => move('right')} aria-label={`Move right ${stepMm} mm`}>
              →
            </button>
            <button type="button" className="dpad-down" onClick={() => move('down')} aria-label={`Move down ${stepMm} mm`}>
              ↓
            </button>
          </div>

          <div className="placement-fields">
            <div className="segmented" role="radiogroup" aria-label="Step size">
              <span className="number-label">Step</span>
              {STEP_SIZES_MM.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={stepMm === s}
                  className={stepMm === s ? 'is-active' : undefined}
                  onClick={() => setStepMm(s)}
                >
                  {s} mm
                </button>
              ))}
            </div>
            <div className="field-row">
              <NumberField
                label="X"
                unit="mm"
                value={xMm}
                min={0}
                max={PAGE_W_MM}
                step={0.5}
                onChange={(v) => setAnchor({ xMm: v, yMm })}
                testId="anchor-x"
              />
              <NumberField
                label="Y"
                unit="mm"
                value={yMm}
                min={0}
                max={PAGE_H_MM}
                step={0.5}
                onChange={(v) => setAnchor({ xMm, yMm: v })}
                testId="anchor-y"
              />
            </div>
            <div className="button-row">
              <button type="button" onClick={() => setAnchor({ xMm: DEFAULT_ANCHOR.xMm, yMm })}>
                Centre across
              </button>
              <button type="button" onClick={() => setAnchor({ xMm, yMm: DEFAULT_ANCHOR.yMm })}>
                Centre top to bottom
              </button>
            </div>
          </div>
        </div>

        <div className="preview-footer">
          <label className="checkbox">
            <input type="checkbox" checked={showGuides} onChange={(e) => update({ showGuides: e.target.checked })} />
            Show guides (safe area {SAFE_MARGIN_MM} mm, max width)
          </label>
          <span className="muted">
            Drag the name, or click the preview and use the arrow keys. Shift and an arrow moves {LARGE_STEP_MM} mm.
          </span>
        </div>
      </div>
    </div>
  )
})
