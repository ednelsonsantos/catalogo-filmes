// Converte respostas do OMDb/TMDB no formato de título usado pelo app

export const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

// Normaliza um título pra comparação (minúsculo, sem acento) — usado pra avisar sobre resultados parecidos na busca
export function normalizeTitle(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function omdbTypeToCategory(type) {
  if (type === 'series')  return 'Série'
  if (type === 'episode') return 'Série'
  if (type === 'movie')   return 'Filme'
  return ''
}

export function omdbToFilme(data, formats) {
  return {
    title:          data.Title !== 'N/A' ? data.Title : '',
    original_title: data.Title !== 'N/A' ? data.Title : '',
    year:           data.Year && data.Year !== 'N/A' ? parseInt(data.Year) : null,
    format:         formats.split(',')[0]?.trim() || '',
    formats,
    genre:          data.Genre !== 'N/A' ? data.Genre : '',
    director:       data.Director !== 'N/A' ? data.Director : '',
    cast:           data.Actors !== 'N/A' ? data.Actors : '',
    runtime:        data.Runtime !== 'N/A' ? data.Runtime : '',
    imdb_rating:    data.imdbRating !== 'N/A' ? data.imdbRating : '',
    imdb_id:        data.imdbID || '',
    synopsis:       data.Plot !== 'N/A' ? data.Plot : '',
    poster_url:     data.Poster !== 'N/A' ? data.Poster : '',
    language:       data.Language !== 'N/A' ? data.Language : '',
    country:        data.Country !== 'N/A' ? data.Country : '',
    cover_path:     null,
    watched_at:     '',
    category:       omdbTypeToCategory(data.Type),
    tmdb_id:        '',
    tmdb_media_type: '',
  }
}

// ─── TMDB helper ─────────────────────────────────────────────────────────────

export function tmdbToFilme(data, formats) {
  const year      = data.release_date ? parseInt(data.release_date.split('-')[0]) : null
  const director  = data.credits?.crew?.find(c => c.job === 'Director')?.name || ''
  const cast      = (data.credits?.cast || []).slice(0, 5).map(a => a.name).join(', ')
  const genres    = (data.genres || []).map(g => g.name).join(', ')
  const language  = data.spoken_languages?.[0]?.name || ''
  const country   = data.production_countries?.[0]?.name || ''
  return {
    title:          data.title || data.original_title || '',
    original_title: data.original_title || '',
    year,
    format:         formats.split(',')[0]?.trim() || '',
    formats,
    genre:          genres,
    director,
    cast,
    runtime:        data.runtime ? `${data.runtime} min` : '',
    imdb_rating:    data.vote_average ? Number(data.vote_average).toFixed(1) : '',
    imdb_id:        data.imdb_id || '',
    synopsis:       data.overview || '',
    poster_url:     data.poster_path ? `${TMDB_IMG}${data.poster_path}` : '',
    language,
    country,
    cover_path:     null,
    watched_at:     '',
    category:       'Filme',
    tmdb_id:        String(data.id || ''),
    tmdb_media_type: 'movie',
  }
}

export function tmdbTvTypeToCategory(type) {
  if (type === 'Miniseries')   return 'Mini-série'
  if (type === 'Documentary')  return 'Documentário'
  if (type === 'Animation')    return 'Animação'
  if (type === 'Talk Show')    return 'Show/Stand-up'
  return 'Série'
}

export function tmdbToFilmeTv(data, formats) {
  const year     = data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : null
  const director = data.created_by?.[0]?.name || data.credits?.crew?.find(c => c.job === 'Director')?.name || ''
  const cast     = (data.credits?.cast || []).slice(0, 5).map(a => a.name).join(', ')
  const genres   = (data.genres || []).map(g => g.name).join(', ')
  const language = data.spoken_languages?.[0]?.name || ''
  const country  = data.production_countries?.[0]?.name || ''
  const runtime  = data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min/ep` : ''
  return {
    title:          data.name || data.original_name || '',
    original_title: data.original_name || '',
    year,
    format:         formats.split(',')[0]?.trim() || '',
    formats,
    genre:          genres,
    director,
    cast,
    runtime,
    imdb_rating:    data.vote_average ? Number(data.vote_average).toFixed(1) : '',
    imdb_id:        '',
    synopsis:       data.overview || '',
    poster_url:     data.poster_path ? `${TMDB_IMG}${data.poster_path}` : '',
    language,
    country,
    cover_path:     null,
    watched_at:     '',
    category:       tmdbTvTypeToCategory(data.type),
    tmdb_id:        String(data.id || ''),
    tmdb_media_type: 'tv',
  }
}
