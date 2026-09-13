import { memo, useRef } from 'react'
import { downloadBlob } from '../lib/exportJob'
import type { UpdateState } from '../state/certificate'
import {
  defaultLayout,
  parseTemplateText,
  TemplateError,
  templateFileName,
  toTemplate,
  type TemplateSource,
} from '../state/template'

export interface Notice {
  level: 'ok' | 'info' | 'warn'
  text: string
}

interface Props extends TemplateSource {
  update: UpdateState
  onNotice: (notice: Notice | null) => void
}

export const TemplateControls = memo(function TemplateControls({
  background,
  backgroundFit,
  nameLayer,
  customFontName,
  update,
  onNotice,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function save() {
    const template = toTemplate({ background, backgroundFit, nameLayer, customFontName })
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const fileName = templateFileName()
    downloadBlob(blob, fileName)
    onNotice({ level: 'ok', text: `Saved ${fileName}. It holds position and style only, no names and no background.` })
  }

  async function load(file: File | undefined) {
    if (!file) return
    try {
      const parsed = parseTemplateText(await file.text(), customFontName)
      update({ backgroundFit: parsed.backgroundFit, nameLayer: parsed.nameLayer })
      const parts = [`Loaded ${file.name}.`]
      if (parsed.backgroundFileName && parsed.backgroundFileName !== background?.fileName) {
        parts.push(`It was made for the background "${parsed.backgroundFileName}". Load that file in Background if it is not loaded.`)
      }
      parts.push(...parsed.notes)
      onNotice({ level: parsed.notes.length > 0 ? 'info' : 'ok', text: parts.join(' ') })
    } catch (err) {
      onNotice({
        level: 'warn',
        text: err instanceof TemplateError ? `${file.name}: ${err.message}` : `Could not read ${file.name}.`,
      })
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function reset() {
    if (!window.confirm('Reset the position and style to the defaults? Names and background stay.')) return
    update(defaultLayout())
    onNotice({ level: 'info', text: 'Position and style reset to the defaults.' })
  }

  return (
    <div className="header-actions">
      <button type="button" onClick={save} title="Download the position and style as a JSON file">
        Save template
      </button>
      <button type="button" onClick={() => inputRef.current?.click()} title="Open a template JSON file">
        Load template
      </button>
      <button type="button" className="link" onClick={reset}>
        Reset layout
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="template-input"
        onChange={(e) => void load(e.target.files?.[0])}
      />
    </div>
  )
})

