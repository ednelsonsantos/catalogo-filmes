// Títulos do catálogo, ações em lote, coleções e tags
const { ipcMain } = require('electron')
const state = require('./state')
const { isPositiveInt, getFilmeById } = require('./helpers')
const { schedulePosterSync } = require('./images')

// ─── IPC: FILMES ──────────────────────────────────────────────────────────────

ipcMain.handle('db:getAll', () =>
  state.db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM episodios_assistidos e WHERE e.filme_id = f.id) AS episodes_watched_count
    FROM filmes f ORDER BY f.title COLLATE NOCASE
  `).all()
)

ipcMain.handle('stats:episodesByMonth', () =>
  state.db.prepare(`
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
  const stmt = state.db.prepare(`
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
  schedulePosterSync()
  return getFilmeById(result.lastInsertRowid)
})

ipcMain.handle('db:update', (_, filme) => {
  if (!isPositiveInt(filme.id)) throw new Error('Invalid filme ID')
  state.db.prepare(`
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
  schedulePosterSync()
  return getFilmeById(filme.id)
})

// Remove o título e tudo que é dele. Antes só saía da coleção: as tags e episódios ficavam órfãos
// (a tag seguia contando o removido, e um título novo que reaproveitasse o id herdava tudo)
function deleteFilmes(ids) {
  state.db.transaction(() => {
    for (const id of ids) {
      for (const table of ['filme_colecao', 'filme_tag', 'episodios_assistidos']) {
        state.db.prepare(`DELETE FROM ${table} WHERE filme_id = ?`).run(id)
      }
      state.db.prepare('DELETE FROM filmes WHERE id = ?').run(id)
    }
  })()
}

ipcMain.handle('db:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  deleteFilmes([id])
  return true
})

// ─── IPC: AÇÕES EM LOTE ───────────────────────────────────────────────────────
// Vários títulos selecionados no catálogo de uma vez, numa transação só
const BULK_MAX = 10000

ipcMain.handle('bulk:apply', (_, { ids, action, targetId } = {}) => {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > BULK_MAX) throw new Error('Invalid ids')
  if (ids.some(id => !isPositiveInt(id))) throw new Error('Invalid id in array')
  const unique = [...new Set(ids)]
  const today = new Date().toISOString().slice(0, 10)
  if (action === 'delete') { deleteFilmes(unique); return { changed: unique.length } }
  if (['addColecao', 'addTag'].includes(action) && !isPositiveInt(targetId)) throw new Error('Invalid targetId')
  if (action === 'addColecao' && !state.db.prepare('SELECT 1 FROM colecoes WHERE id = ?').get(targetId)) throw new Error('Coleção não encontrada')
  if (action === 'addTag' && !state.db.prepare('SELECT 1 FROM tags WHERE id = ?').get(targetId)) throw new Error('Tag não encontrada')
  let changed = 0
  state.db.transaction(() => {
    for (const id of unique) {
      if (action === 'watched') {
        // quem já tinha data mantém a dela; marcar assistido encerra o "assistindo" (igual ao individual)
        changed += state.db.prepare("UPDATE filmes SET watched_at = COALESCE(NULLIF(watched_at, ''), ?), watching = 0 WHERE id = ?").run(today, id).changes
      } else if (action === 'unwatched') {
        changed += state.db.prepare('UPDATE filmes SET watched_at = NULL WHERE id = ?').run(id).changes
      } else if (action === 'addColecao') {
        if (!isPositiveInt(targetId)) throw new Error('Invalid colecaoId')
        changed += state.db.prepare('INSERT OR IGNORE INTO filme_colecao (filme_id, colecao_id) SELECT id, ? FROM filmes WHERE id = ?').run(targetId, id).changes
      } else if (action === 'addTag') {
        if (!isPositiveInt(targetId)) throw new Error('Invalid tagId')
        changed += state.db.prepare('INSERT OR IGNORE INTO filme_tag (filme_id, tag_id) SELECT id, ? FROM filmes WHERE id = ?').run(targetId, id).changes
      } else {
        throw new Error('Invalid action')
      }
    }
  })()
  return { changed }
})

// ─── IPC: COLEÇÕES ────────────────────────────────────────────────────────────

ipcMain.handle('colecoes:getAll', () =>
  state.db.prepare(`
    SELECT c.id, c.name, COUNT(fc.filme_id) AS count
    FROM colecoes c LEFT JOIN filme_colecao fc ON fc.colecao_id = c.id
    GROUP BY c.id ORDER BY c.name COLLATE NOCASE
  `).all()
)

