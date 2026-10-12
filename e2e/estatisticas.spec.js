const { test, expect, seed, goTo } = require('./support/app')

test('estatísticas calculam totais, horas, notas e agrupamentos a partir da coleção', async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10)
  const saved = await seed(page, [
    { title: 'Filme A', watched_at: today, runtime: '120 min', genre: 'Ação, Drama', formats: 'Blu-ray', year: 1999, my_rating: 8 },
    { title: 'Filme B', watched_at: 'watched', runtime: '90 min', genre: 'Drama', formats: 'DVD, Blu-ray', year: 2005, my_rating: 6 },
    { title: 'Filme C', runtime: '100 min', genre: 'Comédia', formats: 'DVD', year: 2010 },
    { title: 'Filme D', watched_at: 'watched', genre: 'Drama', formats: '', format: '' },
    { title: 'Série S', category: 'Série', runtime: '45 min/ep', genre: 'Crime', formats: 'Digital', year: 2012 },
  ])
  const serie = saved.find(f => f.title === 'Série S')
  await page.evaluate(async (id) => {
    for (let ep = 1; ep <= 6; ep++) await window.api.episodesSetWatched({ filmeId: id, season: 1, episode: ep, watched: true })
  }, serie.id)
  await page.reload()
  await page.locator('.app-layout').waitFor()

  await goTo(page, 'Estatísticas')
  await expect(page.locator('h1.page-title')).toHaveText('Estatísticas')

  await expect(page.getByTestId('stat-titles')).toContainText('5')
  await expect(page.getByTestId('stat-watched')).toContainText('3 (60%)')
  // 120 + 90 (filmes assistidos) + 6 × 45 (episódios) = 480 min; Filme D não tem duração
  await expect(page.getByTestId('stat-hours').locator('.stat-card-value')).toHaveText('8')
  await expect(page.getByTestId('stat-hours')).toContainText('sem duração cadastrada em 1 título(s)')
  await expect(page.getByTestId('stat-episodes').locator('.stat-card-value')).toHaveText('6')
  await expect(page.getByTestId('stat-rating').locator('.stat-card-value')).toHaveText('7')

  const rows = (testId) => page.getByTestId(testId).locator('.bar-row')
  await expect(rows('stats-genres').first()).toContainText('Drama')
  await expect(rows('stats-genres').first().locator('.bar-value')).toHaveText('3')
  await expect(rows('stats-formats').locator('.bar-label')).toHaveText(['Blu-ray', 'DVD', 'Digital'])
  await expect(rows('stats-decades').locator('.bar-label')).toHaveText(['1990s', '2000s', '2010s'])
  await expect(rows('stats-ratings').locator('.bar-label')).toHaveText(['6', '8'])

  await expect(page.getByTestId('stats-activity').locator('.activity-col')).toHaveCount(12)
  await expect(page.getByTestId('stats-activity')).toContainText('2 título(s) assistido(s) sem data')
})

test('coleção vazia mostra zeros e mensagens de "sem dados" sem quebrar', async ({ page }) => {
  await goTo(page, 'Estatísticas')
  await expect(page.getByTestId('stat-titles')).toContainText('0')
  await expect(page.getByTestId('stat-rating').locator('.stat-card-value')).toHaveText('—')
  await expect(page.getByTestId('stats-genres')).toContainText('Sem dados ainda.')
  await expect(page.getByTestId('stats-activity')).toContainText('Nenhuma atividade com data')
})
