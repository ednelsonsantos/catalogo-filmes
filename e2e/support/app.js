const { test: base, expect, _electron: electron } = require('@playwright/test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const DEV_URL = 'http://localhost:5199'

// Chave da TMDB: variável de ambiente ou a configuração local do app (só a chave é copiada pra pasta de teste)
function findTmdbKey() {
  if (process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY
  const appData = process.env.APPDATA || path.join(os.homedir(), '.config')
  try {
    return JSON.parse(fs.readFileSync(path.join(appData, 'catalogo-filmes', 'settings.json'), 'utf8')).tmdbApiKey || ''
  } catch { return '' }
}

const TMDB_KEY = findTmdbKey()

const test = base.extend({
  // variáveis de ambiente extras pro processo do app (ex: CATALOGO_UPDATE_FEED)
  appEnv: [{}, { option: true }],

  // eslint-disable-next-line no-empty-pattern
  userDataDir: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogo-e2e-'))
    if (TMDB_KEY) fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ tmdbApiKey: TMDB_KEY }))
    await use(dir)
    fs.rmSync(dir, { recursive: true, force: true })
  },

  electronApp: async ({ userDataDir, appEnv }, use) => {
    const env = { ...process.env, VITE_DEV_URL: DEV_URL, CATALOGO_USER_DATA: userDataDir, ...appEnv }
    delete env.ELECTRON_RUN_AS_NODE
    const app = await electron.launch({ args: ['.'], cwd: ROOT, env })
    // avisos do Windows viram registro em window.__notified (nada aparece na área de trabalho durante os testes).
    // Vale a partir do próximo carregamento — o primeiro é com o banco vazio, sem nada a avisar
    await app.context().addInitScript(() => {
      window.__notified = []
      window.Notification = class {
        static permission = 'granted'
        constructor(title, opts) { window.__notified.push({ title, body: opts?.body }) }
      }
    })
    await use(app)
    await app.close()
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.locator('.app-layout').waitFor({ timeout: 30_000 })
    await use(page)
  },
})

const EMPTY_FILME = {
  title: '', original_title: '', year: null, format: 'DVD', formats: 'DVD', watched_at: '', watching: false,
  genre: '', director: '', cast: '', runtime: '', imdb_rating: '', imdb_id: '', synopsis: '',
  poster_url: '', cover_path: null, language: '', country: '', category: 'Filme', tmdb_id: '',
  tmdb_media_type: '', my_rating: null,
}

// Cria títulos pela própria API do app e recarrega a interface pra ela ler o banco de novo
async function seed(page, filmes) {
  const saved = await page.evaluate(async (items) => {
    const out = []
    for (const f of items) out.push(await window.api.insert(f))
    return out
  }, filmes.map(f => ({ ...EMPTY_FILME, ...f })))
  await page.reload()
  await page.locator('.app-layout').waitFor({ timeout: 30_000 })
  return saved
}

async function goTo(page, navLabel) {
  await page.locator('.nav-item', { hasText: navLabel }).first().click()
}

async function openDetail(page, title) {
  await goTo(page, 'Minha Coleção')
  await page.locator('.disc-card', { hasText: title }).first().click()
}

async function openEdit(page, title) {
  await openDetail(page, title)
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.locator('h1.page-title')).toHaveText(`Editar: ${title}`)
}

// SQL direto no banco de teste, pelo processo principal — pra montar estados que a interface não cria sozinha
async function runSql(electronApp, userDataDir, statements) {
  await electronApp.evaluate(({ app }, { dbPath, statements }) => {
    const { createRequire } = process.getBuiltinModule('module')
    const Database = createRequire(app.getAppPath() + '/')('better-sqlite3')
    const db = new Database(dbPath)
    for (const [sql, ...params] of statements) db.prepare(sql).run(...params)
    db.close()
  }, { dbPath: path.join(userDataDir, 'catalogo.db'), statements })
}

async function reloadApp(page) {
  await page.reload()
  await page.locator('.app-layout').waitFor({ timeout: 30_000 })
}

function nextUpSelects(page) {
  return page.locator('span', { hasText: 'Próximo a assistir:' }).locator('..').locator('select')
}

// [temporada, episódio] do seletor "Próximo a assistir", pra usar com expect.poll
function nextUpValues(page) {
  return () => nextUpSelects(page).evaluateAll(els => els.map(e => e.value))
}

module.exports = { test, expect, TMDB_KEY, seed, goTo, openDetail, openEdit, nextUpSelects, nextUpValues, runSql, reloadApp }
