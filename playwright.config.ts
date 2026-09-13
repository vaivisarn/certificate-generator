import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  // Exporting 500 certificates takes a while.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/certificate-generator/`,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    // Uses the Google Chrome already on this computer, so no extra browser
    // download is needed. Set PW_BUNDLED=1 to use Playwright's own Chromium
    // instead (run `npx playwright install chromium` first).
    channel: process.env.PW_BUNDLED ? undefined : 'chrome',
  },
  // Test the production build, the same files GitHub Pages serves.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/certificate-generator/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
