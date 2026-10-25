const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

// Testes automatizados rodam com uma pasta de dados descartável, nunca com o catálogo real
if (!app.isPackaged && process.env.CATALOGO_USER_DATA) {
  app.setPath('userData', process.env.CATALOGO_USER_DATA)
} else if (!app.isPackaged) {
  // npm run dev usa o catálogo real (mesma pasta do app instalado), mas o cache/sessão do Chromium fica à parte:
  // com o app instalado aberto na bandeja, os dois disputavam a pasta de cache ("Unable to create cache", "Acesso negado")
  app.setPath('sessionData', path.join(app.getPath('userData'), 'dev-session'))
}

let mainWindow
let db

// API keys kept only in main process — never cross IPC
let _omdbKey = ''
let _tmdbKey = ''

// MAL OAuth state — kept only in main process
let _malClientId       = ''
let _malAccessToken    = ''
let _malRefreshToken   = ''
let _malTokenExpiry    = 0     // epoch ms
let _malAuthState      = ''    // PKCE state
let _malCodeVerifier   = ''    // PKCE verifier
let _malCallbackServer = null  // HTTP server for OAuth redirect

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0
}

function sanitizeExt(ext) {
  return String(ext || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'jpg'
}

function getFilmeById(id) {
  return db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM episodios_assistidos e WHERE e.filme_id = f.id) AS episodes_watched_count
    FROM filmes f WHERE f.id = ?
  `).get(id)
}

function assertCoversPath(filePath) {
  const coversDir = path.resolve(path.join(app.getPath('userData'), 'covers'))
  const resolved  = path.resolve(filePath)
  if (!resolved.startsWith(coversDir + path.sep) && resolved !== coversDir) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

// ─── MAL HELPERS ──────────────────────────────────────────────────────────────

function generatePKCE() {
  const crypto = require('crypto')
  const verifier = crypto.randomBytes(48).toString('base64url')
  // MAL uses plain (no S256) for the challenge
  return { verifier, challenge: verifier }
}

function generateState() {
  return require('crypto').randomBytes(16).toString('hex')
}

function malFetch(url, options = {}) {
  const https = require('https')
  const { method = 'GET', headers = {}, body } = options
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = { raw: data } }
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function malRefreshIfNeeded() {
  if (!_malRefreshToken) throw new Error('MAL não autenticado')
  if (Date.now() < _malTokenExpiry - 60_000) return  // still valid
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: _malRefreshToken,
    client_id:     _malClientId,
  }).toString()
  const res = await malFetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status !== 200) throw new Error('Falha ao renovar token MAL')
  _malAccessToken  = res.body.access_token
  _malRefreshToken = res.body.refresh_token
  _malTokenExpiry  = Date.now() + res.body.expires_in * 1000
  _saveMalTokens()
}

function _saveMalTokens() {
  const p = require('path').join(app.getPath('userData'), 'settings.json')
  const fs = require('fs')
  let existing = {}
  try { if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}
  fs.writeFileSync(p, JSON.stringify({
    ...existing,
    malAccessToken:  _malAccessToken,
    malRefreshToken: _malRefreshToken,
    malTokenExpiry:  _malTokenExpiry,
  }, null, 2))
}

function omdbFetch(url) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('Parse error')) } })
    }).on('error', reject)
  })
}

// ─── DATABASE ─────────────────────────────────────────────────────────────────

function createDatabase() {
  const Database = require('better-sqlite3')
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'catalogo.db')

  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS filmes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_title TEXT,
      year INTEGER,
      format TEXT DEFAULT 'DVD',
      formats TEXT DEFAULT '',
      watched_at TEXT,
      watching INTEGER DEFAULT 0,
      genre TEXT,
      director TEXT,
      cast TEXT,
      runtime TEXT,
      imdb_rating TEXT,
      imdb_id TEXT,
      synopsis TEXT,
      poster_url TEXT,
      cover_path TEXT,
      language TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)

  const columns = db.prepare('PRAGMA table_info(filmes)').all().map(c => c.name)
  if (!columns.includes('formats'))    db.exec("ALTER TABLE filmes ADD COLUMN formats TEXT DEFAULT ''")
  if (!columns.includes('watched_at')) db.exec('ALTER TABLE filmes ADD COLUMN watched_at TEXT')
  if (!columns.includes('category'))   db.exec("ALTER TABLE filmes ADD COLUMN category TEXT DEFAULT ''")
  if (!columns.includes('tmdb_id'))    db.exec("ALTER TABLE filmes ADD COLUMN tmdb_id TEXT DEFAULT ''")
  if (!columns.includes('watching'))   db.exec('ALTER TABLE filmes ADD COLUMN watching INTEGER DEFAULT 0')
  if (!columns.includes('episodes_aired'))        db.exec('ALTER TABLE filmes ADD COLUMN episodes_aired INTEGER')
  if (!columns.includes('next_episode_air_date'))  db.exec('ALTER TABLE filmes ADD COLUMN next_episode_air_date TEXT')
  if (!columns.includes('last_episode_check'))     db.exec('ALTER TABLE filmes ADD COLUMN last_episode_check TEXT')
  if (!columns.includes('tmdb_media_type')) {
    db.exec("ALTER TABLE filmes ADD COLUMN tmdb_media_type TEXT DEFAULT ''")
    // Backfill: itens que já usam a trilha de episódios (categoria seriada + tmdb_id) quase certamente
    // têm um ID de série (/tv/), já que é assim que o app sempre buscou episódios até aqui
    db.exec(`
      UPDATE filmes SET tmdb_media_type = 'tv'
      WHERE tmdb_media_type = '' AND tmdb_id != '' AND category IN ('Série','Mini-série','Anime','Animação')
    `)
  }
  if (!columns.includes('my_rating')) db.exec('ALTER TABLE filmes ADD COLUMN my_rating INTEGER')
  // cache do "Onde assistir": JSON [{id,name,logo}], NULL = nunca verificado
  if (!columns.includes('providers'))            db.exec('ALTER TABLE filmes ADD COLUMN providers TEXT')
  if (!columns.includes('providers_checked_at')) db.exec('ALTER TABLE filmes ADD COLUMN providers_checked_at TEXT')

  db.exec(`
    CREATE TABLE IF NOT EXISTS episodios_assistidos (
      filme_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      watched_at TEXT,
      PRIMARY KEY (filme_id, season_number, episode_number)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS colecoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS filme_colecao (
      filme_id INTEGER NOT NULL,
      colecao_id INTEGER NOT NULL,
      PRIMARY KEY (filme_id, colecao_id)
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS filme_tag (
      filme_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (filme_id, tag_id)
    )
  `)

  // Tags que só diferem em maiúsculas/minúsculas ("Romance"/"romance") viram uma só: fica a mais antiga
  db.transaction(() => {
    const dupes = db.prepare(`
      SELECT t.id AS dupId, (SELECT MIN(k.id) FROM tags k WHERE k.name = t.name COLLATE NOCASE) AS keepId
      FROM tags t
    `).all().filter(r => r.dupId !== r.keepId)
    for (const { dupId, keepId } of dupes) {
      db.prepare('INSERT OR IGNORE INTO filme_tag (filme_id, tag_id) SELECT filme_id, ? FROM filme_tag WHERE tag_id = ?').run(keepId, dupId)
      db.prepare('DELETE FROM filme_tag WHERE tag_id = ?').run(dupId)
      db.prepare('DELETE FROM tags WHERE id = ?').run(dupId)
    }
  })()
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)')

  // Filmes buscados pela TMDB antes da v1.3.1 ficaram sem tipo; a busca de série nunca preenche imdb_id
  db.prepare(`
    UPDATE filmes SET tmdb_media_type = 'movie'
    WHERE tmdb_media_type = '' AND tmdb_id != '' AND COALESCE(imdb_id, '') != ''
      AND category NOT IN ('Série','Mini-série','Anime','Animação')
  `).run()
}

// ─── WINDOW ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Meu Catálogo',
    icon: path.join(__dirname, '../icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f0f0f',
    show: false,
  })

  // Content Security Policy — só aplicado em produção; dev usa o Vite sem restrições
  if (app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://image.tmdb.org https://img.omdbapi.com https://m.media-amazon.com",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; ')
          ],
        },
      })
    })
  }

  // Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url)
    const isDev = !app.isPackaged
    const allowedOrigins = isDev
      ? ['http://localhost:', 'http://127.0.0.1:']
      : [`file://${path.join(__dirname, '../dist')}`]
    const allowed = allowedOrigins.some(o => url.startsWith(o))
    if (!allowed) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const isDev = !app.isPackaged

  if (isDev) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(devUrl)) {
      throw new Error(`Invalid VITE_DEV_URL: ${devUrl}`)
    }
    mainWindow.loadURL(devUrl).catch(err => console.error('loadURL error:', err))
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // iniciado com o Windows ("--hidden"): fica só na bandeja até o usuário abrir
  const startHidden = process.argv.includes('--hidden')
  mainWindow.once('ready-to-show', () => { if (startHidden) ensureTray(); else mainWindow.show() })

  mainWindow.on('close', (e) => {
    if (_prefs.closeToTray && !_isQuitting) {
      e.preventDefault()
      mainWindow.hide()
      ensureTray()
    }
  })
}

// ─── SEGUNDO PLANO: bandeja, iniciar com o Windows ────────────────────────────

let _prefs = { closeToTray: false, openAtLogin: false, autoBackup: true }
let _tray = null
let _isQuitting = false

function readSettingsFile() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')) } catch { return {} }
}

