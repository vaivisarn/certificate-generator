# Changelog

All notable changes to this project are listed here. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

### Added

- Project scaffold: Vite, React, TypeScript.
- App shell with the four panels and the version number in the footer.
- Generic sample certificate in `samples/`.
- GitHub Actions workflow that tests, builds and deploys to GitHub Pages.
- Background panel: drop or pick a PNG, JPG or single page PDF. Checks the A4 landscape ratio (1.5 percent tolerance) and print resolution, explains the 16:9 PowerPoint case, and offers Fit or Fill when the shape does not match.
- Test samples: A4 PDF, 16:9 slide, low resolution image.
- Names panel: paste from Excel (first column only, quoted cells, blank rows dropped, spaces tidied), name count, duplicate flags, warning above 500, editable table with row numbers, delete and add rows. Names are never saved.
