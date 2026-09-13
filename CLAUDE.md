# CLAUDE.md

Project context for Claude Code. Read this first, every session.

## 1. What we are building

A browser only web app for TK's team to issue **A4 landscape certificates in bulk**.

Flow: upload a certificate background, paste participant names copied from Excel, position the name, export print ready files. Up to 500 certificates per run.

Everything runs client side. No server, no database, nothing uploaded. This is deliberate: participant names never leave the user's laptop (PDPA).

## 2. Locked decisions

| Item | Decision |
|---|---|
| Orientation | A4 landscape only, 297 x 210 mm |
| Text fields | Name only in v0.1 |
| Fonts | TH Sarabun New, Inter, Kanit |
| Background input | PNG, JPG, single page PDF |
| Exports | One combined PDF, ZIP of per person PDFs, PNG at 300 DPI (single or ZIP) |
| Main use of PNG | Emailing certificates |
| UI language | English |
| Stack | Vite + React + TypeScript |
| Repo | github.com/vaivisarn/certificate-generator, public |
| Host | GitHub Pages, deployed by GitHub Actions |
| Live URL | https://vaivisarn.github.io/certificate-generator/ |
| Local folder | /Users/tk/Desktop/81_App_Certificates (repo root) |

## 3. Non goals for v0.1

Do not build these. Keep the code open to them, but do not add them without asking.

- Login, server, database, certificate verification portal
- Portrait orientation
- Extra text fields (certificate number, date, organisation). Model the name as one "text layer" so a second layer is easy later.
- QR codes

## 4. Tech stack

- Vite, React, TypeScript
- `pdf-lib` for PDF output
- `pdfjs-dist` to render a single page PDF background into the preview
- `fflate` for ZIP files
- `@fontsource/inter`, `@fontsource/kanit`, plus a local TH Sarabun New woff2 in `public/fonts/`
  - Check the TH Sarabun New licence before committing the file. If unclear, ship `@fontsource/sarabun` as the substitute and let the user load a custom font file instead.
- `vitest` for unit tests, `@playwright/test` for end to end
- No UI kit. Plain CSS in a single stylesheet or CSS modules. Keep dependencies few.

## 5. Coordinate model (important)

- All geometry is in **millimetres**. Page is 297 x 210 mm.
- The name has an anchor point `{ xMm, yMm }` and is drawn **centred on that anchor**, so short and long names stay balanced.
- Default anchor: `x = 148.5`, `y = 105`.
- The preview converts mm to px with one scale factor. Never store pixel positions in state, never save pixel positions in a template file.
- A "safe area" guide sits 10 mm inside the page edge. Most office printers cannot print to the edge.

## 6. How export works

1. Embed the background **once** in the PDF (`embedJpg`, `embedPng`, or `embedPdf` for a PDF background), then draw that same object on every page. A 500 page PDF then stays small.
2. Draw the name as a **transparent PNG** rendered from an offscreen canvas at roughly 600 DPI, trimmed to the text bounds, placed at the anchor.
   Reason: the browser shapes Thai vowels and tone marks correctly. `pdf-lib` text drawing does not position Thai marks reliably. Trade off: the name is not selectable text in the PDF, which is fine for printing.
3. Page size exactly 841.89 x 595.28 pt (297 x 210 mm), no margins.
4. Per person PDFs: same method, one page each, zipped, named `001_Name.pdf`.
5. PNG export: render the page canvas at 300 DPI (3508 x 2480 px), single file or ZIP.
6. Long jobs run in batches with a progress bar and a cancel button. Keep the UI responsive (chunked async loop or a Web Worker). Warn the user that 500 PNGs can reach 1 to 3 GB.

## 7. Input rules

**Background**

- Accept PNG, JPG, single page PDF.
- Target ratio 297:210 (1.414). If the image is off by more than 1.5 percent, warn and offer: fit, fill (crop), replace.
- Effective resolution: warn below 150 DPI (width under 1754 px). Ideal is 300 DPI (3508 px).
- A 16:9 export from PowerPoint is the most common mistake. The warning should say so in plain words.

**Names**

- One paste box. Split on newlines, take the first tab separated column, trim whitespace, drop blank rows.
- Handle Excel's quoted cells (a cell containing a comma or newline arrives wrapped in double quotes).
- Show the count. Flag duplicates. Warn above 500 but do not block.
- Show an editable table with row numbers so the user can fix typos before export.