function loadPrefs() {
  const s = readSettingsFile()
  _prefs = {
    closeToTray: !!s.closeToTray,
    openAtLogin: !!s.openAtLogin,
    autoBackup: s.autoBackup !== false, // ligado por padrão
    backupDir: typeof s.backupDir === 'string' && s.backupDir ? s.backupDir : null,
    lastBackupAt: typeof s.lastBackupAt === 'string' ? s.lastBackupAt : null,
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function ensureTray() {
  if (_tray) return
  const icon = nativeImage.createFromPath(path.join(__dirname, '../icon.png')).resize({ width: 16, height: 16 })
  _tray = new Tray(icon)
  _tray.setToolTip('Meu Catálogo')
  _tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Meu Catálogo', click: showMainWindow },
    { type: 'separator' },
    { label: 'Sair', click: () => { _isQuitting = true; app.quit() } },
  ]))
  _tray.on('click', showMainWindow)
}

ipcMain.handle('prefs:get', () => ({ ..._prefs, canOpenAtLogin: app.isPackaged }))

function savePrefs() {
  const p = path.join(app.getPath('userData'), 'settings.json')
  fs.writeFileSync(p, JSON.stringify({ ...readSettingsFile(), ..._prefs }, null, 2))
}

ipcMain.handle('prefs:set', (_, patch) => {
  const next = { ..._prefs }
  for (const key of ['closeToTray', 'openAtLogin', 'autoBackup']) {
    if (key in (patch || {})) next[key] = !!patch[key]
  }
  _prefs = next
  savePrefs()
  // só no app instalado: em dev registraria o electron.exe do projeto pra abrir com o Windows
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: _prefs.openAtLogin, args: ['--hidden'] })
  return { ..._prefs, canOpenAtLogin: app.isPackaged }
})

ipcMain.handle('app:show', () => showMainWindow())

// ─── MENU DA JANELA ───────────────────────────────────────────────────────────
// Em português e com as ações do app; o padrão do Electron vinha em inglês, com Reload/DevTools no app instalado
// e um "Help" que levava ao site do Electron. As ações da página vão pelo canal 'menu:action'.

const PROJECT_URL = 'https://github.com/ednelsonsantos/catalogo-filmes'

function sendMenuAction(action) {
  showMainWindow()
  mainWindow?.webContents.send('menu:action', action)
}

function buildAppMenu() {
  const act = (id, label, accelerator) => ({ id, label, accelerator, click: () => sendMenuAction(id) })
  const template = [
    {
      label: '&Arquivo',
      submenu: [
        act('add', 'Adicionar título', 'CmdOrCtrl+N'),
        act('import', 'Importar lista…'),
        {
          label: 'Exportar',
          submenu: [act('export:csv', 'CSV'), act('export:xlsx', 'Excel'), act('export:site', 'Site (JSON)')],
        },
        { type: 'separator' },
        act('backup', 'Salvar backup em…'),
        { type: 'separator' },
        act('settings', 'Configurações', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { label: 'Sair', role: 'quit' },
      ],
    },
    {
      label: '&Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' },
      ],
    },
    {
      label: 'E&xibir',
      submenu: [
        act('page:catalog', 'Catálogo', 'CmdOrCtrl+1'),
        act('page:continue', 'Assistindo', 'CmdOrCtrl+2'),
        act('page:stats', 'Estatísticas', 'CmdOrCtrl+3'),
        act('page:animes', 'MyAnimeList', 'CmdOrCtrl+4'),
        { type: 'separator' },
        act('search', 'Buscar no catálogo', 'CmdOrCtrl+F'),
        { type: 'separator' },
        { label: 'Aumentar zoom', role: 'zoomIn' },
        { label: 'Diminuir zoom', role: 'zoomOut' },
        { label: 'Tamanho normal', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tela cheia', role: 'togglefullscreen' },
        // ferramentas de desenvolvimento só fora do app instalado
        ...(app.isPackaged ? [] : [
          { type: 'separator' },
          { label: 'Recarregar', role: 'reload' },
          { label: 'Ferramentas do desenvolvedor', role: 'toggleDevTools' },
        ]),
      ],
    },
    {
      label: 'A&juda',
      submenu: [
        act('check-updates', 'Verificar atualizações'),
        { label: 'Novidades das versões', click: () => shell.openExternal(`${PROJECT_URL}/releases`) },
        { label: 'Página do projeto', click: () => shell.openExternal(PROJECT_URL) },
        { type: 'separator' },
        {
          id: 'about',
          label: 'Sobre o Meu Catálogo',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Sobre o Meu Catálogo',
            message: `Meu Catálogo ${app.getVersion()}`,
            detail: 'Catálogo pessoal de filmes, séries e animes — os dados ficam só no seu computador.\n\nDados de títulos: TMDB e OMDb. Animes: MyAnimeList.',
            buttons: ['OK'],
          }),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.commandLine.appendSwitch('disable-features', 'Autofill')
// Sem isso o Windows não exibe as notificações do app (precisa bater com o appId do atalho do instalador).
// Fora do app instalado usa outro id: com o mesmo, o Electron do npm run dev criou um "Electron.lnk" no Menu Iniciar
// com o id do app instalado, e a barra de tarefas/avisos do app instalado passaram a mostrar o ícone do Electron
if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.ednelson.meu-catalogo' : 'com.ednelson.meu-catalogo.dev')

// ─── ATUALIZAÇÃO AUTOMÁTICA ───────────────────────────────────────────────────
// Busca novas versões nos releases do GitHub (config "publish" do package.json).
// Fora do app instalado fica desligada, exceto com CATALOGO_UPDATE_FEED (servidor local de teste).

let _autoUpdater = null
let _updateStatus = { state: 'idle' }

// o erro do electron-updater traz stack e cabeçalhos HTTP; pra tela basta a primeira linha
const shortUpdateError = (err) => {
  const msg = String(err?.message || err)
  if (/No published versions/i.test(msg)) return 'nenhuma versão publicada no GitHub ainda.'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(msg)) return 'sem conexão com o servidor de atualizações.'
  return msg.split('\n')[0].slice(0, 160)
}

function sendUpdateStatus(status) {
  _updateStatus = status
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', status)
}

function setupAutoUpdater() {
  const devFeed = !app.isPackaged && process.env.CATALOGO_UPDATE_FEED
  if (!app.isPackaged && !devFeed) return
  const { autoUpdater } = require('electron-updater')
  if (devFeed) {
    // o download lê a config do disco (nome da pasta de cache), não só a URL — gera uma na pasta de dados
    const configPath = path.join(app.getPath('userData'), 'dev-app-update.yml')
    fs.writeFileSync(configPath, `provider: generic\nurl: ${JSON.stringify(devFeed)}\nupdaterCacheDirName: catalogo-filmes-updater-test\n`)
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.updateConfigPath = configPath
  }
  autoUpdater.autoDownload = true
  // com o servidor de teste nunca instala nada ao fechar
  autoUpdater.autoInstallOnAppQuit = !devFeed
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'up-to-date' }))
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => sendUpdateStatus({ ..._updateStatus, state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => sendUpdateStatus({ state: 'error', message: shortUpdateError(err) }))
  _autoUpdater = autoUpdater
}

ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('updater:getStatus', () => ({ enabled: !!_autoUpdater, ..._updateStatus }))

