// Testes de segurança da ponte entre a página e o processo principal (IPC).
// Simulam uma página comprometida chamando window.api com valores maliciosos: o processo principal
// precisa recusar sozinho, sem confiar na interface.
const { test, expect } = require('./support/app')
const fs = require('node:fs')
const path = require('node:path')

const call = (page, fn, arg) => page.evaluate(([f, a]) => window.api[f](a).then(r => ({ ok: true, r }), e => ({ ok: false, e: e.message })), [fn, arg])

const MAL_POSTER = 'https://cdn.myanimelist.net/images/anime/7/42005l.jpg'

test('pôster do MAL: não devolve arquivo fora da pasta de pôsteres (ex: settings.json com as chaves)', async ({ page }) => {
  // settings.json existe na pasta de dados (a fixture grava a chave da TMDB nele, quando há)
  await page.evaluate(() => window.api.saveSettings({ omdbApiKey: 'CHAVE-SECRETA-TESTE' }))
  const r = await call(page, 'malSavePoster', { malId: '../settings', url: 'https://cdn.myanimelist.net/x.json' })
  const leaked = r.ok && r.r ? Buffer.from(r.r.split(',')[1] || '', 'base64').toString() : ''
  expect(leaked).not.toContain('CHAVE-SECRETA-TESTE')
  expect(r.ok ? r.r : null).toBeNull()
})

test('pôster do MAL: recusa caminho com "../", site que não é o do MAL e extensão que não é imagem', async ({ page, userDataDir }) => {
  const outside = path.join(userDataDir, 'escapou.jpg')
  await call(page, 'malSavePoster', { malId: '../escapou', url: MAL_POSTER })
  expect(fs.existsSync(outside)).toBe(false)

  // uso normal continua funcionando
  const normal = await call(page, 'malSavePoster', { malId: 42005, url: MAL_POSTER })
  expect(normal.ok && normal.r).toMatch(/^data:image\/jpg;base64,/)

  const naoMal = await call(page, 'malSavePoster', { malId: 1, url: 'https://example.com/poster.jpg' })
  expect(naoMal.ok ? naoMal.r : null).toBeNull()

  const exe = await call(page, 'malSavePoster', { malId: 2, url: 'https://cdn.myanimelist.net/x/arquivo.exe' })
  expect(exe.ok ? exe.r : null).toBeNull()
  const dir = path.join(userDataDir, 'mal-posters')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  expect(files.filter(f => !/\.(jpe?g|png|webp)$/i.test(f))).toEqual([])
})

test('capa: não lê arquivo fora da pasta de capas', async ({ page, userDataDir }) => {
  fs.writeFileSync(path.join(userDataDir, 'segredo.png'), 'segredo')
  for (const p of [path.join(userDataDir, 'segredo.png'), path.join(userDataDir, 'covers', '..', 'segredo.png'), path.join(userDataDir, 'settings.json')]) {
    const r = await call(page, 'readCover', p)
    expect(r.ok ? r.r : null).toBeNull()
  }
})

test('abrir link externo: só HTTPS e só sites da lista', async ({ page }) => {
  for (const url of ['file:///C:/Windows/System32/calc.exe', 'http://www.themoviedb.org/', 'https://evil.example.com/', 'javascript:alert(1)', 'ms-settings:']) {
    const r = await call(page, 'openExternal', url)
    expect(r.ok, url).toBe(false)
  }
})

test('IDs e entradas inválidas são recusados pelo processo principal', async ({ page }) => {
  const bad = [
    ['delete', '1; DROP TABLE filmes'],
    ['episodesGetWatched', -1],
    ['tagsSetForFilme', { filmeId: 1, tagIds: ['1 OR 1=1'] }],
    ['tagsInsert', 'x'.repeat(51)],
    ['tmdbFindByImdb', '../../etc'],
    ['tmdbWatchProviders', '1 OR 1=1'],
  ]
  for (const [fn, arg] of bad) {
    const r = await call(page, fn, arg)
    expect(r.ok, `${fn}(${JSON.stringify(arg)}) deveria falhar`).toBe(false)
  }
  // e o banco continua inteiro
  expect(Array.isArray(await page.evaluate(() => window.api.getAll()))).toBe(true)
})

test('a página não tem acesso ao Node nem a módulos do sistema', async ({ page }) => {
  const r = await page.evaluate(() => ({
    require: typeof require, process: typeof process, module: typeof module,
    apiIsFrozen: Object.isFrozen(window.api) || !Object.getOwnPropertyDescriptor(window, 'api').writable,
  }))
  expect(r).toEqual({ require: 'undefined', process: 'undefined', module: 'undefined', apiIsFrozen: true })
})
