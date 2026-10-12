const { test, expect, seed, goTo } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')

// Os diálogos nativos de arquivo não são clicáveis: troca por respostas fixas no processo principal
async function stubDialogs(electronApp, { save, open }) {
  await electronApp.evaluate(({ dialog }, r) => {
    dialog.showSaveDialog = async () => r.save
    dialog.showOpenDialog = async () => r.open
  }, { save, open })
}

test('backup e restauração devolvem o catálogo ao estado do backup sem tela escura', async ({ page, electronApp, userDataDir }) => {
  const zipPath = path.join(userDataDir, '..', `${path.basename(userDataDir)}-backup.zip`)
  await seed(page, [{ title: 'Antes do Backup' }])

  await stubDialogs(electronApp, { save: { canceled: false, filePath: zipPath }, open: { canceled: true, filePaths: [] } })
  await goTo(page, 'Configurações')
  await page.getByRole('button', { name: /Fazer backup/ }).click()
  await expect(page.getByText('Backup criado com sucesso!')).toBeVisible()
  expect(fs.existsSync(zipPath)).toBe(true)

  await seed(page, [{ title: 'Depois do Backup' }])
  await goTo(page, 'Minha Coleção')
  await expect(page.locator('.disc-card')).toHaveCount(2)

  await stubDialogs(electronApp, { save: { canceled: true }, open: { canceled: false, filePaths: [zipPath] } })
  await goTo(page, 'Configurações')
  await page.getByRole('button', { name: /Restaurar backup/ }).click()
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click()

  // a janela recarrega sozinha; antes da v1.8.1 ficava escura aqui
  await page.waitForEvent('load')
  await page.locator('.app-layout').waitFor({ timeout: 30_000 })
  await goTo(page, 'Minha Coleção')
  await expect(page.locator('.disc-title-grid')).toHaveText(['Antes do Backup'])

  fs.rmSync(zipPath, { force: true })
})

test('cancelar o diálogo de restauração não deixa o botão travado', async ({ page, electronApp }) => {
  await stubDialogs(electronApp, { save: { canceled: true }, open: { canceled: true, filePaths: [] } })
  await goTo(page, 'Configurações')
  await page.getByRole('button', { name: /Restaurar backup/ }).click()
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click()
  await expect(page.getByRole('button', { name: '📂 Restaurar backup' })).toBeEnabled()
})
