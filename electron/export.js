// Importar lista (CSV/Excel) e exportar o catálogo (CSV, Excel, JSON pro site)
const { app, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')
const { isPositiveInt, omdbFetch } = require('./helpers')

// ─── IPC: EXPORT ──────────────────────────────────────────────────────────────

function queryFilmesForExport(filmeIds) {
  if (Array.isArray(filmeIds) && filmeIds.length > 0) {
    const ids = filmeIds.filter(id => isPositiveInt(id))
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    return state.db.prepare(`SELECT * FROM filmes WHERE id IN (${placeholders}) ORDER BY title COLLATE NOCASE`).all(...ids)
  }
  return state.db.prepare('SELECT * FROM filmes ORDER BY title COLLATE NOCASE').all()
}

// Importar lista: lê CSV (UTF-8) ou Excel e devolve as linhas como objetos (cabeçalho = chaves)
const IMPORT_MAX_ROWS = 5000

ipcMain.handle('import:readFile', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(state.mainWindow, {
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
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!/^tt\d+$/.test(String(imdbId))) throw new Error('Invalid IMDb ID')
  const found = await omdbFetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${state.keys.tmdb}`)
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
  const { filePath, canceled } = await dialog.showSaveDialog(state.mainWindow, {
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
  const { filePath, canceled } = await dialog.showSaveDialog(state.mainWindow, {
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
  const { filePath, canceled } = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Exportar para site',
    defaultPath: path.join(app.getPath('documents'), 'colecao.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!filePath || canceled) return { success: false }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return { success: true }
})
