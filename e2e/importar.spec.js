const { test, expect, TMDB_KEY, seed, goTo } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('xlsx')

// Cria o arquivo de exemplo na pasta de teste e faz o diálogo "Abrir" devolver ele
async function offerFile(electronApp, userDataDir, fileName, content) {
  const filePath = path.join(userDataDir, fileName)
  if (Buffer.isBuffer(content)) fs.writeFileSync(filePath, content)
  else fs.writeFileSync(filePath, content, 'utf8')
  await electronApp.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, filePath)
}

async function openImport(page) {
  await goTo(page, 'Minha Coleção')
  await page.getByRole('button', { name: /Importar/ }).click()
  await page.getByRole('button', { name: /Escolher arquivo/ }).click()
}

const getAll = (page) => page.evaluate(() => window.api.getAll())
const byTitle = (all, t) => all.find(f => f.title === t)

test('Letterboxd (ratings.csv): converte estrelas em nota 0–10, data vira "assistido em" e pula o que já existe', async ({ page, electronApp, userDataDir }) => {
  await seed(page, [{ title: 'Parasita', year: 2019 }])
  await offerFile(electronApp, userDataDir, 'ratings.csv', [
    'Date,Name,Year,Letterboxd URI,Rating',
    '2024-03-01,Parasita,2019,https://boxd.it/a,5',
    '2024-03-02,Amélie,2001,https://boxd.it/b,4.5',
    '2024-03-03,"Cães de Aluguel, o Filme",1992,https://boxd.it/c,2',
  ].join('\n'))
  await openImport(page)

  await expect(page.getByTestId('import-summary')).toContainText('Letterboxd · 3 título(s): 2 novo(s), 1 já na coleção')
  await page.getByText(/Completar com dados da TMDB/).locator('input').uncheck().catch(() => {})
  await page.getByRole('button', { name: 'Importar 2 título(s)' }).click()
  await expect(page.getByTestId('import-result')).toContainText('2 título(s) importado(s)')

  const all = await getAll(page)
  expect(all).toHaveLength(3)
  expect(byTitle(all, 'Amélie')).toMatchObject({ year: 2001, my_rating: 9, watched_at: '2024-03-02', category: 'Filme' })
  expect(byTitle(all, 'Cães de Aluguel, o Filme')).toMatchObject({ my_rating: 4 })

  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.locator('.disc-card')).toHaveCount(3)
})

test('Letterboxd watchlist.csv entra como não assistido', async ({ page, electronApp, userDataDir }) => {
  await offerFile(electronApp, userDataDir, 'watchlist.csv', 'Date,Name,Year,Letterboxd URI\n2024-01-01,Duna,2021,https://boxd.it/x\n')
  await openImport(page)
  await page.getByText(/Completar com dados da TMDB/).locator('input').uncheck().catch(() => {})
  await page.getByRole('button', { name: 'Importar 1 título(s)' }).click()
  await expect(page.getByTestId('import-result')).toBeVisible()
  expect(byTitle(await getAll(page), 'Duna')).toMatchObject({ year: 2021, watched_at: '' })
})

