const { test, expect, seed, goTo, reloadApp } = require('./support/app')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const AdmZip = require('adm-zip')

// Servidor local no lugar da TMDB (o app só aceita esta origem fora do instalado, via CATALOGO_POSTER_ORIGIN)
const PORT = 5298
const ORIGIN = `http://127.0.0.1:${PORT}`
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

let server
let requests = []
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    requests.push(req.url)
    if (req.url.endsWith('.png')) { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(PNG) }
    res.writeHead(404); res.end()
  })
  await new Promise(r => server.listen(PORT, '127.0.0.1', r))
})
test.afterAll(async () => { await new Promise(r => server.close(r)) })
test.beforeEach(() => { requests = [] })

test.use({ appEnv: { CATALOGO_POSTER_ORIGIN: ORIGIN } })

const posterFiles = (userDataDir) => {
  const dir = path.join(userDataDir, 'posters')
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

test('pôster vira arquivo no disco: aparece sem internet, segue a troca de pôster e entra no backup', async ({ page, userDataDir }) => {
  const [filme] = await seed(page, [
    { title: 'Com Pôster', poster_url: `${ORIGIN}/t/p/w500/a.png` },
    { title: 'Host Estranho', poster_url: 'https://exemplo.invalid/x.png' }, // fora da lista: nunca é baixado
  ])
  const sync = () => page.evaluate(() => window.api.posterSync())

  await expect.poll(async () => { await sync(); return posterFiles(userDataDir) }).toEqual([expect.stringMatching(new RegExp(`^${filme.id}-[0-9a-f]{12}\\.png$`))])
  expect(requests).toEqual(['/t/p/w500/a.png'])

  // com o arquivo no disco a imagem vem dele, não do link
  await reloadApp(page)
  await goTo(page, 'Catálogo')
  const img = page.locator('.disc-card', { hasText: 'Com Pôster' }).locator('img').first()
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)
  // já baixado não baixa de novo
  requests = []
  await sync()
  expect(requests).toEqual([])

  // o backup leva os pôsteres junto
  const { file } = await page.evaluate(() => window.api.backupAutoNow())
  const entries = new AdmZip(file).getEntries().map(e => e.entryName)
  expect(entries).toContain(`posters/${posterFiles(userDataDir)[0]}`)

  // trocou o pôster: baixa o novo e apaga o antigo
  const before = posterFiles(userDataDir)
  await page.evaluate(async (id) => {
    const f = (await window.api.getAll()).find(x => x.id === id)
    await window.api.update({ ...f, poster_url: f.poster_url.replace('a.png', 'b.png') })
  }, filme.id)
  await expect.poll(async () => { await sync(); return posterFiles(userDataDir) }).not.toEqual(before)
  expect(posterFiles(userDataDir)).toHaveLength(1)

  // removeu o título: o arquivo vai embora
  await page.evaluate((id) => window.api.delete(id), filme.id)
  await expect.poll(async () => { await sync(); return posterFiles(userDataDir) }).toEqual([])
})

test('o pôster salvo só é lido para o próprio título e link (sem caminho vindo da página)', async ({ page }) => {
  const read = (id, url) => page.evaluate(([id, url]) => window.api.readPoster(id, url), [id, url])
  expect(await read('../settings', `${ORIGIN}/a.png`)).toBeNull()
  expect(await read(1, 'file:///C:/Windows/win.ini')).toBeNull()
  expect(await read(1, 'https://exemplo.invalid/a.png')).toBeNull()
})
