const { test, expect, TMDB_KEY, seed, goTo, openEdit, nextUpSelects, nextUpValues } = require('./support/app')

test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

const SMALLVILLE = { title: 'Smallville', category: 'Série', tmdb_id: '4604', tmdb_media_type: 'tv', watching: true }

async function watchedBySeason(page, filmeId) {
  const rows = await page.evaluate((id) => window.api.episodesGetWatched(id), filmeId)
  const out = {}
  for (const r of rows) (out[r.season_number] ||= []).push(r.episode_number)
  for (const k in out) out[k].sort((a, b) => a - b)
  return out
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const episodeRow = (page, n) =>
  page.locator('div', { has: page.locator('label', { hasText: new RegExp(`^✓?Ep ${n}(?!\\d)`) }) }).last()

test('"até aqui" marca temporadas anteriores, desmarca o que vem depois e move o "Próximo a assistir"', async ({ page }) => {
  const [show] = await seed(page, [SMALLVILLE])
  const s1Count = (await page.evaluate(() => window.api.tmdbTvDetails({ id: 4604 })))
    .seasons.find(s => s.season_number === 1).episode_count
  // clique errado à frente, como aconteceu no uso real
  await page.evaluate((id) => window.api.episodesSetWatched({ filmeId: id, season: 3, episode: 14, watched: true }), show.id)

  await openEdit(page, 'Smallville')
  await page.getByRole('button', { name: /^Temporada 2 / }).click()
  await episodeRow(page, 13).getByRole('button', { name: 'até aqui' }).click()

  await expect.poll(nextUpValues(page)).toEqual(['2', '14'])
  expect(await watchedBySeason(page, show.id)).toEqual({ 1: range(1, s1Count), 2: range(1, 13) })

  // clique individual também move o seletor (e só depois de gravar)
  await episodeRow(page, 14).locator('label').click()
  await expect.poll(nextUpValues(page)).toEqual(['2', '15'])
  await episodeRow(page, 14).locator('label').click()
  await expect.poll(nextUpValues(page)).toEqual(['2', '14'])

  await goTo(page, 'Continuando')
  await expect(page.getByText('Próximo: T2E14')).toBeVisible()
})

test('seletor "Próximo a assistir" ao salvar marca tudo antes e desmarca o que vem depois', async ({ page }) => {
  const [show] = await seed(page, [SMALLVILLE])
  await page.evaluate(async (id) => {
    for (const [s, e] of [[2, 1], [2, 2], [3, 6]]) await window.api.episodesSetWatched({ filmeId: id, season: s, episode: e, watched: true })
  }, show.id)

  await openEdit(page, 'Smallville')
  const season = nextUpSelects(page).nth(0)
  const episode = nextUpSelects(page).nth(1)
  await expect(season).toHaveValue('3') // pré-preenchido com o seguinte ao mais avançado (T3E6 → T3E7)
  await expect(episode).toHaveValue('7')
  await season.selectOption('1')
  await episode.selectOption('5')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.locator('.disc-card')).toHaveCount(1)

  expect(await watchedBySeason(page, show.id)).toEqual({ 1: range(1, 4) })
  await goTo(page, 'Continuando')
  await expect(page.getByText('Próximo: T1E5')).toBeVisible()
})
