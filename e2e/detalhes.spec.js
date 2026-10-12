const { test, expect, TMDB_KEY, seed, openDetail } = require('./support/app')

test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

test('título antigo só com IMDb ganha vínculo com a TMDB ao abrir o detalhe', async ({ page }) => {
  const [filme] = await seed(page, [{ title: 'Interestelar', category: 'Filme', imdb_id: 'tt0816692' }])
  await openDetail(page, 'Interestelar')
  await expect.poll(async () => {
    const all = await page.evaluate(() => window.api.getAll())
    const f = all.find(x => x.id === filme.id)
    return [f.tmdb_id, f.tmdb_media_type]
  }).toEqual(['157336', 'movie'])

  // a disponibilidade em streaming muda com o tempo: só garante que, se houver logos, eles se identificam
  const logos = page.locator('.modal img[title]')
  for (const img of await logos.all()) await expect(img).toHaveAttribute('title', /\S/)
  await expect(page.locator('.modal').getByText('Episódios', { exact: true })).toHaveCount(0)
})

test('filme de animação buscado como filme não mostra painel de episódios; série mostra', async ({ page }) => {
  await seed(page, [
    { title: 'A Viagem de Chihiro', category: 'Animação', tmdb_id: '129', tmdb_media_type: 'movie' },
    { title: 'Smallville', category: 'Série', tmdb_id: '4604', tmdb_media_type: 'tv' },
  ])
  await openDetail(page, 'A Viagem de Chihiro')
  await expect(page.locator('.modal h2')).toHaveText('A Viagem de Chihiro')
  await expect(page.locator('.modal').getByText('Episódios', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await openDetail(page, 'Smallville')
  await expect(page.locator('.modal').getByText('Episódios', { exact: true })).toBeVisible()
  await expect(page.locator('.modal').getByRole('button', { name: /^Temporada 1 / })).toBeVisible()
})