ipcMain.handle('updater:check', async () => {
  if (!_autoUpdater) return { enabled: false, state: 'idle' }
  if (_updateStatus.state === 'downloading' || _updateStatus.state === 'ready') return { enabled: true, ..._updateStatus }
  try { await _autoUpdater.checkForUpdates() } catch (err) { sendUpdateStatus({ state: 'error', message: shortUpdateError(err) }) }
  return { enabled: true, ..._updateStatus }
})

ipcMain.handle('updater:install', () => {
  if (!_autoUpdater || _updateStatus.state !== 'ready') return false
  // fecha o app, roda o instalador da nova versão e abre de novo
  _isQuitting = true // senão o "continuar na bandeja" barra o fechamento e a instalação não roda
  setImmediate(() => _autoUpdater.quitAndInstall(false, true))
  return true
})

// App instalado: abrir de novo (atalho, menu Iniciar) traz a janela existente em vez de abrir outra cópia —
// importante com o app escondido na bandeja. Em dev não, pra poder rodar junto do app instalado.
if (app.isPackaged && !app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', () => showMainWindow())

app.whenReady().then(() => {
  loadPrefs()
  createDatabase()
  buildAppMenu()
  createWindow()
  setupAutoUpdater()
  // espera a janela carregar pra não disputar rede/CPU com a abertura do app
  if (_autoUpdater) setTimeout(() => { _autoUpdater.checkForUpdates().catch(() => {}) }, 5000)
}).catch(err => console.error('Falha na inicialização:', err))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  _isQuitting = true
  if (_malCallbackServer) {
    try { _malCallbackServer.close() } catch {}
    _malCallbackServer = null
  }
  if (db) {
    try { db.close() } catch {}
  }
})

// ─── IPC: FILMES ──────────────────────────────────────────────────────────────

ipcMain.handle('db:getAll', () =>
  db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM episodios_assistidos e WHERE e.filme_id = f.id) AS episodes_watched_count
    FROM filmes f ORDER BY f.title COLLATE NOCASE
  `).all()
)

ipcMain.handle('stats:episodesByMonth', () =>
  db.prepare(`
    SELECT substr(watched_at, 1, 7) AS month, COUNT(*) AS count
    FROM episodios_assistidos WHERE watched_at IS NOT NULL GROUP BY month
  `).all()
)

// Campos opcionais: um título preenchido à mão não traz imdb_id/tmdb_id e o SQLite recusa parâmetro ausente
const FILME_INSERT_DEFAULTS = {
  original_title: '', year: null, format: '', formats: '', watched_at: '', watching: false,
  genre: '', director: '', cast: '', runtime: '', imdb_rating: '', imdb_id: '', synopsis: '',
  poster_url: '', cover_path: null, language: '', country: '', category: '', tmdb_id: '',
  tmdb_media_type: '', my_rating: null,
}

ipcMain.handle('db:insert', (_, input) => {
  const filme = { ...FILME_INSERT_DEFAULTS, ...input }
  const stmt = db.prepare(`
    INSERT INTO filmes (title, original_title, year, format, formats, watched_at, watching,
      genre, director, cast, runtime, imdb_rating, imdb_id, synopsis,
      poster_url, cover_path, language, country, category, tmdb_id, tmdb_media_type, my_rating)
    VALUES (@title, @original_title, @year, @format, @formats, @watched_at, @watching,
      @genre, @director, @cast, @runtime, @imdb_rating, @imdb_id, @synopsis,
      @poster_url, @cover_path, @language, @country, @category, @tmdb_id, @tmdb_media_type, @my_rating)
  `)
  const result = stmt.run({
    ...filme,
    watching: filme.watching ? 1 : 0,
    tmdb_media_type: filme.tmdb_media_type || '',
    my_rating: filme.my_rating === '' || filme.my_rating == null ? null : Number(filme.my_rating),
  })
  return getFilmeById(result.lastInsertRowid)
})

ipcMain.handle('db:update', (_, filme) => {
  if (!isPositiveInt(filme.id)) throw new Error('Invalid filme ID')
  db.prepare(`
    UPDATE filmes SET title=@title, original_title=@original_title, year=@year,
      format=@format, formats=@formats, watched_at=@watched_at, watching=@watching,
      genre=@genre, director=@director, cast=@cast, runtime=@runtime,
      imdb_rating=@imdb_rating, imdb_id=@imdb_id, synopsis=@synopsis, poster_url=@poster_url,
      language=@language, country=@country, category=@category, tmdb_id=@tmdb_id,
      tmdb_media_type=@tmdb_media_type, my_rating=@my_rating,
      -- vínculo com a TMDB mudou: o cache do "Onde assistir" era de outro título
      providers = CASE WHEN COALESCE(tmdb_id, '') = COALESCE(@tmdb_id, '') THEN providers ELSE NULL END,
      providers_checked_at = CASE WHEN COALESCE(tmdb_id, '') = COALESCE(@tmdb_id, '') THEN providers_checked_at ELSE NULL END
    WHERE id=@id
  `).run({
    ...filme,
    watching: filme.watching ? 1 : 0,
    tmdb_media_type: filme.tmdb_media_type || '',
    my_rating: filme.my_rating === '' || filme.my_rating == null ? null : Number(filme.my_rating),
  })
  return getFilmeById(filme.id)
})

ipcMain.handle('db:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  db.prepare('DELETE FROM filme_colecao WHERE filme_id = ?').run(id)
  db.prepare('DELETE FROM filmes WHERE id = ?').run(id)
  return true
})

// ─── IPC: COLEÇÕES ────────────────────────────────────────────────────────────

ipcMain.handle('colecoes:getAll', () =>
  db.prepare(`
    SELECT c.id, c.name, COUNT(fc.filme_id) AS count
    FROM colecoes c LEFT JOIN filme_colecao fc ON fc.colecao_id = c.id
    GROUP BY c.id ORDER BY c.name COLLATE NOCASE
  `).all()
)

ipcMain.handle('colecoes:insert', (_, name) => {
  const n = String(name || '').trim()
  if (!n || n.length > 100) throw new Error('Nome de coleção inválido')
  const r = db.prepare('INSERT INTO colecoes (name) VALUES (?)').run(n)
  return db.prepare('SELECT * FROM colecoes WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('colecoes:rename', (_, { id, name }) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  const n = String(name || '').trim()
  if (!n || n.length > 100) throw new Error('Nome de coleção inválido')
  db.prepare('UPDATE colecoes SET name = ? WHERE id = ?').run(n, id)
  return true
})

ipcMain.handle('colecoes:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  db.prepare('DELETE FROM filme_colecao WHERE colecao_id = ?').run(id)
  db.prepare('DELETE FROM colecoes WHERE id = ?').run(id)
  return true
})

ipcMain.handle('colecoes:getFilmeIds', (_, colecaoId) => {
  if (!isPositiveInt(colecaoId)) throw new Error('Invalid ID')
  return db.prepare('SELECT filme_id FROM filme_colecao WHERE colecao_id = ?').all(colecaoId).map(r => r.filme_id)
})

ipcMain.handle('colecoes:getByFilme', (_, filmeId) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid ID')
  return db.prepare('SELECT colecao_id FROM filme_colecao WHERE filme_id = ?').all(filmeId).map(r => r.colecao_id)
})

ipcMain.handle('colecoes:setForFilme', (_, { filmeId, colecaoIds }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filmeId')
  if (!Array.isArray(colecaoIds)) throw new Error('colecaoIds must be array')
  if (colecaoIds.some(id => !isPositiveInt(id))) throw new Error('Invalid colecaoId in array')
  db.prepare('DELETE FROM filme_colecao WHERE filme_id = ?').run(filmeId)
  const ins = db.prepare('INSERT INTO filme_colecao (filme_id, colecao_id) VALUES (?, ?)')
  for (const cid of colecaoIds) ins.run(filmeId, cid)
  return true
})

// ─── IPC: TAGS ────────────────────────────────────────────────────────────────

ipcMain.handle('tags:getAll', () =>
  db.prepare(`
    SELECT t.id, t.name, COUNT(ft.filme_id) AS count
    FROM tags t LEFT JOIN filme_tag ft ON ft.tag_id = t.id
    GROUP BY t.id ORDER BY t.name COLLATE NOCASE
  `).all()
)

ipcMain.handle('tags:insert', (_, name) => {
  const n = String(name || '').trim()
  if (!n || n.length > 50) throw new Error('Nome de tag inválido')
  const existing = db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(n)
  if (existing) return existing
  const r = db.prepare('INSERT INTO tags (name) VALUES (?)').run(n)
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('tags:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  db.prepare('DELETE FROM filme_tag WHERE tag_id = ?').run(id)
  db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  return true
})

ipcMain.handle('tags:getFilmeIds', (_, tagId) => {
  if (!isPositiveInt(tagId)) throw new Error('Invalid ID')
  return db.prepare('SELECT filme_id FROM filme_tag WHERE tag_id = ?').all(tagId).map(r => r.filme_id)
})

ipcMain.handle('tags:getByFilme', (_, filmeId) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid ID')
  return db.prepare('SELECT tag_id FROM filme_tag WHERE filme_id = ?').all(filmeId).map(r => r.tag_id)
})

ipcMain.handle('tags:setForFilme', (_, { filmeId, tagIds }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filmeId')
  if (!Array.isArray(tagIds)) throw new Error('tagIds must be array')
  if (tagIds.some(id => !isPositiveInt(id))) throw new Error('Invalid tagId in array')
  db.prepare('DELETE FROM filme_tag WHERE filme_id = ?').run(filmeId)
  const ins = db.prepare('INSERT INTO filme_tag (filme_id, tag_id) VALUES (?, ?)')
  for (const tid of tagIds) ins.run(filmeId, tid)
  return true
})

ipcMain.handle('db:search', (_, query) => {
  const q = String(query || '').trim()
  if (q.length === 0) return []
  if (q.length > 200) throw new Error('Query too long')
  return db.prepare(`
    SELECT * FROM filmes WHERE
      title LIKE ? OR original_title LIKE ? OR director LIKE ? OR genre LIKE ? OR cast LIKE ?
    ORDER BY title COLLATE NOCASE
  `).all(...Array(5).fill(`%${q}%`))
})

// ─── IPC: OMDB ────────────────────────────────────────────────────────────────

ipcMain.handle('omdb:search', async (_, { title, imdbId, year }) => {
  if (!_omdbKey) throw new Error('OMDb API key not configured')
  const q = imdbId ? `i=${encodeURIComponent(imdbId)}` : `t=${encodeURIComponent(title)}`
  const y = (!imdbId && year) ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?${q}${y}&plot=full&apikey=${_omdbKey}`)
})

