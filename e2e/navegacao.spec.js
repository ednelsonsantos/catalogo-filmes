const { test, expect, seed, goTo } = require('./support/app')

const detailTitle = (page) => page.locator('.modal h2').first()

test('← → no detalhe percorrem a lista como está na tela (filtros e ordenação) e param nas pontas', async ({ page }) => {
  await seed(page, [
    { title: 'Alfa', formats: 'DVD' },
    { title: 'Beta', formats: 'Digital' },
    { title: 'Gama', formats: 'DVD' },
    { title: 'Delta', formats: 'DVD' },
  ])
  await goTo(page, 'Catálogo')
  await page.getByTestId('format-filter').selectOption('DVD') // A→Z: Alfa, Delta, Gama (Beta fica de fora)
  await page.locator('.disc-card', { hasText: 'Alfa' }).click()
  await expect(detailTitle(page)).toHaveText('Alfa')
  await expect(page.getByTestId('detail-position')).toHaveText('1 de 3')
  await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled()

  await page.keyboard.press('ArrowRight')
  await expect(detailTitle(page)).toHaveText('Delta')
  await page.getByRole('button', { name: 'Próximo' }).click()
  await expect(detailTitle(page)).toHaveText('Gama')
  await expect(page.getByTestId('detail-position')).toHaveText('3 de 3')
  await page.keyboard.press('ArrowRight') // última: não passa
  await expect(detailTitle(page)).toHaveText('Gama')
  await page.keyboard.press('ArrowLeft')
  await expect(detailTitle(page)).toHaveText('Delta')
  await page.keyboard.press('Escape')
  await expect(page.locator('.modal')).toHaveCount(0)
})

test('"Sortear" abre um título ao acaso só entre os que estão na lista', async ({ page }) => {
  await seed(page, [
    { title: 'Visto 1', watched_at: 'watched' },
    { title: 'Visto 2', watched_at: 'watched' },
    { title: 'Na fila A' },
    { title: 'Na fila B' },
  ])
  await goTo(page, 'Catálogo')
  await page.locator('.filter-btn', { hasText: 'Não assistidos' }).click()
  const seen = new Set()
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /Sortear/ }).click()
    const title = await detailTitle(page).innerText()
    seen.add(title)
    await page.keyboard.press('Escape')
  }
  expect([...seen].sort()).toEqual(['Na fila A', 'Na fila B']) // nunca um assistido; e não repete o último sorteado
  // lista vazia: nada pra sortear
  await page.locator('.search-input').fill('nada com esse nome')
  await expect(page.getByRole('button', { name: /Sortear/ })).toBeDisabled()
})
