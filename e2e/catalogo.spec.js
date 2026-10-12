const { test, expect, seed, goTo } = require('./support/app')

test('abre com catálogo vazio numa pasta de dados isolada', async ({ page, userDataDir, electronApp }) => {
  const appUserData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  expect(appUserData).toBe(userDataDir)
  await goTo(page, 'Minha Coleção')
  await expect(page.locator('.empty-state')).toContainText('Sua coleção está vazia')
})

test('ordenação "Minha nota": maior primeiro, empate alfabético, sem nota no fim', async ({ page }) => {
  await seed(page, [
    { title: 'Sem Nota' },
    { title: 'Bravo', my_rating: 10 },
    { title: 'Zero', my_rating: 0 },
    { title: 'Alfa', my_rating: 10 },
    { title: 'Meio', my_rating: 5 },
  ])
  await goTo(page, 'Minha Coleção')
  await page.locator('select.sort-select').last().selectOption('myRating')
  await expect(page.locator('.disc-title-grid')).toHaveText(['Alfa', 'Bravo', 'Meio', 'Zero', 'Sem Nota'])
})

// `{numero && <X/>}` renderiza um nó de texto "0" solto no meio dos irmãos — getByText não enxerga isso
function strayZeros(page, selector) {
  return page.evaluate((sel) => {
    const found = []
    for (const root of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const n = walker.currentNode
        if (n.data.trim() === '0' && n.parentElement.childNodes.length > 1) found.push(n.parentElement.className || n.parentElement.tagName)
      }
    }
    return found
  }, selector)
}

test('nenhum "0" solto nos cards nem no detalhe (watching é INTEGER no SQLite)', async ({ page }) => {
  await seed(page, [
    { title: 'Série Assistida', category: 'Série', watched_at: '2025-01-01', watching: false },
    { title: 'Filme Comum', category: 'Filme' },
  ])
  await goTo(page, 'Minha Coleção')
  await expect(page.locator('.disc-card')).toHaveCount(2)
  expect(await strayZeros(page, '.disc-card')).toEqual([])
  await page.locator('.disc-card', { hasText: 'Série Assistida' }).click()
  await expect(page.getByText(/Assistido em/)).toBeVisible()
  expect(await strayZeros(page, '.modal')).toEqual([])
})
