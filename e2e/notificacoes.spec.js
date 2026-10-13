const { test, expect, TMDB_KEY, seed, goTo, runSql, reloadApp } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')

const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const notified = (page) => page.evaluate(() => window.__notified.map(n => `${n.title} | ${n.body}`))

test('avisa episódio de hoje e temporada nova uma vez só, e avisa de novo quando sai mais episódio', async ({ page, electronApp, userDataDir }) => {
  await seed(page, [
    { title: 'Série Assistindo', category: 'Série', watching: true },
    { title: 'Série Terminada', category: 'Série', watched_at: 'watched' },
    { title: 'Série Sem Novidade', category: 'Série', watching: true },
  ])
  await runSql(electronApp, userDataDir, [
    ['UPDATE filmes SET next_episode_air_date = ? WHERE title = ?', localToday(), 'Série Assistindo'],
    ['UPDATE filmes SET episodes_aired = 10 WHERE title = ?', 'Série Terminada'],
    ['UPDATE filmes SET next_episode_air_date = ? WHERE title = ?', '2099-01-01', 'Série Sem Novidade'],
  ])

  await reloadApp(page)
  await expect.poll(() => notified(page)).toEqual([
    '🆕 Novo episódio hoje | Série Assistindo',
    '📺 Nova temporada disponível | Série Terminada',
  ])

  // abrir de novo e voltar pra janela não repete
  await reloadApp(page)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(1000)
  expect(await notified(page)).toEqual([])

  // saiu mais episódio da série terminada: avisa de novo
  await runSql(electronApp, userDataDir, [['UPDATE filmes SET episodes_aired = 12 WHERE title = ?', 'Série Terminada']])
  await reloadApp(page)
  await expect.poll(() => notified(page)).toEqual(['📺 Nova temporada disponível | Série Terminada'])
})

test('opções de segundo plano: bandeja salva e mantém o app rodando ao fechar a janela', async ({ page, electronApp, userDataDir }) => {
  await goTo(page, 'Configurações')
  const tray = page.getByTestId('pref-close-to-tray')
  await expect(tray).not.toBeChecked()
  await expect(page.getByTestId('pref-open-at-login')).toBeDisabled() // só no app instalado

  await tray.check()
  await expect.poll(() => JSON.parse(fs.readFileSync(path.join(userDataDir, 'settings.json'), 'utf8')).closeToTray).toBe(true)

  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  const state = () => electronApp.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0]
    return w ? { exists: !w.isDestroyed(), visible: w.isVisible() } : { exists: false }
  })
  await expect.poll(state).toEqual({ exists: true, visible: false })

  // clicar no aviso / no ícone da bandeja traz a janela de volta
  await page.evaluate(() => window.api.appShow())
  await expect.poll(state).toEqual({ exists: true, visible: true })

  // continua marcado ao reabrir as configurações
  await reloadApp(page)
  await goTo(page, 'Configurações')
  await expect(page.getByTestId('pref-close-to-tray')).toBeChecked()
})

test.describe('com a TMDB', () => {
  test.skip(!TMDB_KEY, 'precisa da chave da TMDB (variável TMDB_API_KEY ou configurada no app)')

  test('atualiza sozinha as séries acompanhadas e não confunde "Assistido" antigo com temporada nova', async ({ page }) => {
    await seed(page, [{ title: 'Smallville', category: 'Série', tmdb_id: '4604', tmdb_media_type: 'tv', watched_at: 'watched' }])
    await expect.poll(async () => {
      const [f] = await page.evaluate(() => window.api.getAll())
      return f.episodes_aired > 200 && f.episodes_watched_count === f.episodes_aired
    }, { timeout: 30_000 }).toBe(true)
    await page.waitForTimeout(500)
    expect(await notified(page)).toEqual([])
  })
})