ipcMain.handle('omdb:searchByTitle', async (_, { title, year }) => {
  if (!_omdbKey) throw new Error('OMDb API key not configured')
  const y = year ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}${y}&apikey=${_omdbKey}`)
})

// ─── IPC: TMDB ────────────────────────────────────────────────────────────────

ipcMain.handle('tmdb:search', async (_, { query, year }) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  const y = year ? `&year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${_tmdbKey}`)
})

ipcMain.handle('tmdb:details', async (_, { id }) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  return omdbFetch(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits&language=pt-BR&api_key=${_tmdbKey}`)
})

ipcMain.handle('tmdb:searchTv', async (_, { query, year }) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  const y = year ? `&first_air_date_year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${_tmdbKey}`)
})

ipcMain.handle('tmdb:tvDetails', async (_, { id }) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  return omdbFetch(`https://api.themoviedb.org/3/tv/${id}?append_to_response=credits&language=pt-BR&api_key=${_tmdbKey}`)
})

ipcMain.handle('tmdb:tvSeasonDetails', async (_, { id, season }) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  if (!Number.isInteger(season) || season < 0) throw new Error('Invalid season number')
  return omdbFetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?language=pt-BR&api_key=${_tmdbKey}`)
})

// Onde assistir (streaming) — só o que está disponível em modo assinatura (flatrate) na região BR
const PROVIDERS_TTL_DAYS = 7

function cachedProviders(filme) {
  if (filme.providers == null || !filme.providers_checked_at) return null
  const age = (Date.now() - new Date(filme.providers_checked_at.replace(' ', 'T') + 'Z').getTime()) / 86400000
  if (!(age < PROVIDERS_TTL_DAYS)) return null
  try { return JSON.parse(filme.providers) } catch { return null }
}

async function fetchAndCacheProviders(filmeId) {
  const list = await fetchProviders(filmeId)
  db.prepare("UPDATE filmes SET providers = ?, providers_checked_at = datetime('now') WHERE id = ?").run(JSON.stringify(list), filmeId)
  return list
}

ipcMain.handle('tmdb:watchProviders', async (_, filmeId) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  const filme = getFilmeById(filmeId)
  if (!filme) return []
  return cachedProviders(filme) ?? fetchAndCacheProviders(filmeId)
})

// Atualiza em sequência os títulos com cache vencido (roda em segundo plano ao abrir o app)
ipcMain.handle('providers:refreshStale', async () => {
  if (!_tmdbKey) return { updated: 0 }
  const rows = db.prepare(`
    SELECT * FROM filmes
    WHERE (COALESCE(tmdb_id, '') != '' OR imdb_id LIKE 'tt%')
      AND (providers IS NULL OR providers_checked_at IS NULL
           OR providers_checked_at < datetime('now', '-${PROVIDERS_TTL_DAYS} days'))
  `).all()
  let updated = 0
  for (const f of rows) {
    try { await fetchAndCacheProviders(f.id); updated++ } catch {}
  }
  return { updated }
})

async function fetchProviders(filmeId) {
  const filme = getFilmeById(filmeId)
  if (!filme) return []
  let id = Number(filme.tmdb_id) || 0
  let mediaType = filme.tmdb_media_type

  // Título antigo adicionado só via OMDb: descobre o ID da TMDB pelo IMDb uma vez e salva
  if (!id && /^tt\d+$/.test(filme.imdb_id || '')) {
    const found = await omdbFetch(`https://api.themoviedb.org/3/find/${filme.imdb_id}?external_source=imdb_id&api_key=${_tmdbKey}`)
    const movie = found?.movie_results?.[0]
    const tv = found?.tv_results?.[0]
    const hit = movie ? { id: movie.id, type: 'movie' } : tv ? { id: tv.id, type: 'tv' } : null
    if (!hit) return []
    id = hit.id; mediaType = hit.type
    db.prepare("UPDATE filmes SET tmdb_id = ?, tmdb_media_type = ? WHERE id = ? AND COALESCE(tmdb_id, '') = ''").run(String(id), mediaType, filmeId)
  }
  if (!isPositiveInt(id) || (mediaType !== 'movie' && mediaType !== 'tv')) return []
  const data = await omdbFetch(`https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${_tmdbKey}`)
  const br = data?.results?.BR
  if (!br) return []
  // "Netflix Standard with Ads" etc. só repetem o serviço principal
  return (br.flatrate || [])
    .filter(p => !/with ads/i.test(p.provider_name))
    .map(p => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }))
}

