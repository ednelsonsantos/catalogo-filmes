// OMDb e TMDB: busca de títulos, "Onde assistir" e episódios das séries
const { ipcMain } = require('electron')
const state = require('./state')
const { isPositiveInt, getFilmeById, omdbFetch } = require('./helpers')

// ─── IPC: OMDB ────────────────────────────────────────────────────────────────

ipcMain.handle('omdb:search', async (_, { title, imdbId, year }) => {
  if (!state.keys.omdb) throw new Error('OMDb API key not configured')
  const q = imdbId ? `i=${encodeURIComponent(imdbId)}` : `t=${encodeURIComponent(title)}`
  const y = (!imdbId && year) ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?${q}${y}&plot=full&apikey=${state.keys.omdb}`)
})

ipcMain.handle('omdb:searchByTitle', async (_, { title, year }) => {
  if (!state.keys.omdb) throw new Error('OMDb API key not configured')
  const y = year ? `&y=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://www.omdbapi.com/?s=${encodeURIComponent(title)}${y}&apikey=${state.keys.omdb}`)
})

// ─── IPC: TMDB ────────────────────────────────────────────────────────────────

ipcMain.handle('tmdb:search', async (_, { query, year }) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  const y = year ? `&year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${state.keys.tmdb}`)
})

ipcMain.handle('tmdb:details', async (_, { id }) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  return omdbFetch(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits&language=pt-BR&api_key=${state.keys.tmdb}`)
})

ipcMain.handle('tmdb:searchTv', async (_, { query, year }) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  const y = year ? `&first_air_date_year=${encodeURIComponent(year)}` : ''
  return omdbFetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}${y}&language=pt-BR&api_key=${state.keys.tmdb}`)
})

ipcMain.handle('tmdb:tvDetails', async (_, { id }) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  return omdbFetch(`https://api.themoviedb.org/3/tv/${id}?append_to_response=credits&language=pt-BR&api_key=${state.keys.tmdb}`)
})

ipcMain.handle('tmdb:tvSeasonDetails', async (_, { id, season }) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(id)) throw new Error('Invalid TMDB ID')
  if (!Number.isInteger(season) || season < 0) throw new Error('Invalid season number')
  return omdbFetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?language=pt-BR&api_key=${state.keys.tmdb}`)
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
  state.db.prepare("UPDATE filmes SET providers = ?, providers_checked_at = datetime('now') WHERE id = ?").run(JSON.stringify(list), filmeId)
  return list
}

ipcMain.handle('tmdb:watchProviders', async (_, filmeId) => {
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  const filme = getFilmeById(filmeId)
  if (!filme) return []
  return cachedProviders(filme) ?? fetchAndCacheProviders(filmeId)
})

// Atualiza em sequência os títulos com cache vencido (roda em segundo plano ao abrir o app)
ipcMain.handle('providers:refreshStale', async () => {
  if (!state.keys.tmdb) return { updated: 0 }
  const rows = state.db.prepare(`
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
    const found = await omdbFetch(`https://api.themoviedb.org/3/find/${filme.imdb_id}?external_source=imdb_id&api_key=${state.keys.tmdb}`)
    const movie = found?.movie_results?.[0]
    const tv = found?.tv_results?.[0]
    const hit = movie ? { id: movie.id, type: 'movie' } : tv ? { id: tv.id, type: 'tv' } : null
    if (!hit) return []
    id = hit.id; mediaType = hit.type
    state.db.prepare("UPDATE filmes SET tmdb_id = ?, tmdb_media_type = ? WHERE id = ? AND COALESCE(tmdb_id, '') = ''").run(String(id), mediaType, filmeId)
  }
  if (!isPositiveInt(id) || (mediaType !== 'movie' && mediaType !== 'tv')) return []
  const data = await omdbFetch(`https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${state.keys.tmdb}`)
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
  return state.db.prepare('SELECT season_number, episode_number, watched_at FROM episodios_assistidos WHERE filme_id = ?').all(filmeId)
})

ipcMain.handle('episodes:setWatched', (_, { filmeId, season, episode, watched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!Number.isInteger(season) || season < 0) throw new Error('Invalid season number')
  if (!isPositiveInt(episode)) throw new Error('Invalid episode number')
  if (watched) {
    state.db.prepare(`
      INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
      VALUES (?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
    `).run(filmeId, season, episode)
  } else {
    state.db.prepare('DELETE FROM episodios_assistidos WHERE filme_id = ? AND season_number = ? AND episode_number = ?').run(filmeId, season, episode)
  }
  return true
})

ipcMain.handle('episodes:setWatchedBulk', (_, { filmeId, episodes, watched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!Array.isArray(episodes)) throw new Error('episodes must be an array')
  const insert = state.db.prepare(`
    INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
  `)
  const del = state.db.prepare('DELETE FROM episodios_assistidos WHERE filme_id = ? AND season_number = ? AND episode_number = ?')
  const tx = state.db.transaction((items) => {
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
  const data = await omdbFetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=pt-BR&api_key=${state.keys.tmdb}`)
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
  const insert = state.db.prepare(`
    INSERT INTO episodios_assistidos (filme_id, season_number, episode_number, watched_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(filme_id, season_number, episode_number) DO NOTHING
  `)
  const tx = state.db.transaction((items) => {
    for (const { season, episode } of items) insert.run(filmeId, season, episode)
  })
  tx(pairs)
}

ipcMain.handle('episodes:refresh', async (_, { filmeId, tmdbId, markAllWatched }) => {
  if (!isPositiveInt(filmeId)) throw new Error('Invalid filme ID')
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!tmdbId) throw new Error('Título sem TMDB ID — adicione pela busca pra ter episódios')
  const { episodesAired, nextAirDate, seasons, last } = await fetchTmdbTvSummary(tmdbId)

  if (markAllWatched && last) {
    bulkInsertWatched(filmeId, pairsUpTo(seasons, last.season_number, last.episode_number))
  }

  state.db.prepare(`
    UPDATE filmes SET episodes_aired = ?, next_episode_air_date = ?, last_episode_check = datetime('now','localtime')
    WHERE id = ?
  `).run(episodesAired, nextAirDate, filmeId)
  return getFilmeById(filmeId)
})

// Uma vez por dia, em segundo plano: atualiza contagem/próxima data das séries "Assistindo" ou "Assistido"
// (é isso que permite avisar de episódio novo e de temporada nova sem o usuário clicar em nada)
ipcMain.handle('episodes:refreshStale', async () => {
  if (!state.keys.tmdb) return { updated: 0 }
  const rows = state.db.prepare(`
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
      state.db.prepare(`
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
  if (!state.keys.tmdb) throw new Error('TMDB API key not configured')
  if (!tmdbId) throw new Error('Título sem TMDB ID — adicione pela busca pra ter episódios')
  if (!Number.isInteger(season) || season < 1) throw new Error('Invalid season number')
  if (!Number.isInteger(episode) || episode < 1) throw new Error('Invalid episode number')
  const { episodesAired, nextAirDate, seasons } = await fetchTmdbTvSummary(tmdbId)

  // "Estou em TxEy" = próximo a assistir: tudo antes fica visto, e marcações depois dele (clique errado) saem
  state.db.transaction(() => {
    state.db.prepare(`
      DELETE FROM episodios_assistidos
      WHERE filme_id = ? AND (season_number > ? OR (season_number = ? AND episode_number >= ?))
    `).run(filmeId, season, season, episode)
    bulkInsertWatched(filmeId, pairsUpTo(seasons, season, episode - 1))
  })()

  state.db.prepare(`
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
  const furthest = state.db.prepare(`
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
