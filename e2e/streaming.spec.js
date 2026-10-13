const { test, expect, TMDB_KEY, seed, goTo, openDetail, runSql } = require('./support/app')

const NETFLIX = { id: 8, name: 'Netflix', logo: '/netflix.jpg' }
const PRIME = { id: 119, name: 'Amazon Prime Video', logo: '/prime.jpg' }
const MAX = { id: 1899, name: 'HBO Max', logo: '/max.jpg' }
const GLOBO = { id: 307, name: 'Globoplay', logo: '/globo.jpg' }

// Grava o cache do "Onde assistir" direto no banco de teste, sem depender da TMDB
function setProviders(electronApp, userDataDir, byTitle) {
  return runSql(electronApp, userDataDir, Object.entries(byTitle).map(([title, list]) =>
    ["UPDATE filmes SET providers = ?, providers_checked_at = datetime('now') WHERE title = ?", JSON.stringify(list), title]))
}

async function seedWithProviders(page, electronApp, userDataDir) {
  await seed(page, [{ title: 'Quatro Serviços' }, { title: 'Só Netflix' }, { title: 'Nenhum Serviço' }, { title: 'Nunca Verificado' }])
  await setProviders(electronApp, userDataDir, {
    'Quatro Serviços': [NETFLIX, PRIME, MAX, GLOBO],
    'Só Netflix': [NETFLIX],
    'Nenhum Serviço': [],
  })
  await page.reload()
  await page.locator('.app-layout').waitFor()
  await goTo(page, 'Minha Coleção')
}

test('card mostra até 3 logos e "+N"; filtro por serviço, "algum" e "nenhum"', async ({ page, electronApp, userDataDir }) => {
  await seedWithProviders(page, electronApp, userDataDir)

  // com o filtro extra, a barra de filtros quebra linha em vez de vazar pra fora da tela
  await page.evaluate(async () => { await window.api.tagsInsert('Uma Tag') })
  await page.reload(); await page.locator('.app-layout').waitFor(); await goTo(page, 'Minha Coleção')
  await expect(page.getByTestId('provider-filter')).toBeVisible()
  expect(await page.evaluate(() => { const el = document.querySelector('.page'); return el.scrollWidth - el.clientWidth })).toBe(0)

  const card = page.locator('.disc-card', { hasText: 'Quatro Serviços' })
  await expect(card.locator('.provider-logos img')).toHaveCount(3)
  await expect(card.locator('.provider-more')).toHaveText('+1')
  await expect(card.locator('.provider-logos')).toHaveAttribute('title', 'Netflix, Amazon Prime Video, HBO Max, Globoplay')
  await expect(page.locator('.disc-card', { hasText: 'Nenhum Serviço' }).locator('.provider-logos')).toHaveCount(0)

  const filter = page.getByTestId('provider-filter')
  await expect(filter.locator('option')).toHaveText([
    'Onde assistir: todos', 'Em algum streaming', 'Em nenhum streaming',
    'Netflix (2)', 'Amazon Prime Video (1)', 'Globoplay (1)', 'HBO Max (1)',
  ])
  const titles = page.locator('.disc-title-grid')

  await filter.selectOption({ label: 'Netflix (2)' })
  await expect(titles).toHaveText(['Quatro Serviços', 'Só Netflix'])
  await filter.selectOption('any')
  await expect(titles).toHaveText(['Quatro Serviços', 'Só Netflix'])
  // "nenhum" = verificado e sem serviço; o que nunca foi verificado não entra
  await filter.selectOption('none')
  await expect(titles).toHaveText(['Nenhum Serviço'])

  await page.getByRole('button', { name: /Limpar filtros/ }).click()
  await expect(titles).toHaveCount(4)
  await expect(filter).toHaveValue('all')

  // visão em lista também mostra os logos
  await page.locator('.view-toggle button').nth(1).click()
  await expect(page.locator('.disc-list-item', { hasText: 'Só Netflix' }).locator('.provider-logos img')).toHaveCount(1)
})

test('trocar o vínculo com a TMDB na edição descarta o cache do "Onde assistir"', async ({ page, electronApp, userDataDir }) => {
  await seedWithProviders(page, electronApp, userDataDir)
  const result = await page.evaluate(async () => {
    const find = async (t) => (await window.api.getAll()).find(f => f.title === t)
    const a = await find('Só Netflix')
    await window.api.update({ ...a, synopsis: 'só mudou a sinopse' })
    const keptAfterOtherEdit = (await find('Só Netflix')).providers
    await window.api.update({ ...a, tmdb_id: '999', tmdb_media_type: 'movie' })
    return { keptAfterOtherEdit, afterRelink: (await find('Só Netflix')).providers }
  })
  expect(JSON.parse(result.keptAfterOtherEdit)).toEqual([NETFLIX])
  expect(result.afterRelink).toBeNull()
})

test.describe('com a TMDB', () => {
  test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

  test('ao abrir o app, títulos sem cache são verificados em segundo plano e gravados', async ({ page }) => {
    await seed(page, [{ title: 'Interestelar', category: 'Filme', tmdb_id: '157336', tmdb_media_type: 'movie' }])
    // o seed recarrega a página, o que dispara a verificação em segundo plano
    await expect.poll(async () => {
      const [f] = await page.evaluate(() => window.api.getAll())
      return f.providers_checked_at != null && Array.isArray(JSON.parse(f.providers))
    }, { timeout: 20_000 }).toBe(true)

    await openDetail(page, 'Interestelar')
    await expect(page.locator('.modal h2')).toHaveText('Interestelar')
  })
})
