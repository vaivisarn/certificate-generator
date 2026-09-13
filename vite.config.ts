import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from a sub path, not the domain root.
  base: '/certificate-generator/',
  plugins: [react()],
  define: {
    // Shown in the footer so team feedback can name a version.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
