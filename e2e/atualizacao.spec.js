const { test, expect, goTo } = require('./support/app')
const crypto = require('node:crypto')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { version: CURRENT } = require('../package.json')

// Servidor local no lugar dos releases do GitHub. O "instalador" é lixo aleatório:
// o teste nunca manda instalar, e com feed de teste o app não instala nada ao fechar.
const PORT = 5299
const FAKE_EXE = crypto.randomBytes(256 * 1024)
const sha512 = crypto.createHash('sha512').update(FAKE_EXE).digest('base64')

const latestYml = (version) => [
  `version: ${version}`,
  'files:',
  `  - url: Meu-Catalogo-Setup-${version}.exe`,
  `    sha512: ${sha512}`,
  `    size: ${FAKE_EXE.length}`,
  `path: Meu-Catalogo-Setup-${version}.exe`,
  `sha512: ${sha512}`,
  `releaseDate: '2026-01-01T00:00:00.000Z'`,
  '',
].join('\n')

let server
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const [, feed, file] = new URL(req.url, 'http://x').pathname.split('/')
    const version = feed === 'nova' ? '9.9.9' : CURRENT
    if (file === 'latest.yml') { res.writeHead(200, { 'Content-Type': 'text/yaml' }); return res.end(latestYml(version)) }
    if (file && file.endsWith('.exe')) { res.writeHead(200, { 'Content-Length': FAKE_EXE.length }); return res.end(FAKE_EXE) }
    res.writeHead(404); res.end()
  })
  await new Promise(r => server.listen(PORT, '127.0.0.1', r))
})
test.afterAll(async () => {
  await new Promise(r => server.close(r))
  // pasta de cache do download (nome definido em main.js pro feed de teste)
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'catalogo-filmes-updater-test')
  fs.rmSync(cache, { recursive: true, force: true })
})

test.describe('com versão nova publicada', () => {
  test.use({ appEnv: { CATALOGO_UPDATE_FEED: `http://127.0.0.1:${PORT}/nova/` } })

  test('baixa sozinha ao abrir e oferece reiniciar para atualizar', async ({ page }) => {
    await expect(page.locator('.update-banner')).toContainText('Versão 9.9.9 baixada', { timeout: 30_000 })
    await expect(page.locator('.update-banner').getByRole('button', { name: 'Reiniciar e atualizar' })).toBeVisible()

    await goTo(page, 'Configurações')
    await expect(page.getByTestId('app-version')).toHaveText(CURRENT)
    await expect(page.getByTestId('update-status')).toContainText('Versão 9.9.9 baixada')

    await page.locator('.update-banner').getByRole('button', { name: 'Depois' }).click()
    await expect(page.locator('.update-banner')).toHaveCount(0)
  })
})

test.describe('já na versão mais recente', () => {
  test.use({ appEnv: { CATALOGO_UPDATE_FEED: `http://127.0.0.1:${PORT}/atual/` } })

  test('verificar manualmente informa que está atualizado, sem aviso', async ({ page }) => {
    await goTo(page, 'Configurações')
    await page.getByRole('button', { name: /Verificar atualizações/ }).click()
    await expect(page.getByTestId('update-status')).toHaveText('Você está na versão mais recente.')
    await expect(page.locator('.update-banner')).toHaveCount(0)
  })
})

test.describe('sem conexão com o servidor', () => {
  test.use({ appEnv: { CATALOGO_UPDATE_FEED: 'http://127.0.0.1:5297/' /* nada escutando */ } })

  test('mostra o erro em Configurações sem travar o botão', async ({ page }) => {
    await goTo(page, 'Configurações')
    await page.getByRole('button', { name: /Verificar atualizações/ }).click()
    await expect(page.getByTestId('update-status')).toHaveText('Não foi possível verificar: sem conexão com o servidor de atualizações.')
    await expect(page.getByRole('button', { name: /Verificar atualizações/ })).toBeEnabled()
  })
})

test('em modo dev sem servidor de teste, a atualização fica desligada', async ({ page }) => {
  await goTo(page, 'Configurações')
  await expect(page.getByTestId('update-status')).toHaveText('A atualização automática só funciona no app instalado.')
  await expect(page.getByRole('button', { name: /Verificar atualizações/ })).toBeDisabled()
})
