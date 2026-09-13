import { memo, useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react'
import { cleanName, countDuplicates, findDuplicates, parseNames } from '../lib/parseNames'
import type { UpdateState } from '../state/certificate'

/** Above this the app still works, but exports get slow and large. */
export const NAMES_SOFT_LIMIT = 500

interface Props {
  names: string[]
  update: UpdateState
}

export const NamesPanel = memo(NamesPanelView)

function NamesPanelView({ names, update }: Props) {
  const [draft, setDraft] = useState('')
  const pendingFocusRow = useRef<number | null>(null)
  const tableRef = useRef<HTMLTableSectionElement>(null)

  const duplicates = useMemo(() => findDuplicates(names), [names])
  const duplicateCount = useMemo(() => countDuplicates(duplicates), [duplicates])
  const emptyCount = names.filter((n) => !cleanName(n)).length
  const count = names.length - emptyCount
  const draftCount = useMemo(() => parseNames(draft).length, [draft])

  // Focus a row added with "Add row" once it exists in the table.
  useEffect(() => {
    if (pendingFocusRow.current === null) return
    tableRef.current?.querySelectorAll('input')[pendingFocusRow.current]?.focus()
    pendingFocusRow.current = null
  })

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    // First paste into an empty list loads straight away. Later pastes wait
    // for Replace or Add so an existing list is not lost by accident.
    if (names.length > 0 || draft.trim()) return
    const parsed = parseNames(e.clipboardData.getData('text/plain'))
    if (parsed.length === 0) return
    e.preventDefault()
    update({ names: parsed })
  }

  function applyDraft(mode: 'replace' | 'add') {
    const parsed = parseNames(draft)
    update({ names: mode === 'replace' ? parsed : [...names, ...parsed] })
    setDraft('')
  }

  function editRow(index: number, value: string) {
    update({ names: names.map((n, i) => (i === index ? value : n)) })
  }

  function tidyRow(index: number) {
    const tidy = cleanName(names[index])
    if (tidy !== names[index]) editRow(index, tidy)
  }

  function deleteRow(index: number) {
    update({ names: names.filter((_, i) => i !== index) })
  }

  function addRow() {
    pendingFocusRow.current = names.length
    update({ names: [...names, ''] })
  }

  return (
    <div className="names">
      <label className="field-label" htmlFor="names-paste">
        Paste names from Excel
      </label>
      <textarea
        id="names-paste"
        className="paste-box"
        rows={names.length > 0 ? 3 : 6}
        placeholder={'Copy the name column in Excel, then paste here.\nOne name per row. Extra columns are ignored.'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPaste={onPaste}
        spellCheck={false}
      />
      {draft.trim() && (
        <div className="draft-row">
          <span className="muted">
            {draftCount} name{draftCount === 1 ? '' : 's'} found
          </span>
          <div className="button-row">
            {names.length > 0 && (
              <button type="button" onClick={() => applyDraft('add')} disabled={draftCount === 0}>
                Add to list
              </button>
            )}
            <button type="button" className="primary" onClick={() => applyDraft('replace')} disabled={draftCount === 0}>
              {names.length > 0 ? 'Replace list' : 'Use these names'}
            </button>
          </div>
        </div>
      )}

      {names.length > 0 && (
        <>
          <div className="names-summary">
            <strong data-testid="names-count">
              {count} name{count === 1 ? '' : 's'}
            </strong>
            <button type="button" className="link" onClick={() => update({ names: [] })}>
              Clear all
            </button>
          </div>

          <ul className="messages">
            {count > NAMES_SOFT_LIMIT && (
              <li className="message message-warn">
                More than {NAMES_SOFT_LIMIT} names. Export still works but takes longer and makes larger files.
              </li>
            )}
            {duplicateCount > 0 && (
              <li className="message message-warn">
                {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} flagged below. Remove them if they are
                mistakes.
              </li>
            )}
            {emptyCount > 0 && (
              <li className="message message-warn">
                {emptyCount} empty row{emptyCount === 1 ? '' : 's'}. Empty rows are skipped on export.
              </li>
            )}
          </ul>

          <div className="names-table-wrap">
            <table className="names-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Name</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody ref={tableRef}>
                {names.map((name, index) => {
                  const others = duplicates[index]
                  const empty = !cleanName(name)
                  return (
                    <tr key={index} className={others.length || empty ? 'row-flagged' : undefined}>
                      <td className="row-number">{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          value={name}
                          aria-label={`Name in row ${index + 1}`}
                          onChange={(e) => editRow(index, e.target.value)}
                          onBlur={() => tidyRow(index)}
                          spellCheck={false}
                        />
                        {others.length > 0 && (
                          <span className="row-flag">
                            Same as row {others.map((i) => i + 1).join(', ')}
                          </span>
                        )}
                        {empty && <span className="row-flag">Empty</span>}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon"
                          onClick={() => deleteRow(index)}
                          aria-label={`Delete row ${index + 1}`}
                          title="Delete row"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="add-row" onClick={addRow}>
            Add row
          </button>
        </>
      )}

      <p className="privacy-note">Names stay on this computer and are not saved. Reloading the page clears them.</p>
    </div>
  )
}
