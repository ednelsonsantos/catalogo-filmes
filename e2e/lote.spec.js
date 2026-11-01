const { test, expect, seed, goTo, reloadApp } = require('./support/app')

const card = (page, title) => page.locator('.disc-card', { hasText: title })
const bar = (page) => page.getByRole('toolbar', { name: 'Ações nos selecionados' })
const all = (page) => page.evaluate(() => window.api.getAll())
const byTitle = async (page) => Object.fromEntries((await all(page)).map(f => [f.title, f]))

test('seleciona vários títulos e marca como assistido / não assistido de uma vez', async ({ page }) => {
  await seed(page, [
    { title: 'Alien' },
    { title: 'Blade Runner', watched_at: '2020-05-01' },
    { title: 'Corra!', watching: true },
    { title: 'Duna' },
  ])
  await goTo(page, 'Catálogo')
  await page.getByRole('button', { name: '☑ Selecionar' }).click()
  await expect(page.getByTestId('bulk-count')).toHaveText('Clique nos títulos pra selecionar')

  // no modo de seleção o clique marca, não abre o detalhe
  await card(page, 'Alien').click()
  await card(page, 'Blade Runner').click()
  await card(page, 'Corra!').click()
  await expect(page.locator('.modal-overlay, .detail-modal')).toHaveCount(0)
  await expect(page.getByTestId('bulk-count')).toHaveText('3 selecionados')
  await card(page, 'Corra!').click()
  await card(page, 'Corra!').click()
  await expect(card(page, 'Corra!')).toHaveAttribute('aria-selected', 'true')
  await expect(card(page, 'Duna')).toHaveAttribute('aria-selected', 'false')

  await bar(page).getByRole('button', { name: '✓ Assistido' }).click()
  await expect(page.getByText('3 títulos marcados como assistidos.')).toBeVisible()
  let f = await byTitle(page)
  expect(f['Alien'].watched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(f['Blade Runner'].watched_at).toBe('2020-05-01') // quem já tinha data fica com a dela
  expect([f['Corra!'].watched_at, f['Corra!'].watching]).toEqual([f['Alien'].watched_at, 0]) // assistido encerra "assistindo"
  expect(f['Duna'].watched_at).toBeFalsy()

  // a seleção continua depois da ação, pra emendar outra
  await bar(page).getByRole('button', { name: 'Não assistido' }).click()
  await expect(page.getByText('3 títulos marcados como não assistidos.')).toBeVisible()
  f = await byTitle(page)
  expect(['Alien', 'Blade Runner', 'Corra!'].map(t => f[t].watched_at || null)).toEqual([null, null, null])

  // Esc sai do modo de seleção e o clique volta a abrir o detalhe
  await page.keyboard.press('Escape')
  await expect(bar(page)).toHaveCount(0)
  await expect(card(page, 'Alien')).not.toHaveAttribute('aria-selected')
})

test('a ação vale só para os selecionados que estão na lista filtrada', async ({ page }) => {
  await seed(page, [{ title: 'Assistido Antes', watched_at: '2021-01-01' }, { title: 'Novo Um' }, { title: 'Novo Dois' }])
  await goTo(page, 'Catálogo')
  await page.getByRole('button', { name: '☑ Selecionar' }).click()
  await bar(page).getByRole('button', { name: 'Selecionar todos (3)' }).click()
  await expect(page.getByTestId('bulk-count')).toHaveText('3 selecionados')

  await page.locator('.filter-btn', { hasText: 'Não assistidos' }).click()
  await expect(page.getByTestId('bulk-count')).toHaveText('2 selecionados')
  await bar(page).getByRole('button', { name: 'Desmarcar todos' }).click()
  await expect(page.getByTestId('bulk-count')).toHaveText('Clique nos títulos pra selecionar')
  await expect(bar(page).getByRole('button', { name: '✓ Assistido' })).toBeDisabled()
})

test('coloca vários na coleção e na tag, e remove em lote com confirmação', async ({ page }) => {
  await seed(page, [{ title: 'Um' }, { title: 'Dois' }, { title: 'Três' }])
  await page.evaluate(async () => { await window.api.colecoesInsert('Prateleira'); await window.api.tagsInsert('Favoritos') })
  await reloadApp(page)
  await goTo(page, 'Catálogo')
  await page.getByRole('button', { name: '☑ Selecionar' }).click()
  await card(page, 'Um').click()
  await card(page, 'Dois').click()

  await bar(page).getByRole('button', { name: /Coleção/ }).click()
  await page.getByRole('menuitem', { name: 'Prateleira' }).click()
  await expect(page.getByText('2 títulos na coleção "Prateleira".')).toBeVisible()
  await expect(page.locator('.nav-item', { hasText: 'Prateleira' })).toContainText('2')

  await bar(page).getByRole('button', { name: /Tag/ }).click()
  await page.getByRole('menuitem', { name: 'Favoritos' }).click()
  await expect(page.getByText('Tag "Favoritos" em 2 títulos.')).toBeVisible()
  // repetir não duplica
  await bar(page).getByRole('button', { name: /Tag/ }).click()
  await page.getByRole('menuitem', { name: 'Favoritos' }).click()
  expect((await page.evaluate(() => window.api.tagsGetAll())).map(t => [t.name, t.count])).toEqual([['Favoritos', 2]])

  // remover: cancelar não remove nada
  await bar(page).getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Tem certeza que quer remover 2 títulos da sua coleção?', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  expect(await all(page)).toHaveLength(3)

  await bar(page).getByRole('button', { name: 'Remover' }).click()
  await page.getByRole('button', { name: 'Remover', exact: true }).last().click()
  await expect(page.locator('.disc-title-grid')).toHaveText(['Três'])
  await expect(page.getByTestId('bulk-count')).toHaveText('Clique nos títulos pra selecionar')

  // o removido sai também da tag e da coleção (antes a tag seguia contando)
  expect((await page.evaluate(() => window.api.tagsGetAll())).map(t => t.count)).toEqual([0])
  expect((await page.evaluate(() => window.api.colecoesGetAll())).map(c => c.count)).toEqual([0])
})

test('a página não consegue aplicar ação em lote com dados inválidos', async ({ page }) => {
  await seed(page, [{ title: 'Seguro' }])
  const bulk = (p) => page.evaluate((p) => window.api.bulkApply(p).then(() => 'ok', e => e.message), p)
  expect(await bulk({ ids: ['1; DROP TABLE filmes'], action: 'watched' })).toMatch(/Invalid id/)
  expect(await bulk({ ids: [1], action: 'apagarTudo' })).toMatch(/Invalid action/)
  expect(await bulk({ ids: [1], action: 'addTag', targetId: 9999 })).toMatch(/Tag não encontrada/)
  expect(await bulk({ ids: [], action: 'delete' })).toMatch(/Invalid ids/)
  expect(await all(page)).toHaveLength(1)
})
