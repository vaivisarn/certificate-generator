// Parse names pasted from Excel.
//
// Excel copies cells as tab separated text, one row per line. A cell that
// contains a tab, a line break or a double quote arrives wrapped in double
// quotes, with inner quotes doubled: "Somchai ""Tom"" Jaidee".
// Only the first column is used. Other columns are skipped.

/** Tidy one name: NFC, no zero width characters, single spaces, trimmed. */
export function cleanName(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\u200B|\u200C|\u200D|\u2060|\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNames(text: string): string[] {
  return firstColumn(text)
    .map(cleanName)
    .filter((name) => name.length > 0)
}

interface Cell {
  value: string
  /** Index just after the cell. */
  end: number
}

function isCellEnd(ch: string | undefined): boolean {
  return ch === undefined || ch === '\t' || ch === '\r' || ch === '\n'
}

/**
 * A quoted cell: starts with a quote and closes with a quote that is followed
 * by a tab, a line break or the end of the text. Returns null when the quotes
 * do not form a proper cell, so the text is read as plain instead.
 */
function readQuoted(text: string, start: number): Cell | null {
  let value = ''
  let i = start + 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"') {
      if (text[i + 1] === '"') {
        value += '"'
        i += 2
        continue
      }
      return isCellEnd(text[i + 1]) ? { value, end: i + 1 } : null
    }
    value += ch
    i++
  }
  return null
}

function readPlain(text: string, start: number): Cell {
  let i = start
  while (!isCellEnd(text[i])) i++
  return { value: text.slice(start, i), end: i }
}

function readCell(text: string, start: number): Cell {
  return (text[start] === '"' && readQuoted(text, start)) || readPlain(text, start)
}

function firstColumn(text: string): string[] {
  const rows: string[] = []
  let i = 0
  while (i < text.length) {
    const first = readCell(text, i)
    rows.push(first.value)
    i = first.end

    // Skip the other columns. They may hold quoted line breaks too.
    while (text[i] === '\t') i = readCell(text, i + 1).end

    if (text[i] === '\r') i++
    if (text[i] === '\n') i++
  }
  return rows
}

/** Key used to spot duplicates: case and spacing do not count. */
export function duplicateKey(name: string): string {
  return cleanName(name).toLocaleLowerCase()
}

/**
 * For each row, the indexes of the other rows with the same name.
 * Unique and empty rows get an empty list.
 */
export function findDuplicates(names: string[]): number[][] {
  const byKey = new Map<string, number[]>()
  names.forEach((name, index) => {
    const key = duplicateKey(name)
    if (!key) return
    const list = byKey.get(key)
    if (list) list.push(index)
    else byKey.set(key, [index])
  })

  return names.map((name, index) => {
    const list = byKey.get(duplicateKey(name))
    return list && list.length > 1 ? list.filter((i) => i !== index) : []
  })
}

/** Number of extra copies, e.g. the same name three times counts as 2. */
export function countDuplicates(duplicates: number[][]): number {
  return duplicates.reduce((sum, others, index) => sum + (others.some((i) => i < index) ? 1 : 0), 0)
}
