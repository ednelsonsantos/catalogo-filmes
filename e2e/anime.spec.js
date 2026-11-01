const { test, expect, goTo, reloadApp } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')

// Sem conta no MAL nos testes: a lista vem do cache local (mal-cache.json) e as chamadas à API do MAL
// são trocadas por respostas fixas no processo principal
const anime = (id, title, status, extra = {}) => ({
  node: { id, title, alternative_titles: { en: `${title} EN` }, num_episodes: 12, mean: 8.1, start_date: '2020-04-01', media_type: 'tv', genres: [{ id: 1, name: 'Ação' }], ...extra.node },
  list_status: { status, score: 0, num_episodes_watched: 0, ...extra.list_status },
})

const CACHE = [
  anime(1, 'Akira Shin', 'completed', { list_status: { score: 9, num_episodes_watched: 12 } }),
  anime(2, 'Bleach Novo', 'watching', { list_status: { score: 7, num_episodes_watched: 5 } }),
  anime(3, 'Cowboy Teste', 'plan_to_watch'),
]

async function setupMal(page, electronApp, userDataDir) {
  const settingsPath = path.join(userDataDir, 'settings.json')
  const settings = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {}
  fs.writeFileSync(settingsPath, JSON.stringify({ ...settings, malClientId: 'cliente-de-teste' }))
  fs.writeFileSync(path.join(userDataDir, 'mal-cache.json'), JSON.stringify(CACHE))
  await electronApp.evaluate(({ ipcMain }) => {
    globalThis.__malUpdates = []
    ipcMain.removeHandler('mal:updateAnime')
    ipcMain.handle('mal:updateAnime', (_, p) => { globalThis.__malUpdates.push(p); return {} })
    ipcMain.removeHandler('mal:search')
    ipcMain.handle('mal:search', () => ({ data: [
      { node: { id: 2, title: 'Bleach Novo', num_episodes: 12, start_date: '2020-01-01', media_type: 'tv', mean: 8 } },
      { node: { id: 50, title: 'Dorohedoro Teste', num_episodes: 12, start_date: '2020-01-01', media_type: 'tv', mean: 7.9 } },
    ] }))
  })
  await reloadApp(page)
}

const malUpdates = (electronApp) => electronApp.evaluate(() => globalThis.__malUpdates)
const gridTitles = (page) => page.getByTestId('anime-card').locator('[data-testid="anime-title"]').allTextContents()

test('página do MyAnimeList: filtros, busca, ordenação, lista e edição salva no MAL', async ({ page, electronApp, userDataDir }) => {
  await setupMal(page, electronApp, userDataDir)
  await goTo(page, 'MyAnimeList')
  await expect(page.locator('h1.page-title')).toHaveText('MyAnimeList')

  await expect.poll(() => gridTitles(page)).toEqual(['Akira Shin', 'Bleach Novo', 'Cowboy Teste'])
  await page.getByRole('button', { name: 'Assistindo (1)' }).click()
  await expect.poll(() => gridTitles(page)).toEqual(['Bleach Novo'])
  await page.getByRole('button', { name: 'Todos (3)' }).click()
  await page.getByPlaceholder('Buscar anime...').fill('cowboy teste en')
  await expect.poll(() => gridTitles(page)).toEqual(['Cowboy Teste'])
  await page.getByPlaceholder('Buscar anime...').fill('')
  await page.locator('select', { has: page.locator('option', { hasText: 'Minha nota' }) }).selectOption('myscore')
  await expect.poll(() => gridTitles(page)).toEqual(['Akira Shin', 'Bleach Novo', 'Cowboy Teste'])

  // lista: episódios que faltam e status
  await page.getByRole('button', { name: 'Lista' }).click()
  const row = page.getByTestId('anime-row').filter({ hasText: 'Bleach Novo' })
  await expect(row).toContainText('faltam 7')
  await expect(row).toContainText('Assistindo')

  // edição: completo preenche os episódios; salvar manda pro MAL e atualiza a lista local
  await row.click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('heading', { name: 'Bleach Novo' })).toBeVisible()
  await modal.getByLabel('Status na lista').selectOption('completed')
  await expect(modal.getByLabel('Episódios assistidos')).toHaveValue('12')
  await modal.getByLabel('Minha nota').fill('8')
  await expect(modal).toContainText('(8) Ótimo')
  await modal.getByRole('button', { name: 'Salvar no MAL' }).click()
  await expect(page.getByText('Atualizado no MyAnimeList!')).toBeVisible()
  await expect(modal).toHaveCount(0)
  expect(await malUpdates(electronApp)).toEqual([{ animeId: 2, patch: { status: 'completed', score: 8, num_episodes_watched: 12 } }])
  await expect(row).toContainText('Completo')
  await expect(row).not.toContainText('faltam')

  // Esc fecha sem salvar
  await page.getByTestId('anime-row').filter({ hasText: 'Cowboy Teste' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await malUpdates(electronApp)).toHaveLength(1)
})

test('adicionar anime: avisa o que já está na lista e adiciona o novo ao MAL', async ({ page, electronApp, userDataDir }) => {
  await setupMal(page, electronApp, userDataDir)
  await page.getByRole('button', { name: 'Adicionar Título' }).click()
  await page.getByRole('button', { name: /Anime \(MyAnimeList\)/ }).click()
  await page.getByPlaceholder('Nome do anime...').fill('teste')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()

  await page.locator('.search-result-item', { hasText: 'Bleach Novo' }).click()
  await expect(page.getByText('"Bleach Novo" já está na sua lista')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.locator('.search-result-item', { hasText: 'Dorohedoro Teste' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByLabel('Status na lista')).toHaveValue('plan_to_watch')
  await modal.getByLabel('Status na lista').selectOption('watching')
  await modal.getByLabel('Episódios assistidos').fill('3')
  await modal.getByRole('button', { name: 'Adicionar ao MAL' }).click()
  await expect(page.getByText('Adicionado/atualizado no MyAnimeList!')).toBeVisible()
  expect(await malUpdates(electronApp)).toEqual([{ animeId: 50, patch: { status: 'watching', score: 0, num_episodes_watched: 3 } }])
  expect((await page.evaluate(() => window.api.malLoadCache())).length).toBeGreaterThanOrEqual(3)

  await goTo(page, 'MyAnimeList')
  await expect.poll(() => gridTitles(page)).toContain('Dorohedoro Teste')
})
