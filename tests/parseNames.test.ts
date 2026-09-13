import { describe, expect, it } from 'vitest'
import { cleanName, countDuplicates, findDuplicates, parseNames } from '../src/lib/parseNames'

describe('parseNames', () => {
  it('splits lines and trims', () => {
    expect(parseNames('Alice Smith\n  Bob Lee  \nCarol Tan')).toEqual(['Alice Smith', 'Bob Lee', 'Carol Tan'])
  })

  it('handles Windows line endings and a trailing line break', () => {
    expect(parseNames('Alice\r\nBob\r\n')).toEqual(['Alice', 'Bob'])
  })

  it('drops blank and whitespace only rows', () => {
    expect(parseNames('Alice\n\n   \n\t\nBob\n\n')).toEqual(['Alice', 'Bob'])
  })

  it('takes the first tab separated column', () => {
    expect(parseNames('Alice\tSales\t2026\nBob\tHR')).toEqual(['Alice', 'Bob'])
  })

  it('reads a quoted cell with a line break inside as one name', () => {
    const pasted = '"Somchai\nJaidee"\tBangkok\r\nBob\tHR'
    expect(parseNames(pasted)).toEqual(['Somchai Jaidee', 'Bob'])
  })

  it('reads a quoted cell with a comma and doubled quotes', () => {
    expect(parseNames('"Lee, Anna"\n"Somchai ""Tom"" Jaidee"')).toEqual(['Lee, Anna', 'Somchai "Tom" Jaidee'])
  })

  it('skips quoted line breaks in later columns without creating rows', () => {
    const pasted = 'Alice\t"line one\nline two"\nBob\t"x"'
    expect(parseNames(pasted)).toEqual(['Alice', 'Bob'])
  })

  it('treats stray quotes as plain text', () => {
    expect(parseNames('"Tom" Jaidee\nBob')).toEqual(['"Tom" Jaidee', 'Bob'])
    expect(parseNames('"Unclosed\nBob')).toEqual(['"Unclosed', 'Bob'])
  })

  it('keeps an empty first column row out of the list', () => {
    expect(parseNames('\tSales\nBob\tHR')).toEqual(['Bob'])
  })

  it('keeps Thai names with stacked vowels and tone marks intact', () => {
    const thai = ['ปิ่นทิพย์', 'น้ำฝน', 'ผู้ใหญ่', 'กิ่งแก้ว', 'ธีร์ธวัช']
    expect(parseNames(thai.join('\r\n'))).toEqual(thai)
  })

  it('handles mixed Thai and English with a surname column', () => {
    expect(parseNames('นางสาวน้ำฝน ใจดี\tHR\nMr. John Smith\tIT')).toEqual(['นางสาวน้ำฝน ใจดี', 'Mr. John Smith'])
  })
})

describe('cleanName', () => {
  it('collapses spaces, including non breaking spaces from Excel', () => {
    expect(cleanName('  Anna\u00A0\u00A0 Lee ')).toBe('Anna Lee')
  })

  it('removes zero width characters', () => {
    expect(cleanName('\uFEFFกิ่ง\u200Bแก้ว')).toBe('กิ่งแก้ว')
  })

  it('normalises to NFC so the same name compares equal', () => {
    expect(cleanName('Jose\u0301')).toBe('Jos\u00E9')
  })
})

describe('findDuplicates', () => {
  it('flags every row of a repeated name', () => {
    const dups = findDuplicates(['Alice', 'Bob', 'alice ', 'Carol', 'ALICE'])
    expect(dups).toEqual([[2, 4], [], [0, 4], [], [0, 2]])
    expect(countDuplicates(dups)).toBe(2)
  })

  it('ignores empty rows', () => {
    const dups = findDuplicates(['', 'Bob', ' '])
    expect(dups).toEqual([[], [], []])
    expect(countDuplicates(dups)).toBe(0)
  })

  it('matches Thai names exactly', () => {
    expect(countDuplicates(findDuplicates(['น้ำฝน', 'น้ำฝน', 'นํ้าฝน']))).toBe(1)
  })
})
