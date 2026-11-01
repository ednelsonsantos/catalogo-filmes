const { test, expect, goTo, reloadApp } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')

const bg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const themeSource = (electronApp) => electronApp.evaluate(({ nativeTheme }) => nativeTheme.themeSource)

test('tema: escuro por padrão, claro troca na hora e fica salvo ao reabrir', async ({ page, electronApp, userDataDir }) => {
  await goTo(page, 'Configurações')
  await expect(page.getByTestId('theme-dark')).toBeChecked()
  expect(await themeSource(electronApp)).toBe('dark')
  const dark = await bg(page)
  expect(dark).toBe('rgb(15, 15, 15)')

  await page.getByTestId('theme-light').check()
  await expect.poll(() => bg(page)).toBe('rgb(244, 242, 238)')
  expect(await themeSource(electronApp)).toBe('light')
  await expect.poll(() => JSON.parse(fs.readFileSync(path.join(userDataDir, 'settings.json'), 'utf8')).theme).toBe('light')

  await reloadApp(page)
  await goTo(page, 'Configurações')
  await expect(page.getByTestId('theme-light')).toBeChecked()

  // "Seguir o Windows" entrega a decisão ao sistema
  await page.getByTestId('theme-system').check()
  await expect.poll(() => themeSource(electronApp)).toBe('system')

  // valor inválido vindo da página é ignorado
  await page.evaluate(() => window.api.prefsSet({ theme: 'roxo' }))
  expect(await themeSource(electronApp)).toBe('system')
})