// ─── IPC: EPISÓDIOS ───────────────────────────────────────────────────────────

ipcMain.handle('episodes:getWatched', (_, filmeId) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  return db.prepare('SELECT season_number, episode_number, watched_at FROM episodios_assistidos WHERE filme_id = ?').all(filmeId)
})

ipcMain.handle('episodes:setWatched', (_, { filmeId, season, episode, watched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!Number.isInteger(season) || season < 0) throw new Error('Invalid season number')
  if (!isPositiveInt(episode)) throw new Error('Invalid episode number')
  if (watched) {
    db.prepare(`
      INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
      VALUES (?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
    `).run(filmeId, season, episode)
  } else {
    db.prepare('DELETE FROM episodios_assistidos WHERE filme_id = ? AND season_number = ? AND episode_number = ?').run(filmeId, season, episode)
  }
  return true
})

ipcMain.handle('episodes:setWatchedBulk', (_, { filmeId, episodes, watched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!Array.isArray(episodes)) throw new Error('episodes must be an array')
  const insert = db.prepare(`
    INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
  `)
  const del = db.prepare('DELETE FROM episodios_assistidos WHERE filme_id = ? AND season_number = ? AND episode_number = ?')
  const tx = db.transaction((items) => {
    for (const { season, episode } of items) {
      if (!Number.isInteger(season) || season < 0 || !isPositiveInt(episode)) continue
      if (watched) insert.run(filmeId, season, episode)
      else del.run(filmeId, season, episode)
    }
  })
  tx(episodes)
  return true
})

async function fetchTmdbTvSummary(tmdbId) {
  const data = await omdbFetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=pt-BR&api_key=${_tmdbKey}`)
  if (data.success === false) {
    throw new Error(`ID TMDB ${tmdbId} inválido ou removido — re-adicione o título pela busca para corrigir o vínculo`)
  }
  const last = data.last_episode_to_air
  const seasons = (data.seasons || []).filter(s => s.season_number >= 1)
  let episodesAired = 0
  if (last) {
    for (const s of seasons) {
      if (s.season_number < last.season_number) episodesAired += (s.episode_count || 0)
      else if (s.season_number === last.season_number) episodesAired += (last.episode_number || 0)
    }
  }
  const nextAirDate = data.next_episode_to_air?.air_date || null
  return { episodesAired, nextAirDate, seasons, last }
}

// Gera os pares (temporada, episódio) de 1 até o limite informado, varrendo as temporadas anteriores inteiras
function pairsUpTo(seasons, boundSeason, boundEpisode) {
  const pairs = []
  for (const s of seasons) {
    if (s.season_number < boundSeason) {
      for (let ep = 1; ep <= (s.episode_count || 0); ep++) pairs.push({ season: s.season_number, episode: ep })
    } else if (s.season_number === boundSeason) {
      for (let ep = 1; ep <= boundEpisode; ep++) pairs.push({ season: s.season_number, episode: ep })
    }
  }
  return pairs
}

function bulkInsertWatched(filmeId, pairs) {
  if (!pairs.length) return
  const insert = db.prepare(`
    INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
  `)
  const tx = db.transaction((items) => {
    for (const { season, episode } of items) insert.run(filmeId, season, episode)
  })
  tx(pairs)
}

ipcMain.handle('episodes:refresh', async (_, { filmeId, tmdbId, markAllWatched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!tmdbId) throw new Error('Título sem TMDB ID — adicione pela busca pra ter episódios')
  const { episodesAired, nextAirDate, seasons, last } = await fetchTmdbTvSummary(tmdbId)

  if (markAllWatched && last) {
    bulkInsertWatched(filmeId, pairsUpTo(seasons, last.season_number, last.episode_number))
  }

  db.prepare(`
    UPDATE filmes SET episodes_aired = ?, next_episode_air_date = ?, last_episode_check = datetime('now','localtime')
    WHERE id = ?
  `).run(episodesAired, nextAirDate, filmeId)
  return getFilmeById(filmeId)
})

// Uma vez por dia, em segundo plano: atualiza contagem/próxima data das séries "Assistindo" ou "Assistido"
// (é isso que permite avisar de episódio novo e de temporada nova sem o usuário clicar em nada)
ipcMain.handle('episodes:refreshStale', async () => {
  if (!_tmdbKey) return { updated: 0 }
  const rows = db.prepare(`
    SELECT f.id, f.tmdb_id, f.watched_at,
      (SELECT COUNT(*) FROM episodios_assistidos e WHERE e.filme_id = f.id) AS watched_count
    FROM filmes f
    WHERE f.tmdb_media_type = 'tv' AND COALESCE(f.tmdb_id, '') != ''
      AND (f.watching = 1 OR COALESCE(f.watched_at, '') != '')
      AND (f.last_episode_check IS NULL OR f.last_episode_check < datetime('now', 'localtime', '-20 hours'))
  `).all()
  let updated = 0
  for (const f of rows) {
    try {
      const { episodesAired, nextAirDate, seasons, last } = await fetchTmdbTvSummary(Number(f.tmdb_id))
      // "Assistido" antigo sem nenhum episódio registrado: o mesmo acerto único do botão "Atualizar episódios",
      // senão a contagem nova pareceria uma temporada nova
      if (f.watched_at && f.watched_count === 0 && last) {
        bulkInsertWatched(f.id, pairsUpTo(seasons, last.season_number, last.episode_number))
      }
      db.prepare(`
        UPDATE filmes SET episodes_aired = ?, next_episode_air_date = ?, last_episode_check = datetime('now','localtime')
        WHERE id = ?
      `).run(episodesAired, nextAirDate, f.id)
      updated++
    } catch {}
  }
  return { updated }
})

ipcMain.handle('episodes:markProgress', async (_, { filmeId, tmdbId, season, episode }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!tmdbId) throw new Error('Título sem TMDB ID — adicione pela busca pra ter episódios')
  if (!Number.isInteger(season) || season < 1) throw new Error('Invalid season number')
  if (!Number.isInteger(episode) || episode < 1) throw new Error('Invalid episode number')
  const { episodesAired, nextAirDate, seasons } = await fetchTmdbTvSummary(tmdbId)

  // "Estou em TxEy" = próximo a assistir: tudo antes fica visto, e marcações depois dele (clique errado) saem
  db.transaction(() => {
    db.prepare(`
      DELETE FROM episodios_assistidos
      WHERE filme_id = ? AND (season_number > ? OR (season_number = ? AND episode_number >= ?))
    `).run(filmeId, season, season, episode)
    bulkInsertWatched(filmeId, pairsUpTo(seasons, season, episode - 1))
  })()

  db.prepare(`
    UPDATE filmes SET episodes_aired = ?, next_episode_air_date = ?, last_episode_check = datetime('now','localtime')
    WHERE id = ?
  `).run(episodesAired, nextAirDate, filmeId)
  return getFilmeById(filmeId)
})

ipcMain.handle('episodes:getNextUp', async (_, { filmeId, tmdbId }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!tmdbId) throw new Error('Título sem TMDB ID')
  const { seasons, last } = await fetchTmdbTvSummary(tmdbId)
  if (!last) return null // nada foi ao ar ainda
  // Próximo = o episódio seguinte ao mais avançado já visto (lacunas antigas não puxam de volta pra T1E1)
  const furthest = db.prepare(`
    SELECT season_number, episode_number FROM episodios_assistidos
    WHERE filme_id = ? AND season_number >= 1
    ORDER BY season_number DESC, episode_number DESC LIMIT 1
  `).get(filmeId)
  const airedIn = (s) => s.season_number < last.season_number ? (s.episode_count || 0)
    : s.season_number === last.season_number ? last.episode_number : 0
  for (const s of seasons) {
    const aired = airedIn(s)
    if (aired === 0) continue
    let start = 1
    if (furthest) {
      if (s.season_number < furthest.season_number) continue
      if (s.season_number === furthest.season_number) start = furthest.episode_number + 1
    }
    if (start <= aired) return { season: s.season_number, episode: start, seasonName: s.name || null }
  }
  return 'caught_up' // viu tudo que já foi ao ar
})

// ─── IPC: SHELL ───────────────────────────────────────────────────────────────

const ALLOWED_EXTERNAL_ORIGINS = [
  'https://www.omdbapi.com',
  'https://www.themoviedb.org',
  'https://myanimelist.net',
]

ipcMain.handle('shell:openExternal', (_, url) => {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Invalid URL') }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs allowed')
  const allowed = ALLOWED_EXTERNAL_ORIGINS.includes(parsed.origin)
  if (!allowed) throw new Error(`URL not allowed: ${parsed.origin}`)
  return shell.openExternal(url)
})

// ─── IPC: CAPA ────────────────────────────────────────────────────────────────

ipcMain.handle('cover:save', async (_, { id, base64, ext }) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  if (typeof base64 !== 'string' || base64.length === 0) throw new Error('Invalid base64')
  // Limit to 20 MB (base64 overhead ~33%, so ~15 MB raw)
  if (base64.length > 20 * 1024 * 1024) throw new Error('Image too large (max 20 MB)')
  const safeExt = sanitizeExt(ext)
  const dir = path.join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${id}_${Date.now()}.${safeExt}`)
  // assertCoversPath as a final guard
  assertCoversPath(filePath)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

