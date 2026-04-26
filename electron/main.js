const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let db

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

  // Migração segura: adiciona colunas novas se o banco já existia
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Catálogo de Filmes',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0f0f0f',
    show: false,
  })

  const isDev = !app.isPackaged
  if (isDev) {
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
}

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
  const r = db.prepare('INSERT INTO colecoes (name) VALUES (?)').run(name.trim())
  return db.prepare('SELECT * FROM colecoes WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('colecoes:rename', (_, { id, name }) => {
  db.prepare('UPDATE colecoes SET name = ? WHERE id = ?').run(name.trim(), id)
  return true
})

ipcMain.handle('colecoes:delete', (_, id) => {
  db.prepare('DELETE FROM filme_colecao WHERE colecao_id = ?').run(id)
  db.prepare('DELETE FROM colecoes WHERE id = ?').run(id)
  return true
})

ipcMain.handle('colecoes:getFilmeIds', (_, colecaoId) =>
  db.prepare('SELECT filme_id FROM filme_colecao WHERE colecao_id = ?').all(colecaoId).map(r => r.filme_id)
)

ipcMain.handle('colecoes:getByFilme', (_, filmeId) =>
  db.prepare('SELECT colecao_id FROM filme_colecao WHERE filme_id = ?').all(filmeId).map(r => r.colecao_id)
)

ipcMain.handle('colecoes:setForFilme', (_, { filmeId, colecaoIds }) => {
  db.prepare('DELETE FROM filme_colecao WHERE filme_id = ?').run(filmeId)
  const ins = db.prepare('INSERT INTO filme_colecao (filme_id, colecao_id) VALUES (?, ?)')
  for (const cid of colecaoIds) ins.run(filmeId, cid)
  return true
})

ipcMain.handle('db:search', (_, query) =>
  db.prepare(`
    SELECT * FROM filmes WHERE
      title LIKE ? OR original_title LIKE ? OR director LIKE ? OR genre LIKE ? OR cast LIKE ?
    ORDER BY title COLLATE NOCASE
  `).all(...Array(5).fill(`%${query}%`))
)

// ─── IPC: OMDB ────────────────────────────────────────────────────────────────

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

ipcMain.handle('omdb:search', async (_, { title, imdbId, year, apiKey }) => {
  const q = imdbId ? `i=${encodeURIComponent(imdbId)}` : `t=${encodeURIComponent(title)}`
  const y = (!imdbId && year) ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?${q}${y}&plot=full&apikey=${apiKey}`)
})

ipcMain.handle('omdb:searchByTitle', async (_, { title, year, apiKey }) => {
  const y = year ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}${y}&apikey=${apiKey}`)
})

// ─── IPC: TMDB ────────────────────────────────────────────────────────────────

ipcMain.handle('tmdb:search', async (_, { query, year, apiKey }) => {
  const y = year ? `&year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${apiKey}`)
})

ipcMain.handle('tmdb:details', async (_, { id, apiKey }) => {
  return omdbFetch(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits&language=pt-BR&api_key=${apiKey}`)
})

ipcMain.handle('tmdb:searchTv', async (_, { query, year, apiKey }) => {
  const y = year ? `&first_air_date_year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${apiKey}`)
})

ipcMain.handle('tmdb:tvDetails', async (_, { id, apiKey }) => {
  return omdbFetch(`https://api.themoviedb.org/3/tv/${id}?append_to_response=credits&language=pt-BR&api_key=${apiKey}`)
})

// ─── IPC: CAPA ────────────────────────────────────────────────────────────────

ipcMain.handle('cover:save', async (_, { id, base64, ext }) => {
  const dir = path.join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${id}_${Date.now()}.${ext}`)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

ipcMain.handle('cover:read', (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    const data = fs.readFileSync(filePath)
    const ext = path.extname(filePath).slice(1)
    return `data:image/${ext};base64,${data.toString('base64')}`
  } catch { return null }
})

// ─── IPC: EXPORT ──────────────────────────────────────────────────────────────

ipcMain.handle('export:csv', async () => {
  const filmes = db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
  const headers = ['Título','Título Original','Ano','Formato(s)','Gênero','Diretor','Elenco','Duração','Nota IMDb','Assistido em','Sinopse']
  const rows = filmes.map(f => [
    f.title, f.original_title || '', f.year || '',
    f.formats || f.format || '', f.genre || '', f.director || '',
    f.cast || '', f.runtime || '', f.imdb_rating || '',
    f.watched_at || '', (f.synopsis || '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar CSV',
    defaultPath: 'catalogo-filmes.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  })
  if (filePath) { fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8'); return { success: true } }
  return { success: false }
})

ipcMain.handle('export:xlsx', async () => {
  const XLSX = require('xlsx')
  const filmes = db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
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
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar Excel', defaultPath: 'catalogo-filmes.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (filePath) { XLSX.writeFile(wb, filePath); return { success: true } }
  return { success: false }
})

ipcMain.handle('export:siteJson', async () => {
  const filmes = db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
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
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar para site',
    defaultPath: 'colecao.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (filePath) { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); return { success: true } }
  return { success: false }
})

// ─── IPC: SETTINGS ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} }
})

ipcMain.handle('settings:save', (_, data) => {
  fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(data, null, 2))
  return true
})
