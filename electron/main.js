const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let db

// API keys kept only in main process — never cross IPC
let _omdbKey = ''
let _tmdbKey = ''

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0
}

function sanitizeExt(ext) {
  return String(ext || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'jpg'
}

function assertCoversPath(filePath) {
  const coversDir = path.resolve(path.join(app.getPath('userData'), 'covers'))
  const resolved  = path.resolve(filePath)
  if (!resolved.startsWith(coversDir + path.sep) && resolved !== coversDir) {
    throw new Error('Path traversal detected')
  }
  return resolved
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
    // Abre DevTools antes do load para capturar erros de carregamento
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(devUrl)) {
      throw new Error(`Invalid VITE_DEV_URL: ${devUrl}`)
    }
    mainWindow.loadURL(devUrl).catch(err => console.error('loadURL error:', err))
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
}

app.commandLine.appendSwitch('disable-features', 'Autofill')

app.whenReady().then(() => {
  createDatabase()
  createWindow()
}).catch(err => console.error('Falha na inicialização:', err))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC: FILMES ──────────────────────────────────────────────────────────────

ipcMain.handle('db:getAll', () =>
  db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
)

ipcMain.handle('db:insert', (_, filme) => {
  const stmt = db.prepare(`
    INSERT INTO filmes (title, original_title, year, format, formats, watched_at,
      genre, director, cast, runtime, imdb_rating, imdb_id, synopsis,
      poster_url, cover_path, language, country, category, tmdb_id)
    VALUES (@title, @original_title, @year, @format, @formats, @watched_at,
      @genre, @director, @cast, @runtime, @imdb_rating, @imdb_id, @synopsis,
      @poster_url, @cover_path, @language, @country, @category, @tmdb_id)
  `)
  const result = stmt.run(filme)
  return db.prepare('SELECT * FROM filmes WHERE id = ?').get(result.lastInsertRowid)
})

ipcMain.handle('db:update', (_, filme) => {
  if (!isPositiveInt(filme.id)) throw new Error('Invalid filme ID')
  db.prepare(`
    UPDATE filmes SET title=@title, original_title=@original_title, year=@year,
      format=@format, formats=@formats, watched_at=@watched_at,
      genre=@genre, director=@director, cast=@cast, runtime=@runtime,
      imdb_rating=@imdb_rating, imdb_id=@imdb_id, synopsis=@synopsis, poster_url=@poster_url,
      language=@language, country=@country, category=@category, tmdb_id=@tmdb_id
    WHERE id=@id
  `).run(filme)
  return db.prepare('SELECT * FROM filmes WHERE id = ?').get(filme.id)
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

// ─── IPC: SHELL ───────────────────────────────────────────────────────────────

const ALLOWED_EXTERNAL_ORIGINS = [
  'https://www.omdbapi.com',
  'https://www.themoviedb.org',
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

ipcMain.handle('export:csv', async (_e, { filmeIds } = {}) => {
  const filmes = queryFilmesForExport(filmeIds)
  const headers = ['Título','Título Original','Ano','Formato(s)','Gênero','Diretor','Elenco','Duração','Nota IMDb','Assistido em','Sinopse']
  const rows = filmes.map(f => [
    f.title, f.original_title || '', f.year || '',
    f.formats || f.format || '', f.genre || '', f.director || '',
    f.cast || '', f.runtime || '', f.imdb_rating || '',
    f.watched_at || '', (f.synopsis || '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','))
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

// ─── IPC: SETTINGS ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  if (!fs.existsSync(p)) return { omdbApiKey: '', tmdbApiKey: '' }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    // Load keys into main-process memory
    if (raw.omdbApiKey) _omdbKey = raw.omdbApiKey
    if (raw.tmdbApiKey) _tmdbKey = raw.tmdbApiKey
    // Return masked keys to renderer — renderer never needs the real value
    return {
      omdbApiKey:  raw.omdbApiKey  ? '••••••••' : '',
      tmdbApiKey:  raw.tmdbApiKey  ? '••••••••' : '',
      omdbConfigured: !!raw.omdbApiKey,
      tmdbConfigured: !!raw.tmdbApiKey,
    }
  } catch { return { omdbApiKey: '', tmdbApiKey: '' } }
})

ipcMain.handle('settings:save', (_, data) => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  // Read existing to preserve keys that arrive masked
  let existing = {}
  try { if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}

  const omdb = (data.omdbApiKey && !data.omdbApiKey.startsWith('•'))
    ? data.omdbApiKey.trim()
    : existing.omdbApiKey || ''
  const tmdb = (data.tmdbApiKey && !data.tmdbApiKey.startsWith('•'))
    ? data.tmdbApiKey.trim()
    : existing.tmdbApiKey || ''

  // Update in-memory keys immediately
  _omdbKey = omdb
  _tmdbKey = tmdb

  fs.writeFileSync(p, JSON.stringify({ omdbApiKey: omdb, tmdbApiKey: tmdb }, null, 2))
  return true
})

// Exported for testing
module.exports = { isPositiveInt, sanitizeExt, assertCoversPath, ALLOWED_EXTERNAL_ORIGINS }