## 8. UI layout

Four panels, one shared state object:

1. **Background**: drop zone, ratio and resolution check, warnings
2. **Names**: paste box, count, duplicate flags, editable table
3. **Preview and placement**: live A4 preview, prev and next name, jump to longest name, safe area toggle
   - Move buttons up, down, left, right with step size 0.5, 1, 5 mm
   - Arrow keys move the name, shift plus arrow uses the large step
   - Buttons: centre across, centre top to bottom
   - Numeric X and Y in mm
   - Drag the name on the preview
4. **Style and export**: font, size in pt, colour, bold, maximum width with automatic shrink for long names; export buttons with progress

Also: save and load the layout as a JSON template file, and remember the last settings in `localStorage`.

## 9. Suggested file layout

```
src/
  App.tsx
  state/            certificate state, template save and load
  components/       BackgroundPanel, NamesPanel, PreviewPanel, StylePanel, ExportPanel
  lib/
    parseNames.ts   Excel paste parsing
    geometry.ts     mm to px, anchor maths, A4 constants
    renderName.ts   name to transparent PNG on canvas
    exportPdf.ts    combined PDF and per person PDFs
    exportPng.ts    300 DPI PNG output
    zip.ts          fflate helpers
  styles.css
public/fonts/
tests/              vitest unit tests
e2e/                playwright tests
.github/workflows/deploy.yml
```

## 10. Build order for v0.1

Commit after each step, conventional commit messages.

1. Scaffold Vite React TypeScript, git init, README, CHANGELOG, .gitignore, version in footer
2. GitHub Actions deploy workflow, Vite `base: '/certificate-generator/'`
3. Background panel with ratio and resolution checks
4. Names panel with the paste parser and the editable table
5. Preview with the mm coordinate system and the safe area guide
6. Placement controls and style controls, including automatic shrink
7. Export: combined PDF, then per person ZIP, then PNG
8. Template save and load, plus localStorage
9. Tests, then tag v0.1.0

## 11. Git and release

- `main` is what is live. Work on `feat/...` and `fix/...` branches.
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.
- Tag releases `v0.1.0`, `v0.1.1` and so on. Update CHANGELOG.md with every release.
- The version from `package.json` shows in the app footer, so team feedback can name a version.
- Team comments become GitHub Issues. One branch per issue.
- GitHub Pages has no per branch preview link. Review locally with `npm run dev`, or on the live site after merge. Moving to Cloudflare later gives preview links if that becomes painful.

## 12. Repo hygiene

**The repo is public.** Never commit:

- Real certificate templates or client artwork
- Real participant name lists
- Anything with client or agency branding

Use a generic sample certificate and made up names for tests and screenshots.

## 13. Testing

- **Vitest**: paste parser (tabs, quotes, blank lines, duplicates, Thai names), ratio check, mm to px maths, automatic shrink.
- **Playwright**: load a sample background, paste 500 mixed Thai and English names, export. Assert page count is 500, page size is 841.89 x 595.28 pt, and the file opens. Render a few pages to PNG and check by eye.
- Thai stress test names: ปิ่นทิพย์, น้ำฝน, ผู้ใหญ่, กิ่งแก้ว, ธีร์ธวัช. These have stacked vowels and tone marks and will expose bad text rendering immediately.
- Also test a very long name against a short one to check the automatic shrink and the centring.

## 14. Definition of done for v0.1

- 500 names export to one PDF in under about 60 seconds
- Thai marks render correctly in the exported PDF
- Page size is exactly A4 landscape with no margin
- Per person ZIP and PNG export both work
- Template JSON saves and reloads the exact layout
- The site is live on GitHub Pages and shows a version number
- README explains how to run, build, and release

## 15. Working style with TK

- Reply short and concise, plain vocabulary, no long winded phrasing.
- No em dashes, no en dashes, and do not use the slash character as a connector in prose.
- TK works plan first: for anything multi step, show a numbered plan and wait for approval before executing.
- TK is technical (advanced Excel, Python, GIS) but new to JavaScript tooling. Explain the why briefly when introducing a new tool or command.

## 16. Open items

- Repo name is `certificate-generator` unless TK says otherwise.
- Custom domain: not now, free GitHub Pages address first.
- Possible v0.2: second text layer (certificate number, date), portrait support, preview links on Cloudflare.
