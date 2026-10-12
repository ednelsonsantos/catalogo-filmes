// Cálculos da tela de Estatísticas — funções puras sobre os dados que o app já carrega

const MAL_STATUS = {
  watching: 'Assistindo', completed: 'Completo', on_hold: 'Em pausa',
  dropped: 'Abandonado', plan_to_watch: 'Planejo assistir',
}

// "148 min" → 148, "45 min/ep" → 45, "2h 10min" → 130; sem número → null
export function parseMinutes(runtime) {
  const s = String(runtime || '')
  const h = s.match(/(\d+)\s*h/i)
  const m = s.match(/(\d+)\s*min/i)
  if (!h && !m) return null
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

const isPerEpisode = (runtime) => /\/\s*ep/i.test(String(runtime || ''))

function countBy(items, keyFn) {
  const out = {}
  for (const it of items) {
    for (const k of [].concat(keyFn(it))) {
      if (k) out[k] = (out[k] || 0) + 1
    }
  }
  return Object.entries(out).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'pt-BR'))
}

const splitList = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean)

// Últimos 12 meses (incluindo o atual), do mais antigo pro mais novo
export function lastMonths(now = new Date(), n = 12) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function computeStats(filmes, animeList = [], episodesByMonth = [], now = new Date()) {
  const watched = filmes.filter(f => !!f.watched_at)
  const watching = filmes.filter(f => !!f.watching)

  // Horas: filme assistido conta a duração; série conta episódios vistos × duração do episódio
  let minutes = 0
  let unknownRuntime = 0
  for (const f of filmes) {
    const mins = parseMinutes(f.runtime)
    if (isPerEpisode(f.runtime)) {
      const eps = f.episodes_watched_count || 0
      if (!eps) continue
      if (mins) minutes += eps * mins
      else unknownRuntime++
    } else if (f.watched_at) {
      if (mins) minutes += mins
      else unknownRuntime++
    }
  }

  const rated = filmes.filter(f => f.my_rating != null && f.my_rating !== '')
  const ratingDist = Array.from({ length: 11 }, (_, n) => ({ label: String(n), value: rated.filter(f => Number(f.my_rating) === n).length }))

  const decades = countBy(filmes, f => {
    const y = Number(f.year)
    return y > 1800 ? `${Math.floor(y / 10) * 10}s` : null
  }).sort((a, b) => a.label.localeCompare(b.label))

  const series = filmes
    .filter(f => f.episodes_aired > 0)
    .map(f => ({
      id: f.id, title: f.title, watched: Math.min(f.episodes_watched_count || 0, f.episodes_aired), aired: f.episodes_aired,
      watching: !!f.watching,
    }))
    .map(s => ({ ...s, pct: Math.round((s.watched / s.aired) * 100) }))
  const seriesInProgress = series.filter(s => s.pct < 100 && (s.watched > 0 || s.watching)).sort((a, b) => b.pct - a.pct)

  // Atividade: títulos com data de "assistido" + episódios registrados, por mês
  const months = lastMonths(now)
  const epMap = Object.fromEntries(episodesByMonth.map(r => [r.month, r.count]))
  const activity = months.map(m => ({
    month: m,
    titles: watched.filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.watched_at) && f.watched_at.startsWith(m)).length,
    episodes: epMap[m] || 0,
  }))
  const undatedWatched = watched.filter(f => !/^\d{4}-\d{2}-\d{2}$/.test(f.watched_at)).length

  const animes = animeList.filter(a => a.list_status)
  const animeScored = animes.filter(a => a.list_status.score > 0)

  return {
    totals: {
      titles: filmes.length,
      watched: watched.length,
      watchedPct: filmes.length ? Math.round((watched.length / filmes.length) * 100) : 0,
      watching: watching.length,
      hours: Math.round(minutes / 60),
      unknownRuntime,
      episodes: filmes.reduce((s, f) => s + (f.episodes_watched_count || 0), 0),
      rated: rated.length,
      avgRating: rated.length ? Math.round((rated.reduce((s, f) => s + Number(f.my_rating), 0) / rated.length) * 10) / 10 : null,
    },
    genres: countBy(filmes, f => splitList(f.genre)).slice(0, 10),
    formats: countBy(filmes, f => splitList(f.formats || f.format)),
    categories: countBy(filmes, f => f.category || null),
    decades,
    ratingDist,
    seriesInProgress,
    seriesCompleted: series.filter(s => s.pct >= 100).length,
    activity,
    hasActivity: activity.some(a => a.titles || a.episodes),
    undatedWatched,
    anime: {
      total: animes.length,
      byStatus: countBy(animes, a => MAL_STATUS[a.list_status.status] || a.list_status.status),
      episodes: animes.reduce((s, a) => s + (a.list_status.num_episodes_watched || 0), 0),
      avgScore: animeScored.length ? Math.round((animeScored.reduce((s, a) => s + a.list_status.score, 0) / animeScored.length) * 10) / 10 : null,
    },
  }
}
