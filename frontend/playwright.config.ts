import { defineConfig } from '@playwright/test'
const port = Number(process.env.E2E_PORT || 5175)

export default defineConfig({
  testDir: './tests',
  timeout: 150000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/summary.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'msedge',
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --mode development --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 60000,
    env: { VITE_USE_MOCK: 'false', VITE_PROXY_TARGET: process.env.E2E_BACKEND || 'http://127.0.0.1:18080' }
  }
})
