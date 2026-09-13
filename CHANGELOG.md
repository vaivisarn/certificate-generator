# Changelog

All notable changes to this project are listed here. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

## 0.1.0 (2026-09-13)

First release. Issue A4 landscape certificates in bulk, fully in the browser.

### Background

- Drop or pick a PNG, JPG or single page PDF.
- Checks the A4 landscape ratio (1.5 percent tolerance) and print resolution, explains the 16:9 PowerPoint case, and offers Fit or Fill when the shape does not match.
- Rotated phone photos (EXIF) and unusual files are redrawn upright before they go into the PDF.

### Names

- Paste from Excel: first column only, quoted cells with line breaks, blank rows dropped, spaces tidied.
- Name count, duplicate flags, warning above 500, editable table with row numbers, delete and add rows.
- Names are never saved, not in the browser and not in templates.

### Preview and placement

- Live A4 preview in millimetres with the name centred on its anchor and a 10 mm safe area guide.
- Previous and next name, jump to the longest name.
- Drag the name, arrow keys (Shift for 5 mm), move buttons with 0.5, 1 and 5 mm steps, centre buttons, X and Y in mm.
- Warnings when the name crosses the safe area or the page edge.

### Style

- Fonts bundled: Sarabun, Kanit, Inter (Thai in Inter falls back to Sarabun).
- Load a custom font file, for example TH Sarabun New, regular and bold. The file stays in the browser.
- Size in pt, colour, bold, maximum width with automatic shrink for long names, and a summary of how many names shrink.

### Export

- One combined PDF, a ZIP of one PDF per person (`001_Name.pdf`), a ZIP of 300 DPI PNGs, or a single PNG of the name in the preview.
- Progress bar, Cancel, and a size estimate for large PNG runs.
- PDF pages are exactly A4 landscape (841.89 x 595.28 pt) with no margins. The background is embedded once and reused on every page.
- Names are placed as 600 DPI images, so Thai vowels and tone marks print exactly as previewed. The name is not selectable text in the PDF.
- 500 names export to one PDF in about 10 to 30 seconds.

### Templates

- Save and load the layout as a JSON template (position and style only). Bad or older files load with defaults for anything missing.
- The last layout is remembered in the browser. Reset layout returns to the defaults.

### Project

- Vite, React and TypeScript. Deployed to GitHub Pages by GitHub Actions on every push to `main`.
- Unit tests with Vitest and end to end tests with Playwright.
- Generic sample backgrounds in `samples/`.
