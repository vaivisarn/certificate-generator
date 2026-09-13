# Certificate Generator

A browser only web app to issue A4 landscape certificates in bulk.

Upload a certificate background, paste participant names copied from Excel, position the name, and export print ready files. Up to 500 certificates per run.

Live site: https://vaivisarn.github.io/certificate-generator/

## Privacy

Everything runs in the browser. There is no server and no database. Backgrounds and participant names never leave your computer. Names are not saved in the browser or in template files.

## Templates and remembered settings

- **Save template** downloads a small JSON file with the name position and style (font, size, colour, bold, max width, fit or fill). It does not contain names or the background image, so it is safe to share with the team.
- **Load template** applies a saved layout. If the layout used a custom font file, load that font again in Style.
- The last layout is also remembered in this browser, so a reload keeps it. **Reset layout** goes back to the defaults.

## Run locally

You need Node.js (LTS) installed.

```bash
npm install
npm run dev
```

`npm install` downloads the libraries listed in `package.json` into `node_modules`. Run it once, and again after pulling changes that add libraries.

`npm run dev` starts a local preview server. Open the address it prints (usually http://localhost:5173/certificate-generator/). The page reloads by itself when you edit code.

## Build

```bash
npm run build
```

This checks the TypeScript types and writes the finished site to `dist/`. GitHub Actions runs the same command before every deploy, so if it fails locally it will fail online too.

## Deploy

`.github/workflows/deploy.yml` runs on every push to `main`: install, unit tests, build, then publish `dist/` to GitHub Pages. Progress shows under the Actions tab on GitHub. A failed test or build stops the deploy, so the live site keeps the last good version.

To look at the built site before pushing:

```bash
npm run preview
```

## Test

```bash
npm test
```

Runs the unit tests with Vitest.

```bash
npm run test:e2e
```

Runs the end to end tests with Playwright. The first time, install the test browser with `npx playwright install chromium`.

## Release

1. Work on a branch such as `feat/date-field` or `fix/thai-marks`.
2. Merge into `main` when it works. Every push to `main` deploys the live site.
3. For a release, update the version and CHANGELOG:
   ```bash
   npm version patch
   ```
   This bumps the version in `package.json`, commits, and creates a tag such as `v0.1.1`. Use `minor` instead of `patch` for new features.
4. Move the notes under "Unreleased" in `CHANGELOG.md` into the new version section.
5. Push the commit and the tag:
   ```bash
   git push --follow-tags
   ```

The version from `package.json` shows in the app footer, so feedback can name the exact version.

## Sample files

`samples/` holds a generic sample certificate for tests and screenshots. The repo is public, so never commit real certificate artwork or real participant names.