ipcMain.handle('colecoes:insert', (_, name) => {
  const n = String(name || '').trim()
  if (!n || n.length > 100) throw new Error('Nome de coleção inválido')
  const r = state.db.prepare('INSERT INTO colecoes (name) VALUES (?)').run(n)
  return state.db.prepare('SELECT * FROM colecoes WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('colecoes:rename', (_, { id, name }) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  const n = String(name || '').trim()
  if (!n || n.length > 100) throw new Error('Nome de coleção inválido')
  state.db.prepare('UPDATE colecoes SET name = ? WHERE id = ?').run(n, id)
  return true
})

ipcMain.handle('colecoes:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  state.db.prepare('DELETE FROM filme_colecao WHERE colecao_id = ?').run(id)
  state.db.prepare('DELETE FROM colecoes WHERE id = ?').run(id)
  return true
})

ipcMain.handle('colecoes:getFilmeIds', (_, colecaoId) => {
  if (!isPositiveInt(colecaoId)) throw new Error('Invalid ID')
  return state.db.prepare('SELECT filme_id FROM filme_colecao WHERE colecao_id = ?').all(colecaoId).map(r => r.filme_id)
})

ipcMain.handle('colecoes:getByFilme', (_, filmeId) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid ID')
  return state.db.prepare('SELECT colecao_id FROM filme_colecao WHERE filme_id = ?').all(filmeId).map(r => r.colecao_id)
})

ipcMain.handle('colecoes:setForFilme', (_, { filmeId, colecaoIds }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filmeId')
  if (!Array.isArray(colecaoIds)) throw new Error('colecaoIds must be array')
  if (colecaoIds.some(id => !isPositiveInt(id))) throw new Error('Invalid colecaoId in array')
  state.db.prepare('DELETE FROM filme_colecao WHERE filme_id = ?').run(filmeId)
  const ins = state.db.prepare('INSERT INTO filme_colecao (filme_id, colecao_id) VALUES (?, ?)')
  for (const cid of colecaoIds) ins.run(filmeId, cid)
  return true
})

// ─── IPC: TAGS ────────────────────────────────────────────────────────────────

ipcMain.handle('tags:getAll', () =>
  state.db.prepare(`
    SELECT t.id, t.name, COUNT(ft.filme_id) AS count
    FROM tags t LEFT JOIN filme_tag ft ON ft.tag_id = t.id
    GROUP BY t.id ORDER BY t.name COLLATE NOCASE
  `).all()
)

ipcMain.handle('tags:insert', (_, name) => {
  const n = String(name || '').trim()
  if (!n || n.length > 50) throw new Error('Nome de tag inválido')
  const existing = state.db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(n)
  if (existing) return existing
  const r = state.db.prepare('INSERT INTO tags (name) VALUES (?)').run(n)
  return state.db.prepare('SELECT * FROM tags WHERE id = ?').get(r.lastInsertRowid)
})

ipcMain.handle('tags:delete', (_, id) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  state.db.prepare('DELETE FROM filme_tag WHERE tag_id = ?').run(id)
  state.db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  return true
})

ipcMain.handle('tags:getFilmeIds', (_, tagId) => {
  if (!isPositiveInt(tagId)) throw new Error('Invalid ID')
  return state.db.prepare('SELECT filme_id FROM filme_tag WHERE tag_id = ?').all(tagId).map(r => r.filme_id)
})

ipcMain.handle('tags:getByFilme', (_, filmeId) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid ID')
  return state.db.prepare('SELECT tag_id FROM filme_tag WHERE filme_id = ?').all(filmeId).map(r => r.tag_id)
})

ipcMain.handle('tags:setForFilme', (_, { filmeId, tagIds }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filmeId')
  if (!Array.isArray(tagIds)) throw new Error('tagIds must be array')
  if (tagIds.some(id => !isPositiveInt(id))) throw new Error('Invalid tagId in array')
  state.db.prepare('DELETE FROM filme_tag WHERE filme_id = ?').run(filmeId)
  const ins = state.db.prepare('INSERT INTO filme_tag (filme_id, tag_id) VALUES (?, ?)')
  for (const tid of tagIds) ins.run(filmeId, tid)
  return true
})

ipcMain.handle('db:search', (_, query) => {
  const q = String(query || '').trim()
  if (q.length === 0) return []
  if (q.length > 200) throw new Error('Query too long')
  return state.db.prepare(`
    SELECT * FROM filmes WHERE
      title LIKE ? OR original_title LIKE ? OR director LIKE ? OR genre LIKE ? OR cast LIKE ?
    ORDER BY title COLLATE NOCASE
  `).all(...Array(5).fill(`%${q}%`))
})
