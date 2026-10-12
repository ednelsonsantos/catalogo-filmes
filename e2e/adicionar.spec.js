const { test, expect, TMDB_KEY, seed, goTo, nextUpSelects } = require('./support/app')

async function openAdd(page) {
  await page.getByRole('button', { name: 'Adicionar Título' }).click()
  await expect(page.locator('h1.page-title')).toHaveText('Adicionar')
}

const field = (page, label) => page.locator('.field', { has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) }).locator('input, select, textarea').first()
const chip = (page, text) => page.locator('label.format-check', { hasText: new RegExp(`^${text}`) })
const toast = (page, text) => page.locator('div', { hasText: new RegExp(`^${text}$`) }).last()

test('preencher manualmente: valida título e categoria, cria coleção na hora e salva', async ({ page }) => {
  await openAdd(page)
  await page.getByRole('button', { name: /Preencher manualmente/ }).click()

  await page.getByRole('button', { name: 'Adicionar à coleção' }).click()
  await expect(toast(page, 'Informe o título.')).toBeVisible()

  await field(page, 'Título \\*').fill('Meu Filme Caseiro')
  await page.getByRole('button', { name: 'Adicionar à coleção' }).click()
  await expect(toast(page, 'Selecione uma categoria.')).toBeVisible()

  await field(page, 'Categoria').selectOption('Documentário')
  await chip(page, 'Blu-ray').click()
  await chip(page, 'DVD').click()
  await field(page, 'Ano').fill('2021')
  await field(page, 'Minha nota').fill('7')

  await page.getByRole('button', { name: '+ Nova' }).first().click()
  const colInput = page.getByPlaceholder('Nome da coleção...')
  await colInput.fill('Prateleira 1')
  await colInput.press('Enter')
  await expect(chip(page, 'Prateleira 1')).toHaveClass(/active/)

  await page.getByRole('button', { name: 'Adicionar à coleção' }).click()
  await expect(page.locator('.disc-card', { hasText: 'Meu Filme Caseiro' })).toBeVisible()

  const [saved] = (await page.evaluate(() => window.api.getAll())).filter(f => f.title === 'Meu Filme Caseiro')
  expect({ category: saved.category, formats: saved.formats, year: Number(saved.year), my_rating: saved.my_rating })
    .toEqual({ category: 'Documentário', formats: 'Blu-ray, DVD', year: 2021, my_rating: 7 })
  const cols = await page.evaluate(() => window.api.colecoesGetAll())
  expect(cols.map(c => [c.name, c.count])).toEqual([['Prateleira 1', 1]])
  await expect(page.locator('.nav-item', { hasText: 'Prateleira 1' })).toBeVisible()
})

test('editar: categoria seriada mostra "Assistindo"; marcar "Assistido" desmarca "Assistindo"', async ({ page }) => {
  await seed(page, [{ title: 'Série Sem TMDB', category: 'Série', watching: true }])
  await goTo(page, 'Minha Coleção')
  await page.locator('.disc-card', { hasText: 'Série Sem TMDB' }).click()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()

  await expect(chip(page, '▶ Assistindo')).toHaveClass(/active/)
  await chip(page, '✓ Assistido').click()
  await expect(chip(page, '✓ Assistido')).toHaveClass(/active/)
  await expect(chip(page, '▶ Assistindo')).not.toHaveClass(/active/)

  await field(page, 'Categoria').selectOption('Filme')
  await expect(chip(page, '▶ Assistindo')).toHaveCount(0)
})

test('aba de anime sem MAL configurado pede o Client ID', async ({ page }) => {
  await openAdd(page)
  await page.getByRole('button', { name: /Adicionar Anime/ }).click()
  await expect(page.getByText(/Configure o Client ID do MyAnimeList/)).toBeVisible()
})

test.describe('busca na TMDB', () => {
  test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

  test('busca série, carrega os dados, informa o progresso e salva com episódios marcados', async ({ page }) => {
    await openAdd(page)
    await page.getByRole('button', { name: /Buscar por título/ }).click()
    await page.getByPlaceholder('Nome do filme ou série...').fill('Smallville')
    await page.getByPlaceholder('Ano').fill('2001')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()

    const result = page.locator('.search-result-item', { hasText: 'Série' }).filter({ hasText: 'Smallville' }).first()
    await result.click()
    await expect(field(page, 'Título \\*')).toHaveValue(/^Smallville/) // título em pt-BR vem com subtítulo
    await expect(field(page, 'Categoria')).toHaveValue('Série')

    await chip(page, '▶ Assistindo').click()
    const [season, episode] = [nextUpSelects(page).nth(0), nextUpSelects(page).nth(1)]
    await season.selectOption('1')
    await episode.selectOption('3')
    await page.getByRole('button', { name: 'Adicionar à coleção' }).click()
    await expect(page.locator('.disc-card', { hasText: 'Smallville' })).toBeVisible()

    const [saved] = (await page.evaluate(() => window.api.getAll())).filter(f => f.title.startsWith('Smallville'))
    expect([saved.tmdb_id, saved.tmdb_media_type, saved.watching]).toEqual(['4604', 'tv', 1])
    const eps = await page.evaluate((id) => window.api.episodesGetWatched(id), saved.id)
    expect(eps.map(e => `${e.season_number}x${e.episode_number}`).sort()).toEqual(['1x1', '1x2'])
  })

  test('avisa quando o título buscado já está na coleção', async ({ page }) => {
    await seed(page, [{ title: 'Interestelar', category: 'Filme', tmdb_id: '157336', tmdb_media_type: 'movie', year: 2014 }])
    await openAdd(page)
    await page.getByRole('button', { name: /Buscar por título/ }).click()
    await page.getByPlaceholder('Nome do filme ou série...').fill('Interestelar')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()

    const dup = page.locator('.search-result-item', { hasText: 'Já na coleção' }).first()
    await expect(dup).toBeVisible()
    await dup.click()
    await expect(page.getByText('"Interestelar" já está na sua coleção')).toBeVisible()
    await expect(field(page, 'Título \\*')).toHaveCount(0) // não carregou o formulário
  })
})