ipcMain.handle('cover:read', (_, filePath) => {
  if (!filePath) return null
  let resolved
  try { resolved = assertCoversPath(filePath) } catch { return null }
  if (!fs.existsSync(resolved)) return null
  try {
    const data = fs.readFileSync(resolved)
    const ext = path.extname(resolved).slice(1)
    const safeExt = sanitizeExt(ext)
    return `data:image/${safeExt};base64,${data.toString('base64')}`
  } catch { return null }
})

// ─── IPC: EXPORT ──────────────────────────────────────────────────────────────

function queryFilmesForExport(filmeIds) {
  if (Array.isArray(filmeIds) && filmeIds.length > 0) {
    const ids = filmeIds.filter(id => isPositiveInt(id))
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    return db.prepare(`SELECT * FROM filmes WHERE id IN (${placeholders}) ORDER BY title COLLATE NOCASE`).all(...ids)
  }
  return db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
}

// Importar lista: lê CSV (UTF-8) ou Excel e devolve as linhas como objetos (cabeçalho = chaves)
const IMPORT_MAX_ROWS = 5000

ipcMain.handle('import:readFile', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar lista de títulos',
    filters: [{ name: 'Planilha ou CSV', extensions: ['csv', 'xlsx', 'xls'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { canceled: true }
  const XLSX = require('xlsx')
  const filePath = filePaths[0]
  // raw: sem isso o xlsx transforma "2024-03-02" em data e devolve no formato americano ("3/2/24");
  // no Excel, datas vêm como número de série, que o importador converte
  const wb = /\.csv$/i.test(filePath)
    ? XLSX.read(fs.readFileSync(filePath, 'utf8').replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.readFile(filePath)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true })
  if (rows.length > IMPORT_MAX_ROWS) throw new Error(`Arquivo com ${rows.length} linhas — o limite é ${IMPORT_MAX_ROWS}.`)
  return { canceled: false, fileName: path.basename(filePath), rows }
})

ipcMain.handle('tmdb:findByImdb', async (_, imdbId) => {
  if (!_tmdbKey) throw new Error('TMDB API key not configured')
  if (!/^tt\d+$/.test(String(imdbId))) throw new Error('Invalid IMDb ID')
  const found = await omdbFetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${_tmdbKey}`)
  const movie = found?.movie_results?.[0]
  const tv = found?.tv_results?.[0]
  return movie ? { id: movie.id, type: 'movie' } : tv ? { id: tv.id, type: 'tv' } : null
})

ipcMain.handle('export:csv', async (_e, { filmeIds } = {}) => {
  const filmes = queryFilmesForExport(filmeIds)
  const headers = ['Título','Título Original','Ano','Formato(s)','Gênero','Diretor','Elenco','Duração','Nota IMDb','Assistido em','Sinopse']
  const rows = filmes.map(f => [
    f.title, f.original_title || '', f.year || '',
    f.formats || f.format || '', f.genre || '', f.director || '',
    f.cast || '', f.runtime || '', f.imdb_rating || '',
    f.watched_at || '', f.synopsis || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar CSV',
    defaultPath: path.join(app.getPath('documents'), 'meu-catalogo.csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (!filePath || canceled) return { success: false }
  fs.writeFileSync(filePath, '﻿' + csv, 'utf8')
  return { success: true }
})

ipcMain.handle('export:xlsx', async (_e, { filmeIds } = {}) => {
  const XLSX = require('xlsx')
  const filmes = queryFilmesForExport(filmeIds)
  const data = filmes.map(f => ({
    'Título': f.title, 'Título Original': f.original_title || '',
    'Ano': f.year || '', 'Formato(s)': f.formats || f.format || '',
    'Gênero': f.genre || '', 'Diretor': f.director || '',
    'Elenco': f.cast || '', 'Duração': f.runtime || '',
    'Nota IMDb': f.imdb_rating || '', 'Assistido em': f.watched_at || '',
    'País': f.country || '', 'Idioma': f.language || '', 'Sinopse': f.synopsis || '',
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Coleção')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Excel',
    defaultPath: path.join(app.getPath('documents'), 'meu-catalogo.xlsx'),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (!filePath || canceled) return { success: false }
  XLSX.writeFile(wb, filePath)
  return { success: true }
})

ipcMain.handle('export:siteJson', async (_e, { filmeIds } = {}) => {
  const filmes = queryFilmesForExport(filmeIds)
  const data = filmes.map(f => ({
    title:          f.title,
    original_title: f.original_title || '',
    year:           f.year || null,
    category:       f.category || '',
    formats:        f.formats || f.format || '',
    watched:        !!f.watched_at,
    poster_url:     f.poster_url || '',
    imdb_id:        f.imdb_id || '',
    tmdb_id:        f.tmdb_id || '',
  }))
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar para site',
    defaultPath: path.join(app.getPath('documents'), 'colecao.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!filePath || canceled) return { success: false }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return { success: true }
})

// ─── IPC: BACKUP ──────────────────────────────────────────────────────────────

ipcMain.handle('backup:create', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Fazer backup completo',
    defaultPath: path.join(app.getPath('documents'), `meu-catalogo-backup-${new Date().toISOString().slice(0, 10)}.zip`),
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
  })
  if (!filePath || canceled) return { success: false }
  writeBackupZip(filePath)
  return { success: true, filePath }
})

function writeBackupZip(filePath) {
  const AdmZip = require('adm-zip')
  const userDataPath = app.getPath('userData')
  // SQLite roda em modo WAL — escritas recentes podem estar só no .db-wal, não no .db principal ainda.
  // TRUNCATE força tudo de volta pro arquivo principal e zera o WAL, garantindo um snapshot completo e consistente.
  if (db) { try { db.pragma('wal_checkpoint(TRUNCATE)') } catch {} }

  const zip = new AdmZip()
  const dbPath = path.join(userDataPath, 'catalogo.db')
  if (fs.existsSync(dbPath)) zip.addLocalFile(dbPath)
  const coversDir = path.join(userDataPath, 'covers')
  if (fs.existsSync(coversDir)) zip.addLocalFolder(coversDir, 'covers')
  const postersDir = path.join(userDataPath, 'mal-posters')
  if (fs.existsSync(postersDir)) zip.addLocalFolder(postersDir, 'mal-posters')
  const cachePath = path.join(userDataPath, 'mal-cache.json')
  if (fs.existsSync(cachePath)) zip.addLocalFile(cachePath)
  const settingsPath = path.join(userDataPath, 'settings.json')
  if (fs.existsSync(settingsPath)) zip.addLocalFile(settingsPath)

  zip.writeZip(filePath)
}

// ─── Backup automático: 1x por semana, guarda os 5 últimos ────────────────────
const AUTO_BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000
const AUTO_BACKUP_KEEP = 5
const AUTO_BACKUP_RE = /^meu-catalogo-auto-\d{4}-\d{2}-\d{2}\.zip$/

// Fora do app instalado (dev/testes) o padrão fica dentro da pasta de dados — nunca nos Documentos reais
function autoBackupDir() {
  if (_prefs.backupDir) return _prefs.backupDir
  return app.isPackaged
    ? path.join(app.getPath('documents'), 'Meu Catálogo', 'Backups')
    : path.join(app.getPath('userData'), 'backups')
}

function autoBackupStatus() {
  const last = _prefs.lastBackupAt ? Date.parse(_prefs.lastBackupAt) : NaN
  return {
    enabled: _prefs.autoBackup,
    dir: autoBackupDir(),
    lastAt: _prefs.lastBackupAt,
    nextAt: Number.isFinite(last) ? new Date(last + AUTO_BACKUP_EVERY_MS).toISOString() : null,
  }
}

function runAutoBackup({ force = false } = {}) {
  if (!_prefs.autoBackup && !force) return { ran: false, reason: 'disabled' }
  const last = _prefs.lastBackupAt ? Date.parse(_prefs.lastBackupAt) : NaN
  if (!force && Number.isFinite(last) && Date.now() - last < AUTO_BACKUP_EVERY_MS) return { ran: false, reason: 'not-due' }
  // catálogo vazio (ou banco zerado por acidente) não pode empurrar os backups bons pra fora da rotação
  const count = db ? db.prepare('SELECT COUNT(*) AS n FROM filmes').get().n : 0
  if (count === 0) return { ran: false, reason: 'empty' }

  const dir = autoBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `meu-catalogo-auto-${new Date().toISOString().slice(0, 10)}.zip`)
  writeBackupZip(file)
  _prefs.lastBackupAt = new Date().toISOString()
  savePrefs()

  // rotação: só mexe nos arquivos do próprio backup automático
  const autos = fs.readdirSync(dir).filter(n => AUTO_BACKUP_RE.test(n)).sort().reverse()
  for (const old of autos.slice(AUTO_BACKUP_KEEP)) {
    try { fs.rmSync(path.join(dir, old), { force: true }) } catch {}
  }
  return { ran: true, file }
}

ipcMain.handle('backup:autoStatus', () => autoBackupStatus())

ipcMain.handle('backup:autoCheck', () => {
  try { return runAutoBackup() } catch (e) { return { ran: false, reason: 'error', message: e.message } }
})

ipcMain.handle('backup:autoNow', () => ({ ...runAutoBackup({ force: true }), status: autoBackupStatus() }))

// a pasta só muda pelo diálogo do sistema — a página nunca passa um caminho
ipcMain.handle('backup:chooseDir', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Pasta dos backups automáticos',
    defaultPath: autoBackupDir(),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!canceled && filePaths[0]) { _prefs.backupDir = filePaths[0]; savePrefs() }
  return autoBackupStatus()
})

ipcMain.handle('backup:openDir', () => {
  const dir = autoBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  return shell.openPath(dir)
})

ipcMain.handle('backup:restore', async () => {
  const AdmZip = require('adm-zip')
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Restaurar backup',
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { success: false }

  const zip = new AdmZip(filePaths[0])
  const entryNames = zip.getEntries().map(e => e.entryName)
  if (!entryNames.includes('catalogo.db')) {
    throw new Error('Arquivo inválido: catalogo.db não encontrado dentro do backup')
  }

  const userDataPath = app.getPath('userData')
  if (db) { try { db.close() } catch {}; db = null }
  // WAL/SHM antigos não podem ser aplicados por cima do banco restaurado
  for (const ext of ['-wal', '-shm']) {
    try { fs.rmSync(path.join(userDataPath, 'catalogo.db' + ext), { force: true }) } catch {}
  }
  zip.extractAllTo(userDataPath, true)

  // Recarrega dentro do mesmo processo: app.relaunch() no modo dev derruba o Vite junto (tela escura)
  _omdbKey = ''; _tmdbKey = ''
  _malClientId = ''; _malAccessToken = ''; _malRefreshToken = ''; _malTokenExpiry = 0
  createDatabase()
  loadPrefs() // o settings.json do backup traz as preferências dele
  setTimeout(() => mainWindow?.webContents.reload(), 100)
  return { success: true }
})

// ─── IPC: SETTINGS ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  if (!fs.existsSync(p)) return { omdbApiKey: '', tmdbApiKey: '' }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    // Load keys into main-process memory
    if (raw.omdbApiKey)     _omdbKey        = raw.omdbApiKey
    if (raw.tmdbApiKey)     _tmdbKey        = raw.tmdbApiKey
    if (raw.malClientId)     _malClientId    = raw.malClientId
    if (raw.malAccessToken)  _malAccessToken  = raw.malAccessToken
    if (raw.malRefreshToken) _malRefreshToken = raw.malRefreshToken
    if (raw.malTokenExpiry)  _malTokenExpiry  = raw.malTokenExpiry
    return {
      omdbApiKey:       raw.omdbApiKey       ? '••••••••' : '',
      tmdbApiKey:       raw.tmdbApiKey       ? '••••••••' : '',
      omdbConfigured:   !!raw.omdbApiKey,
      tmdbConfigured:   !!raw.tmdbApiKey,
      malConfigured:    !!raw.malClientId,
      malAuthenticated: !!raw.malAccessToken && Date.now() < (raw.malTokenExpiry || 0),
    }
  } catch { return { omdbApiKey: '', tmdbApiKey: '' } }
})

ipcMain.handle('settings:save', (_, data) => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  let existing = {}
  try { if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}

  const omdb = (data.omdbApiKey && !data.omdbApiKey.startsWith('•'))
    ? data.omdbApiKey.trim() : existing.omdbApiKey || ''
  const tmdb = (data.tmdbApiKey && !data.tmdbApiKey.startsWith('•'))
    ? data.tmdbApiKey.trim() : existing.tmdbApiKey || ''
  const malId = (data.malClientId && !data.malClientId.startsWith('•'))
    ? data.malClientId.trim() : existing.malClientId || ''

  _omdbKey     = omdb
  _tmdbKey     = tmdb
  _malClientId = malId

  fs.writeFileSync(p, JSON.stringify({
    ...existing,
    omdbApiKey:  omdb,
    tmdbApiKey:  tmdb,
    malClientId: malId,
  }, null, 2))
  return true
})

// ─── IPC: MAL ─────────────────────────────────────────────────────────────────

ipcMain.handle('mal:startAuth', () => {
  if (!_malClientId) throw new Error('Client ID do MAL não configurado')
  const { verifier, challenge } = generatePKCE()
  _malCodeVerifier = verifier
  _malAuthState    = generateState()

  // Inicia servidor local para capturar o redirect do MAL
  const http = require('http')
  if (_malCallbackServer) { try { _malCallbackServer.close() } catch {} }
  _malCallbackServer = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:7813')
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Autorização recebida!</h2><p>Pode fechar esta aba e voltar ao app.</p></body></html>')
      const code  = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      mainWindow?.webContents.send('mal:oauth-callback', { code, state })
      setTimeout(() => { try { _malCallbackServer?.close() } catch {} _malCallbackServer = null }, 1000)
    } else {
      res.writeHead(404); res.end()
    }
  })
  _malCallbackServer.listen(7813, '127.0.0.1')

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             _malClientId,
    redirect_uri:          'http://localhost:7813',
    state:                 _malAuthState,
    code_challenge:        challenge,
    code_challenge_method: 'plain',
  })
  const authUrl = `https://myanimelist.net/v1/oauth2/authorize?${params}`
  shell.openExternal(authUrl)
  return { ok: true }
})

ipcMain.handle('mal:exchangeCode', async (_, { code, state }) => {
  if (state !== _malAuthState) throw new Error('State inválido — possível CSRF')
  if (!code) throw new Error('Código de autorização ausente')
  const body = new URLSearchParams({
    client_id:     _malClientId,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  'http://localhost:7813',
    code_verifier: _malCodeVerifier,
  }).toString()
  const res = await malFetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status !== 200) throw new Error(`MAL token error: ${JSON.stringify(res.body)}`)
  _malAccessToken  = res.body.access_token
  _malRefreshToken = res.body.refresh_token
  _malTokenExpiry  = Date.now() + res.body.expires_in * 1000
  _malAuthState    = ''
  _malCodeVerifier = ''
  _saveMalTokens()
  return { ok: true }
})

