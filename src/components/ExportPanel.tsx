import { memo, useEffect, useRef, useState } from 'react'
import type { Background } from '../lib/background'
import {
  downloadBlob,
  formatBytes,
  isCancelled,
  type ExportJob,
  type ExportProgress,
  type ExportResult,
} from '../lib/exportJob'
import type { BackgroundFit } from '../lib/geometry'
import { cleanName } from '../lib/parseNames'
import type { TextLayer } from '../state/certificate'
import { NAMES_SOFT_LIMIT } from './NamesPanel'

type ExportKind = 'pdf' | 'pdf-zip' | 'png-zip' | 'png-single'

/** Rough size of one 300 DPI certificate PNG, for the size warning. */
const PNG_MB_LOW = 2
const PNG_MB_HIGH = 6

interface Props {
  background: Background | null
  backgroundFit: BackgroundFit
  names: string[]
  nameLayer: TextLayer
  previewIndex: number
}

interface Outcome {
  level: 'ok' | 'info' | 'warn'
  text: string
}

/** Rough total, e.g. "1 to 3 GB" for 500 PNGs. */
function sizeRange(count: number): string {
  const low = count * PNG_MB_LOW
  const high = count * PNG_MB_HIGH
  if (high < 1000) return `${Math.round(low)} to ${Math.round(high)} MB`
  const gb = (mb: number) => String(Number((mb / 1000).toFixed(1)))
  return `${gb(low)} to ${gb(high)} GB`
}

export const ExportPanel = memo(function ExportPanel({ background, backgroundFit, names, nameLayer, previewIndex }: Props) {
  const [running, setRunning] = useState<ExportKind | null>(null)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const exportNames = names.map(cleanName).filter(Boolean)
  const count = exportNames.length
  const current = Math.min(previewIndex, Math.max(count - 1, 0))

  // Warn before closing the tab in the middle of an export.
  useEffect(() => {
    if (!running) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [running])

  async function run(kind: ExportKind) {
    if (running || count === 0) return
    const job: ExportJob = { background, backgroundFit, layer: nameLayer, names: exportNames }
    const controller = new AbortController()
    controllerRef.current = controller
    setRunning(kind)
    setOutcome(null)
    setProgress({ label: 'Preparing', done: 0, total: kind === 'png-single' ? 1 : count })
    const started = performance.now()

    try {
      // Export code loads on first use, which keeps the page quick to open.
      let result: ExportResult
      if (kind === 'pdf' || kind === 'pdf-zip') {
        const pdf = await import('../lib/exportPdf')
        result = await (kind === 'pdf' ? pdf.exportCombinedPdf : pdf.exportPdfZip)(job, setProgress, controller.signal)
      } else {
        const png = await import('../lib/exportPng')
        result =
          kind === 'png-zip'
            ? await png.exportPngZip(job, setProgress, controller.signal)
            : await png.exportSinglePng(job, current)
      }
      downloadBlob(result.blob, result.fileName)
      const seconds = Math.max(1, Math.round((performance.now() - started) / 1000))
      setOutcome({
        level: 'ok',
        text: `Saved ${result.fileName} (${formatBytes(result.blob.size)}) in ${seconds} s. Check your Downloads folder.`,
      })
    } catch (err) {
      if (isCancelled(err)) {
        setOutcome({ level: 'info', text: 'Export cancelled. Nothing was saved.' })
      } else {
        console.error(err)
        setOutcome({
          level: 'warn',
          text: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    } finally {
      controllerRef.current = null
      setRunning(null)
      setProgress(null)
    }
  }

  const disabled = running !== null || count === 0
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="export">
      <h3>Export</h3>
      <p className="muted export-summary" data-testid="export-summary">
        {count === 0
          ? 'Paste names first.'
          : `${count} certificate${count === 1 ? '' : 's'}, A4 landscape 297 x 210 mm.`}
      </p>

      <ul className="messages">
        {count > 0 && !background && (
          <li className="message message-warn">No background loaded. Certificates will be plain white.</li>
        )}
        {count > NAMES_SOFT_LIMIT && (
          <li className="message message-info">Large batch. Keep this tab open until the export finishes.</li>
        )}
      </ul>

      <div className="export-options">
        <ExportButton
          primary
          title="Combined PDF"
          description="One file, one page per name. Best for printing."
          onClick={() => void run('pdf')}
          disabled={disabled}
          busy={running === 'pdf'}
        />
        <ExportButton
          title="PDF per person (ZIP)"
          description="A separate PDF for each name, such as 001_Name.pdf."
          onClick={() => void run('pdf-zip')}
          disabled={disabled}
          busy={running === 'pdf-zip'}
        />
        <ExportButton
          title="PNG per person (ZIP)"
          description={`300 DPI images for email. ${count > 0 ? `About ${sizeRange(count)} in total.` : ''}`}
          onClick={() => void run('png-zip')}
          disabled={disabled}
          busy={running === 'png-zip'}
        />
        <ExportButton
          title="PNG of the name in the preview"
          description={count > 0 ? `One 300 DPI image for ${exportNames[current]}.` : 'One 300 DPI image.'}
          onClick={() => void run('png-single')}
          disabled={disabled}
          busy={running === 'png-single'}
        />
      </div>

      {count >= 100 && (
        <p className="hint">
          {count} PNG files can reach {sizeRange(count)}. Use PDF when you can, it is much smaller.
        </p>
      )}

      {progress && (
        <div className="progress" role="status" aria-live="polite">
          <div className="progress-head">
            <span>
              {progress.label}
              {progress.total > 1 && ` ${progress.done} of ${progress.total}`}
            </span>
            <button type="button" onClick={() => controllerRef.current?.abort()} data-testid="export-cancel">
              Cancel
            </button>
          </div>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {outcome && (
        <p className={`message message-${outcome.level}`} data-testid="export-outcome">
          {outcome.text}
        </p>
      )}
    </div>
  )
})

interface ExportButtonProps {
  title: string
  description: string
  onClick: () => void
  disabled: boolean
  busy: boolean
  primary?: boolean
}

function ExportButton({ title, description, onClick, disabled, busy, primary }: ExportButtonProps) {
  return (
    <button
      type="button"
      className={`export-button${primary ? ' primary' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
    >
      <strong>{busy ? 'Working...' : title}</strong>
      <span>{description}</span>
    </button>
  )
}
