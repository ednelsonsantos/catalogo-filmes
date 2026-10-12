const { test, expect, seed, goTo, openEdit } = require('./support/app')

const chip = (page, name) => page.locator('label.format-check', { hasText: new RegExp(`^${name}✕$`) })

async function createTag(page, name) {
  await page.getByRole('button', { name: '+ Nova' }).last().click()
  const input = page.getByPlaceholder('Nome da tag...')
  await input.fill(name)
  await input.press('Enter')
}

const dbTags = (page) => page.evaluate(() => window.api.tagsGetAll())

test('cria tag no formulário sem duplicar por maiúscula/minúscula e filtra o catálogo', async ({ page }) => {
  await seed(page, [{ title: 'Diário de uma Paixão' }, { title: 'Mad Max' }])

  await openEdit(page, 'Diário de uma Paixão')
  await createTag(page, 'Romance')
  await expect(chip(page, 'Romance')).toHaveClass(/active/)
  await createTag(page, 'romance')
  await expect(page.locator('label.format-check', { hasText: /^romance✕$/i })).toHaveCount(1)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.locator('.disc-card')).toHaveCount(2)

  expect((await dbTags(page)).map(t => [t.name, t.count])).toEqual([['Romance', 1]])

  const tagSelect = page.locator('select.sort-select', { has: page.locator('option', { hasText: 'Todas as tags' }) })
  await tagSelect.selectOption({ label: 'Romance (1)' })
  await expect(page.locator('.disc-title-grid')).toHaveText(['Diário de uma Paixão'])

  await page.getByRole('button', { name: /Limpar filtros/ }).click()
  await expect(page.locator('.disc-card')).toHaveCount(2)
  await expect(tagSelect).toHaveValue('all')
})

test('remove tag pelo ✕ com confirmação (cancelar não remove)', async ({ page }) => {
  await seed(page, [{ title: 'Interestelar' }])
  await openEdit(page, 'Interestelar')
  await createTag(page, 'Ficar')
  await createTag(page, 'Apagar')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.locator('.disc-card')).toHaveCount(1)

  await openEdit(page, 'Interestelar')
  const x = chip(page, 'Apagar').getByRole('button')
  await x.click()
  await expect(chip(page, 'Apagar')).toHaveClass(/active/) // clicar no ✕ não alterna a seleção
  const dialog = page.locator('h3', { hasText: 'Remover tag' }).locator('..')
  await expect(dialog).toContainText('Ela sai de 1 título(s)')

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(chip(page, 'Apagar')).toBeVisible()

  await x.click()
  await dialog.getByRole('button', { name: 'Remover tag' }).click()
  await expect(chip(page, 'Apagar')).toHaveCount(0)
  await expect(chip(page, 'Ficar')).toBeVisible()
  expect((await dbTags(page)).map(t => t.name)).toEqual(['Ficar'])
})
