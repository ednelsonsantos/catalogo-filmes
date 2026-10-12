// Arquivos em CommonJS: o carregador ESM do Playwright trava com o Node 24
const { defineConfig } = require('@playwright/test')

const PORT = 5199

module.exports = defineConfig({
  testDir: '.',
  testMatch: '*.spec.js',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
