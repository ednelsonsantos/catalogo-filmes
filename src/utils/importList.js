// Leitura de listas importadas (CSV/Excel): Letterboxd, IMDb, exportação do próprio app ou planilha genérica.
// Tudo vira { title, year, imdb_id, my_rating, watched_at, kind, formats }.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function pick(row, ...names) {
  const keys = Object.keys(row)
  for (const n of names) {
    const k = keys.find(key => norm(key) === norm(n))
    if (k != null && String(row[k]).trim() !== '') return String(row[k]).trim()
  }
  return ''
}

const toYear = (v) => {
  const y = parseInt(String(v).slice(0, 4), 10)
  return y > 1800 && y < 2200 ? y : null
}

// Datas: ISO (2024-03-01), BR (01/03/2024) ou número serial do Excel
function toDate(v) {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  // serial do Excel pode vir fracionado por fuso (44742.9997 = 01/07/2022 00:00 local) — arredonda pro dia
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.round(Number(s)) * 86400000).toISOString().slice(0, 10)
  return ''
}

export function detectFormat(headers) {
  const h = headers.map(norm)
  const has = (x) => h.includes(norm(x))
  if (has('Letterboxd URI')) return 'letterboxd'
  if (has('Const') && (has('Title Type') || has('Your Rating') || has('URL'))) return 'imdb'
  if (has('Título') && has('Formato(s)')) return 'app'
  if (['titulo', 'título', 'title', 'name', 'nome', 'filme'].some(has)) return 'generic'
  return null
}

export const FORMAT_LABELS = {
  letterboxd: 'Letterboxd',
  imdb: 'IMDb',
  app: 'Exportação do Meu Catálogo',
  generic: 'Planilha (coluna de título)',
}

function fromLetterboxd(row, { isWatchlist }) {
  const rating = parseFloat(pick(row, 'Rating'))
  const watched = toDate(pick(row, 'Watched Date', 'Date'))
  return {
    title: pick(row, 'Name'),
    year: toYear(pick(row, 'Year')),
    // Letterboxd dá de 0,5 a 5 estrelas; o app usa 0–10
    my_rating: Number.isFinite(rating) ? Math.round(rating * 2) : null,
    // watched.csv/diary.csv/ratings.csv = assistidos; watchlist.csv tem as mesmas colunas, só o nome muda
    watched_at: isWatchlist ? '' : 'watched',
    watchedDate: isWatchlist ? '' : watched,
    kind: 'movie',
  }
}

function fromImdb(row) {
  const rating = parseInt(pick(row, 'Your Rating'), 10)
  const type = norm(pick(row, 'Title Type'))
  return {
    title: pick(row, 'Title'),
    year: toYear(pick(row, 'Year')),
    imdb_id: pick(row, 'Const'),
    my_rating: Number.isFinite(rating) ? rating : null,
    // ratings.csv (tem "Your Rating") = assistido; watchlist não
    watched_at: Number.isFinite(rating) ? 'watched' : '',
    watchedDate: toDate(pick(row, 'Date Rated')),
    kind: /series|mini/.test(type) ? 'tv' : 'movie',
  }
}

function fromApp(row) {
  const watched = pick(row, 'Assistido em')
  return {
    title: pick(row, 'Título'),
    year: toYear(pick(row, 'Ano')),
    formats: pick(row, 'Formato(s)'),
    watched_at: watched === 'watched' ? 'watched' : '',
    watchedDate: toDate(watched),
    kind: null,
  }
}

function fromGeneric(row) {
  const rating = parseFloat(pick(row, 'Minha nota', 'Nota', 'Rating', 'Your Rating'))
  const watchedRaw = pick(row, 'Assistido', 'Assistido em', 'Watched', 'Watched Date')
  const watchedDate = toDate(watchedRaw)
  return {
    title: pick(row, 'Título', 'Titulo', 'Title', 'Name', 'Nome', 'Filme'),
    year: toYear(pick(row, 'Ano', 'Year')),
    imdb_id: /^tt\d+$/.test(pick(row, 'IMDb', 'imdb_id', 'Const')) ? pick(row, 'IMDb', 'imdb_id', 'Const') : '',
    my_rating: Number.isFinite(rating) && rating >= 0 && rating <= 10 ? Math.round(rating) : null,
    formats: pick(row, 'Formato', 'Formato(s)', 'Formatos'),
    watched_at: watchedDate || /^(sim|s|x|yes|true|1|watched)$/i.test(watchedRaw) ? 'watched' : '',
    watchedDate,
    kind: null,
  }
}

const PARSERS = { letterboxd: fromLetterboxd, imdb: fromImdb, app: fromApp, generic: fromGeneric }

export function parseImport(rows, fileName = '') {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const format = detectFormat(headers)
  if (!format) return { format: null, items: [] }
  const items = rows
    .map(row => PARSERS[format](row, { isWatchlist: /watchlist/i.test(fileName) }))
    .filter(it => it.title)
    .map(it => ({
      title: it.title,
      year: it.year ?? null,
      imdb_id: it.imdb_id || '',
      my_rating: it.my_rating ?? null,
      formats: it.formats || '',
      // com data vira "Assistido em <data>"; sem data, só "assistido"
      watched_at: it.watchedDate || it.watched_at || '',
      kind: it.kind,
    }))
  return { format, items }
}

// Já está na coleção? Mesmo IMDb, ou mesmo título (sem acento/caixa) e ano
export function findExisting(item, filmes) {
  const t = norm(item.title)
  return filmes.find(f =>
    (item.imdb_id && f.imdb_id === item.imdb_id) ||
    ((norm(f.title) === t || norm(f.original_title) === t) && (!item.year || !f.year || Number(f.year) === item.year))
  ) || null
}