ipcMain.handle('mal:search', async (_, { query, limit = 20 }) => {
  await malRefreshIfNeeded()
  if (!query || String(query).trim().length === 0) throw new Error('Query vazia')
  const q = encodeURIComponent(String(query).trim().slice(0, 100))
  const fields = 'id,title,alternative_titles,main_picture,num_episodes,mean,start_date,genres,media_type,broadcast,status'
  const res = await malFetch(`https://api.myanimelist.net/v2/anime?q=${q}&limit=${limit}&fields=${fields}`, {
    headers: { Authorization: `Bearer ${_malAccessToken}` },
  })
  if (res.status === 401) throw new Error('Token MAL expirado — re-autentique')
  if (res.status !== 200) throw new Error(`MAL API error: ${res.status}`)
  return res.body
})

ipcMain.handle('mal:getAnimeList', async (_, { status = 'completed', limit = 1000 } = {}) => {
  await malRefreshIfNeeded()
  const fields = 'id,title,alternative_titles,main_picture,num_episodes,mean,start_date,genres,media_type,my_list_status,broadcast,status'
  const url = `https://api.myanimelist.net/v2/users/@me/animelist?fields=${fields}&status=${status}&limit=${limit}&nsfw=true`
  const res = await malFetch(url, {
    headers: { Authorization: `Bearer ${_malAccessToken}` },
  })
  if (res.status === 401) throw new Error('Token MAL expirado — re-autentique')
  if (res.status !== 200) throw new Error(`MAL API error: ${res.status}`)
  return res.body
})

