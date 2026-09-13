import { useEffect, useRef, useState, type DragEvent } from 'react'
import { BackgroundError, loadBackground } from '../lib/background'
import { checkBackground } from '../lib/backgroundChecks'
import { drawBackground } from '../lib/drawPage'
import { checkRatio, PAGE_H_MM, PAGE_W_MM, type BackgroundFit } from '../lib/geometry'
import type { CertificateState, UpdateState } from '../state/certificate'

const ACCEPT = '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf'
const THUMB_WIDTH_PX = 300

interface Props {
  state: CertificateState
  update: UpdateState
}

export function BackgroundPanel({ state, update }: Props) {
  const { background, backgroundFit } = state
  const inputRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      update({ background: await loadBackground(file) })
    } catch (err) {
      setError(err instanceof BackgroundError ? err.message : `Could not load "${file.name}".`)
    } finally {
      setLoading(false)
      // Allow picking the same file again after an error.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files[0])
  }

  useEffect(() => {
    const canvas = thumbRef.current
    if (!canvas || !background) return
    const dpr = window.devicePixelRatio || 1
    const scale = (THUMB_WIDTH_PX / PAGE_W_MM) * dpr
    canvas.width = Math.round(PAGE_W_MM * scale)
    canvas.height = Math.round(PAGE_H_MM * scale)
    const ctx = canvas.getContext('2d')
    if (ctx) drawBackground(ctx, background, backgroundFit, scale)
  }, [background, backgroundFit])

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      hidden
      data-testid="background-input"
      onChange={(e) => void handleFile(e.target.files?.[0])}
    />
  )

  if (!background) {
    return (
      <>
        <div
          className={`dropzone${dragOver ? ' is-over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {loading ? (
            <strong>Loading...</strong>
          ) : (
            <>
              <strong>Drop a background here</strong>
              <span>or click to choose a file</span>
              <span className="hint">PNG, JPG or single page PDF. Best at A4 landscape, 3508 x 2480 px.</span>
            </>
          )}
        </div>
        {input}
        {error && <p className="message message-warn">{error}</p>}
      </>
    )
  }

  const matches = checkRatio(background.width, background.height).matches
  const messages = checkBackground(background, backgroundFit)
  const sizeText =
    background.kind === 'pdf'
      ? `PDF, ${background.pageCount} page${background.pageCount > 1 ? 's' : ''}`
      : `${background.kind.toUpperCase()}, ${background.width} x ${background.height} px`

  return (
    <div
      className={`background-loaded${dragOver ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <canvas ref={thumbRef} className="thumb" style={{ width: THUMB_WIDTH_PX }} aria-label="Background thumbnail" />

      <div className="file-row">
        <div className="file-meta">
          <span className="file-name" title={background.fileName}>
            {background.fileName}
          </span>
          <span className="muted">{sizeText}</span>
        </div>
        <div className="button-row">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? 'Loading...' : 'Replace'}
          </button>
          <button type="button" onClick={() => update({ background: null })} disabled={loading}>
            Remove
          </button>
        </div>
      </div>
      {input}

      <ul className="messages">
        {messages.map((m) => (
          <li key={m.text} className={`message message-${m.level}`}>
            {m.text}
          </li>
        ))}
      </ul>

      {!matches && (
        <fieldset className="fit-options">
          <legend>How to place it on A4</legend>
          <FitOption
            value="fit"
            current={backgroundFit}
            onChange={(fit) => update({ backgroundFit: fit })}
            label="Fit"
            description="Whole image visible, blank margins"
          />
          <FitOption
            value="fill"
            current={backgroundFit}
            onChange={(fit) => update({ backgroundFit: fit })}
            label="Fill"
            description="Covers the page, edges cropped"
          />
        </fieldset>
      )}

      {error && <p className="message message-warn">{error}</p>}
    </div>
  )
}

interface FitOptionProps {
  value: BackgroundFit
  current: BackgroundFit
  onChange: (fit: BackgroundFit) => void
  label: string
  description: string
}

function FitOption({ value, current, onChange, label, description }: FitOptionProps) {
  return (
    <label className="radio">
      <input type="radio" name="background-fit" checked={current === value} onChange={() => onChange(value)} />
      <span>
        <strong>{label}</strong> <span className="muted">{description}</span>
      </span>
    </label>
  )
}
