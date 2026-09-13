import { useId, useState } from 'react'

interface Props {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  decimals?: number
  testId?: string
}

/**
 * Number input that lets the user type freely ("14." or an empty box) and
 * only commits a valid, clamped number. Shows outside changes, such as a drag,
 * while the box is not being edited.
 */
export function NumberField({ label, value, onChange, min, max, step = 1, unit, decimals = 1, testId }: Props) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(Number(value.toFixed(decimals)))

  function commit(text: string) {
    const parsed = Number.parseFloat(text)
    if (Number.isNaN(parsed)) return
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
    onChange(Number(clamped.toFixed(decimals)))
  }

  return (
    <label className="number-field" htmlFor={id}>
      <span className="number-label">{label}</span>
      <span className="number-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={shown}
          min={min}
          max={max}
          step={step}
          data-testid={testId}
          onChange={(e) => {
            setDraft(e.target.value)
            commit(e.target.value)
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setDraft(null)
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  )
}