test('planilha Excel genérica: colunas em português, formato padrão pra quem não tem', async ({ page, electronApp, userDataDir }) => {
  const ws = XLSX.utils.json_to_sheet([
    { 'Título': 'Filme Com Formato', 'Ano': 1985, 'Nota': 8, 'Formato': 'VHS', 'Assistido': 'sim' },
    { 'Título': 'Filme Sem Formato', 'Ano': 2010, 'Nota': '', 'Formato': '', 'Assistido': '15/02/2023' },
    { 'Título': 'Data De Verdade', 'Ano': 2015, 'Assistido': new Date(2022, 6, 1) },
    { 'Título': '', 'Ano': 2000 },
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lista')
  await offerFile(electronApp, userDataDir, 'minha-lista.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  await openImport(page)

  await expect(page.getByTestId('import-summary')).toContainText('Planilha (coluna de título) · 3 título(s)')
  await page.getByText(/Completar com dados da TMDB/).locator('input').uncheck().catch(() => {})
  await page.getByText('Formato pra quem não tiver:').locator('select').selectOption('Blu-ray')
  await page.getByRole('button', { name: 'Importar 3 título(s)' }).click()
  await expect(page.getByTestId('import-result')).toBeVisible()

  const all = await getAll(page)
  // célula de data no Excel chega como número de série
  expect(byTitle(all, 'Data De Verdade')).toMatchObject({ watched_at: '2022-07-01' })
  expect(byTitle(all, 'Filme Com Formato')).toMatchObject({ formats: 'VHS', my_rating: 8, watched_at: 'watched', year: 1985 })
  expect(byTitle(all, 'Filme Sem Formato')).toMatchObject({ formats: 'Blu-ray', my_rating: null, watched_at: '2023-02-15' })
})

test('CSV exportado pelo próprio app é reconhecido e nada é duplicado ao importar de volta', async ({ page, electronApp, userDataDir }) => {
  await seed(page, [{ title: 'Um "Título" Com Aspas', year: 1999, formats: 'DVD' }, { title: 'Outro', year: 2005, formats: 'Blu-ray, 4K UHD' }])
  const csvPath = path.join(userDataDir, 'exportado.csv')
  await electronApp.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: p })
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, csvPath)
  await goTo(page, 'Minha Coleção')
  await page.getByRole('button', { name: /CSV/ }).click()
  await expect.poll(() => fs.existsSync(csvPath)).toBe(true)
  // aspas dentro do campo dobradas, como manda o CSV
  expect(fs.readFileSync(csvPath, 'utf8')).toContain('"Um ""Título"" Com Aspas"')

  await page.getByRole('button', { name: /Importar/ }).click()
  await page.getByRole('button', { name: /Escolher arquivo/ }).click()
  await expect(page.getByTestId('import-summary')).toContainText('Exportação do Meu Catálogo · 2 título(s): 0 novo(s), 2 já na coleção')
  await expect(page.getByRole('button', { name: 'Importar 0 título(s)' })).toBeDisabled()
})

test('arquivo sem coluna de título é recusado com explicação', async ({ page, electronApp, userDataDir }) => {
  await offerFile(electronApp, userDataDir, 'qualquer.csv', 'coluna1,coluna2\na,b\n')
  await openImport(page)
  await expect(page.getByText(/Não reconheci o arquivo/)).toBeVisible()
  expect(await getAll(page)).toHaveLength(0)
})

test.describe('com a TMDB', () => {
  test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

  test('IMDb (ratings.csv): acha pelo código do IMDb, completa os dados e marca episódios de série assistida', async ({ page, electronApp, userDataDir }) => {
    await offerFile(electronApp, userDataDir, 'ratings.csv', [
      'Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
      'tt0816692,10,2023-05-10,Interstellar,https://www.imdb.com/title/tt0816692/,Movie,8.7,169,2014,"Adventure, Drama",2000000,2014-11-05,Christopher Nolan',
      'tt0279600,7,2023-06-01,Smallville,https://www.imdb.com/title/tt0279600/,TV Series,7.5,44,2001,"Adventure, Drama",130000,2001-10-16,',
    ].join('\n'))
    await openImport(page)
    await expect(page.getByTestId('import-summary')).toContainText('IMDb · 2 título(s): 2 novo(s)')
    await page.getByRole('button', { name: 'Importar 2 título(s)' }).click()
    await expect(page.getByTestId('import-result')).toContainText('2 encontrado(s) na TMDB', { timeout: 60_000 })

    const all = await getAll(page)
    const movie = all.find(f => f.imdb_id === 'tt0816692')
    expect(movie).toMatchObject({ tmdb_id: '157336', tmdb_media_type: 'movie', category: 'Filme', my_rating: 10, watched_at: '2023-05-10' })
    expect(movie.poster_url).toMatch(/^https:\/\/image\.tmdb\.org/)
    const show = all.find(f => f.tmdb_id === '4604')
    expect(show).toMatchObject({ tmdb_media_type: 'tv', my_rating: 7 })
    expect(show.episodes_watched_count).toBeGreaterThan(200)
  })
})
