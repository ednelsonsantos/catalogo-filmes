// Banco SQLite: criação das tabelas e migrações de versões antigas
const { app } = require('electron')
const path = require('path')
const state = require('./state')

// ─── DATABASE ─────────────────────────────────────────────────────────────────

function createDatabase() {
  const Database = require('better-sqlite3')
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'catalogo.db')

  state.db = new Database(dbPath)

  state.db.exec(`
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

  const columns = state.db.prepare('PRAGMA table_info(filmes)').all().map(c => c.name)
  if (!columns.includes('formats'))    state.db.exec("ALTER TABLE filmes ADD COLUMN formats TEXT DEFAULT ''")
  if (!columns.includes('watched_at')) state.db.exec('ALTER TABLE filmes ADD COLUMN watched_at TEXT')
  if (!columns.includes('category'))   state.db.exec("ALTER TABLE filmes ADD COLUMN category TEXT DEFAULT ''")
  if (!columns.includes('tmdb_id'))    state.db.exec("ALTER TABLE filmes ADD COLUMN tmdb_id TEXT DEFAULT ''")
  if (!columns.includes('watching'))   state.db.exec('ALTER TABLE filmes ADD COLUMN watching INTEGER DEFAULT 0')
  if (!columns.includes('episodes_aired'))        state.db.exec('ALTER TABLE filmes ADD COLUMN episodes_aired INTEGER')
  if (!columns.includes('next_episode_air_date'))  state.db.exec('ALTER TABLE filmes ADD COLUMN next_episode_air_date TEXT')
  if (!columns.includes('last_episode_check'))     state.db.exec('ALTER TABLE filmes ADD COLUMN last_episode_check TEXT')
  if (!columns.includes('tmdb_media_type')) {
    state.db.exec("ALTER TABLE filmes ADD COLUMN tmdb_media_type TEXT DEFAULT ''")
    // Backfill: itens que já usam a trilha de episódios (categoria seriada + tmdb_id) quase certamente
    // têm um ID de série (/tv/), já que é assim que o app sempre buscou episódios até aqui
    state.db.exec(`
      UPDATE filmes SET tmdb_media_type = 'tv'
      WHERE tmdb_media_type = '' AND tmdb_id != '' AND category IN ('Série','Mini-série','Anime','Animação')
    `)
  }
  if (!columns.includes('my_rating')) state.db.exec('ALTER TABLE filmes ADD COLUMN my_rating INTEGER')
  // cache do "Onde assistir": JSON [{id,name,logo}], NULL = nunca verificado
  if (!columns.includes('providers'))            state.db.exec('ALTER TABLE filmes ADD COLUMN providers TEXT')
  if (!columns.includes('providers_checked_at')) state.db.exec('ALTER TABLE filmes ADD COLUMN providers_checked_at TEXT')

  state.db.exec(`
    CREATE TABLE IF NOT EXISTS episodios_assistidos (
      filme_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      watched_at TEXT,
      PRIMARY KEY (filme_id, season_number, episode_number)
    )
  `)

  state.db.exec(`
    CREATE TABLE IF NOT EXISTS colecoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  state.db.exec(`
    CREATE TABLE IF NOT EXISTS filme_colecao (
      filme_id INTEGER NOT NULL,
      colecao_id INTEGER NOT NULL,
      PRIMARY KEY (filme_id, colecao_id)
    )
  `)
  state.db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `)
  state.db.exec(`
    CREATE TABLE IF NOT EXISTS filme_tag (
      filme_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (filme_id, tag_id)
    )
  `)

  // Tags que só diferem em maiúsculas/minúsculas ("Romance"/"romance") viram uma só: fica a mais antiga
  state.db.transaction(() => {
    const dupes = state.db.prepare(`
      SELECT t.id AS dupId, (SELECT MIN(k.id) FROM tags k WHERE k.name = t.name COLLATE NOCASE) AS keepId
      FROM tags t
    `).all().filter(r => r.dupId !== r.keepId)
    for (const { dupId, keepId } of dupes) {
      state.db.prepare('INSERT OR IGNORE INTO filme_tag (filme_id, tag_id) SELECT filme_id, ? FROM filme_tag WHERE tag_id = ?').run(keepId, dupId)
      state.db.prepare('DELETE FROM filme_tag WHERE tag_id = ?').run(dupId)
      state.db.prepare('DELETE FROM tags WHERE id = ?').run(dupId)
    }
  })()
  state.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)')

  // Títulos removidos antes da v1.15.0 deixavam tags e episódios assistidos pra trás
  for (const table of ['filme_colecao', 'filme_tag', 'episodios_assistidos']) {
    state.db.exec(`DELETE FROM ${table} WHERE filme_id NOT IN (SELECT id FROM filmes)`)
  }

  // Filmes buscados pela TMDB antes da v1.3.1 ficaram sem tipo; a busca de série nunca preenche imdb_id
  state.db.prepare(`
    UPDATE filmes SET tmdb_media_type = 'movie'
    WHERE tmdb_media_type = '' AND tmdb_id != '' AND COALESCE(imdb_id, '') != ''
      AND category NOT IN ('Série','Mini-série','Anime','Animação')
  `).run()
}

module.exports = { createDatabase }
