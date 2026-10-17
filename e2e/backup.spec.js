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
  await page.getByRole('button', { name: /Salvar backup em/ }).click()
  await expect(page.getByText('Backup criado com sucesso!')).toBeVisible()
  expect(fs.existsSync(zipPath)).toBe(true)

  await seed(page, [{ title: 'Depois do Backup' }])
  await goTo(page, 'Catálogo')
  await expect(page.locator('.disc-card')).toHaveCount(2)

  await stubDialogs(electronApp, { save: { canceled: true }, open: { canceled: false, filePaths: [zipPath] } })
  await goTo(page, 'Configurações')
  await page.getByRole('button', { name: /Restaurar backup/ }).click()
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click()

  // a janela recarrega sozinha; antes da v1.8.1 ficava escura aqui
  await page.waitForEvent('load')
  await page.locator('.app-layout').waitFor({ timeout: 30_000 })
  await goTo(page, 'Catálogo')
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

const autoBackups = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.startsWith('meu-catalogo-auto-')).sort() : [])

test('backup automático: ligado por padrão, só com catálogo não vazio, 1x por semana e guarda os 5 últimos', async ({ page, userDataDir }) => {
  // fora do app instalado a pasta padrão fica dentro da pasta de dados de teste
  const dir = path.join(userDataDir, 'backups')
  const today = `meu-catalogo-auto-${new Date().toISOString().slice(0, 10)}.zip`

  // catálogo vazio: nada a guardar (e não empurra backups bons pra fora da rotação)
  await page.evaluate(() => window.api.backupAutoCheck())
  expect(autoBackups(dir)).toEqual([])

  await seed(page, [{ title: 'Guardado' }]) // ao reabrir, a checagem em segundo plano roda
  await expect.poll(() => autoBackups(dir)).toEqual([today])

  await goTo(page, 'Configurações')
  await expect(page.getByTestId('pref-auto-backup')).toBeChecked()
  await expect(page.getByTestId('auto-backup-dir')).toHaveText(dir)
  await expect(page.getByTestId('auto-backup-last')).toContainText('Último:')

  // na mesma semana não repete
  fs.rmSync(path.join(dir, today))
  expect(await page.evaluate(() => window.api.backupAutoCheck())).toMatchObject({ ran: false, reason: 'not-due' })
  expect(autoBackups(dir)).toEqual([])

  // rotação: 6 antigos + 1 novo → ficam os 5 mais recentes; arquivo que não é do backup automático fica intacto
  for (let d = 1; d <= 6; d++) fs.writeFileSync(path.join(dir, `meu-catalogo-auto-2020-01-0${d}.zip`), 'x')
  fs.writeFileSync(path.join(dir, 'meu-backup-manual.zip'), 'x')
  await page.getByRole('button', { name: 'Fazer agora' }).click()
  await expect.poll(() => autoBackups(dir)).toEqual([
    'meu-catalogo-auto-2020-01-03.zip', 'meu-catalogo-auto-2020-01-04.zip', 'meu-catalogo-auto-2020-01-05.zip',
    'meu-catalogo-auto-2020-01-06.zip', today,
  ])
  expect(fs.existsSync(path.join(dir, 'meu-backup-manual.zip'))).toBe(true)
})

test('backup automático desligado não grava nada ao abrir', async ({ page, userDataDir }) => {
  await goTo(page, 'Configurações')
  await page.getByTestId('pref-auto-backup').uncheck()
  await expect(page.getByTestId('pref-auto-backup')).not.toBeChecked()
  await seed(page, [{ title: 'Sem backup' }])
  await page.waitForTimeout(1500)
  expect(autoBackups(path.join(userDataDir, 'backups'))).toEqual([])
  await goTo(page, 'Configurações')
  await expect(page.getByTestId('pref-auto-backup')).not.toBeChecked()
})