const MAL_POSTER_HOSTS = ['cdn.myanimelist.net', 'api-cdn.myanimelist.net']
const POSTER_MAX_BYTES = 10 * 1024 * 1024

ipcMain.handle('mal:savePoster', async (_, { malId, url } = {}) => {
  // malId e URL vêm da página: sem estas checagens, "../settings" + ".json" devolvia o settings.json
  // (chaves de API) e uma URL qualquer era baixada e gravada fora da pasta de pôsteres
  if (!isPositiveInt(malId)) return null
  let parsed
  try { parsed = new URL(String(url)) } catch { return null }
  if (parsed.protocol !== 'https:' || !MAL_POSTER_HOSTS.includes(parsed.hostname)) return null
  const ext = (parsed.pathname.split('.').pop() || '').toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return null
  const postersDir = path.join(app.getPath('userData'), 'mal-posters')
  if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true })
  const filePath = path.join(postersDir, `${malId}.${ext}`)
  // se já existe no disco, retorna direto
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath)
    return `data:image/${ext};base64,${data.toString('base64')}`
  }
  // baixa a imagem
  const https = require('https')
  return new Promise((resolve) => {
    https.get(parsed, (res) => {
      if (res.statusCode !== 200 || !/^image\//.test(res.headers['content-type'] || '')) { res.resume(); resolve(null); return }
      const chunks = []
      let size = 0
      res.on('data', c => {
        size += c.length
        if (size > POSTER_MAX_BYTES) { res.destroy(); resolve(null); return }
        chunks.push(c)
      })
      res.on('end', () => {
        if (size > POSTER_MAX_BYTES) return
        const buf = Buffer.concat(chunks)
        try { fs.writeFileSync(filePath, buf) } catch {}
        resolve(`data:image/${ext};base64,${buf.toString('base64')}`)
      })
    }).on('error', () => resolve(null))
  })
})

ipcMain.handle('mal:saveCache', (_, animes) => {
  const p = path.join(app.getPath('userData'), 'mal-cache.json')
  fs.writeFileSync(p, JSON.stringify(animes), 'utf8')
  return true
})

ipcMain.handle('mal:loadCache', () => {
  const p = path.join(app.getPath('userData'), 'mal-cache.json')
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
})

ipcMain.handle('mal:getStatus', () => ({
  configured: !!_malClientId,
  authenticated: !!_malAccessToken && Date.now() < _malTokenExpiry,
}))

ipcMain.handle('mal:updateAnime', async (_, { animeId, patch }) => {
  await malRefreshIfNeeded()
  if (!Number.isInteger(animeId) || animeId <= 0) throw new Error('Invalid anime ID')
  const params = new URLSearchParams()
  if (patch.status != null)               params.append('status', patch.status)
  if (patch.score != null)                params.append('score', String(Number(patch.score)))
  if (patch.num_episodes_watched != null) params.append('num_watched_episodes', String(Number(patch.num_episodes_watched)))
  const res = await fetch(`https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${_malAccessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`MAL update error: ${JSON.stringify(json)}`)
  return json
})

ipcMain.handle('mal:disconnect', () => {
  _malAccessToken  = ''
  _malRefreshToken = ''
  _malTokenExpiry  = 0
  _saveMalTokens()
  return true
})

ipcMain.handle('export:malJson', async (_e, { animes }) => {
  if (!Array.isArray(animes)) throw new Error('Lista inválida')
  const data = animes.map(({ node, list_status }) => {
    const totalEps   = node.num_episodes || 0
    const watchedEps = list_status?.num_episodes_watched || 0
    // anime em andamento sem total definido: usa episódios assistidos como referência
    const episodes   = totalEps > 0 ? totalEps : (watchedEps > 0 ? watchedEps : null)
    const ongoing    = totalEps === 0 && watchedEps > 0
    return {
      mal_id:      node.id,
      title:       node.title,
      title_en:    node.alternative_titles?.en || '',
      title_ja:    node.alternative_titles?.ja || '',
      poster_url:  node.main_picture?.large || node.main_picture?.medium || '',
      episodes,
      ongoing,
      score:       node.mean || null,
      my_score:    list_status?.score || null,
      status:      list_status?.status || '',
      watched_eps: watchedEps,
      start_date:  node.start_date || '',
      genres:      (node.genres || []).map(g => g.name),
      media_type:  node.media_type || '',
    }
  })
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar lista de animes',
    defaultPath: require('path').join(app.getPath('documents'), 'meus-animes.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!filePath || canceled) return { success: false }
  require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return { success: true }
})

// Exported for testing
module.exports = { isPositiveInt, sanitizeExt, assertCoversPath, ALLOWED_EXTERNAL_ORIGINS }
