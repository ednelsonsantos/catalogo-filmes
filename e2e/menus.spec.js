const { test, expect, seed, goTo, reloadApp } = require('./support/app')

// clica num item do menu da janela pelo id, como se fosse pelo mouse
async function clickMenu(electronApp, id) {
  await electronApp.evaluate(({ Menu, BrowserWindow }, id) => {
    Menu.getApplicationMenu().getMenuItemById(id).click(undefined, BrowserWindow.getAllWindows()[0])
  }, id)
}

test('menu da janela em português, com as ações do app e sem o "Help" do Electron', async ({ page, electronApp }) => {
  await page.locator('.app-layout').waitFor() // o menu é montado durante a abertura do app
  const menu = await electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => ({
    label: i.label, items: i.submenu.items.filter(s => s.type !== 'separator').map(s => s.label),
  })))
  expect(menu.map(m => m.label.replace('&', ''))).toEqual(['Arquivo', 'Editar', 'Exibir', 'Ajuda'])
  expect(menu[0].items).toEqual(['Adicionar título', 'Importar lista…', 'Exportar', 'Salvar backup em…', 'Configurações', 'Sair'])
  expect(menu[2].items.slice(0, 5)).toEqual(['Catálogo', 'Assistindo', 'Estatísticas', 'MyAnimeList', 'Buscar no catálogo'])
  expect(menu[3].items).toContain('Verificar atualizações')
  expect(menu[3].items).toContain('Sobre o Meu Catálogo')
})

test('itens do menu da janela navegam e abrem as ações do catálogo', async ({ page, electronApp }) => {
  await seed(page, [{ title: 'Alien' }])
  await clickMenu(electronApp, 'page:stats')
  await expect(page.locator('h1.page-title')).toHaveText('Estatísticas')
  await clickMenu(electronApp, 'add')
  await expect(page.locator('h1.page-title')).toHaveText('Adicionar')
  // de outra tela, "Importar lista…" volta pro catálogo e abre a importação
  await clickMenu(electronApp, 'import')
  await expect(page.getByRole('button', { name: /Escolher arquivo/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /Escolher arquivo/ })).toHaveCount(0)
  // sair e voltar pro catálogo não repete a ação antiga
  await goTo(page, 'Estatísticas')
  await goTo(page, 'Catálogo')
  await expect(page.getByRole('button', { name: /Escolher arquivo/ })).toHaveCount(0)
  await clickMenu(electronApp, 'search')
  await expect(page.locator('.search-input')).toBeFocused()
})

test('menu lateral: Catálogo e Assistindo fixos; MyAnimeList só com o MAL configurado', async ({ page }) => {
  const labels = () => page.locator('.sidebar-nav > .nav-item > span:not(.nav-count)').allInnerTexts()
  await expect.poll(labels).toEqual(['Catálogo', 'Assistindo', 'Estatísticas'])
  await page.evaluate(() => window.api.saveSettings({ malClientId: 'abc123' }))
  await reloadApp(page)
  await expect.poll(labels).toEqual(['Catálogo', 'Assistindo', 'MyAnimeList', 'Estatísticas'])
})

test('topo do catálogo resume a coleção e o "Não assistidos" filtra o que falta ver', async ({ page }) => {
  await seed(page, [
    { title: 'Visto', formats: 'Digital', watched_at: 'watched' },
    { title: 'Em andamento', category: 'Série', formats: 'Digital', watching: true },
    { title: 'Na fila', formats: 'DVD' },
  ])
  await goTo(page, 'Catálogo')
  await expect(page.getByTestId('catalog-counts')).toHaveText('3 títulos · 1 assistido (33%) · 1 assistindo')
  await page.locator('.filter-btn', { hasText: 'Não assistidos' }).click()
  await expect(page.locator('.disc-card', { hasText: 'Visto' })).toHaveCount(0)
  await expect(page.locator('.disc-card')).toHaveCount(2)
  // formato virou lista suspensa, com a contagem de cada um (Digital incluído)
  const format = page.getByTestId('format-filter')
  await expect(format.locator('option', { hasText: 'Digital (2)' })).toHaveCount(1)
  await format.selectOption('DVD')
  await expect(page.locator('.disc-card')).toHaveCount(1)
  await expect(page.locator('.disc-card')).toContainText('Na fila')
})

test('filtros, ordenação e grade/lista continuam como estavam ao reabrir o app (a busca não)', async ({ page }) => {
  await seed(page, [{ title: 'A', formats: 'DVD' }, { title: 'B', formats: 'Digital', watched_at: 'watched' }])
  await goTo(page, 'Catálogo')
  await page.locator('.filter-btn', { hasText: 'Não assistidos' }).click()
  await page.getByTestId('format-filter').selectOption('DVD')
  await page.locator('.sort-select').last().selectOption('added')
  await page.locator('.view-toggle button').nth(1).click()
  await page.locator('.search-input').fill('zzz')

  await reloadApp(page)
  await goTo(page, 'Catálogo')
  await expect(page.locator('.filter-btn.active')).toHaveText('Não assistidos')
  await expect(page.getByTestId('format-filter')).toHaveValue('DVD')
  await expect(page.locator('.sort-select').last()).toHaveValue('added')
  await expect(page.locator('.disc-list')).toBeVisible()
  await expect(page.locator('.search-input')).toHaveValue('')
  await expect(page.locator('.disc-list-item')).toHaveCount(1)
  // e "Limpar filtros" aparece, pra não esconder títulos sem o usuário perceber
  await page.getByRole('button', { name: /Limpar filtros/ }).click()
  await expect(page.locator('.disc-list-item')).toHaveCount(2)
})

test('menu lateral com coleções não gera HTML inválido (botão dentro de botão) e a coleção abre pelo teclado', async ({ page }) => {
  const errors = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.evaluate(() => window.api.colecoesInsert('Favoritos'))
  await reloadApp(page)
  const col = page.locator('.col-nav-item', { hasText: 'Favoritos' })
  await col.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('h1.page-title')).toHaveText('Favoritos')
  expect(errors.filter(e => e.includes('validateDOMNesting'))).toEqual([])
})
