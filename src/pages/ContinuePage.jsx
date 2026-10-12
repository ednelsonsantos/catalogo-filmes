import React, { useState, useEffect, useMemo, useCallback } from 'react'

const WEEKDAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function nextDateForWeekday(dayName) {
  const idx = WEEKDAY_INDEX[dayName]
  if (idx == null) return null
  const now = new Date()
  const diff = (idx - now.getDay() + 7) % 7
  const d = new Date(now)
  d.setDate(now.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  const today = new Date().toISOString().slice(0, 10)
  const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })
  return iso === today ? `hoje, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : label
}

export default function ContinuePage({ filmes, animeList, setAnimeList, onEdit, onFilmeUpdated, setPage, showToast }) {
  const watchingFilmes = useMemo(() => filmes.filter(f => !!f.watching && f.tmdb_id), [filmes])
  const watchingAnimes = useMemo(() => animeList.filter(a => a.list_status?.status === 'watching'), [animeList])

  const [nextUpMap, setNextUpMap] = useState({})
  const [loadingNextUp, setLoadingNextUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (watchingFilmes.length === 0) { setNextUpMap({}); return }
    setLoadingNextUp(true)
    Promise.all(watchingFilmes.map(async f => {
      try {
        const res = await window.api.episodesGetNextUp({ filmeId: f.id, tmdbId: Number(f.tmdb_id) })
        return [f.id, res]
      } catch { return [f.id, null] }
    })).then(entries => {
      if (!cancelled) { setNextUpMap(Object.fromEntries(entries)); setLoadingNextUp(false) }
    })
    return () => { cancelled = true }
  }, [watchingFilmes])

  const markFilmeWatched = useCallback(async (filme, nextUp) => {
    try {
      await window.api.episodesSetWatched({ filmeId: filme.id, season: nextUp.season, episode: nextUp.episode, watched: true })
      const res = await window.api.episodesGetNextUp({ filmeId: filme.id, tmdbId: Number(filme.tmdb_id) })
      setNextUpMap(prev => ({ ...prev, [filme.id]: res }))
      onFilmeUpdated?.({ ...filme, episodes_watched_count: (filme.episodes_watched_count || 0) + 1 })
      showToast?.(`"${filme.title}" T${nextUp.season}E${nextUp.episode} marcado!`, 'success')
    } catch {
      showToast?.('Erro ao marcar episódio.', 'error')
    }
  }, [onFilmeUpdated, showToast])

  const advanceAnime = useCallback(async (anime) => {
    const current = anime.list_status?.num_episodes_watched || 0
    const total = anime.node.num_episodes || 0
    const next = current + 1
    try {
      await window.api.malUpdateAnime({ animeId: anime.node.id, patch: { num_episodes_watched: next } })
      setAnimeList(prev => prev.map(a =>
        a.node.id === anime.node.id ? { ...a, list_status: { ...a.list_status, num_episodes_watched: next } } : a
      ))
      showToast?.(`"${anime.node.title}" episódio ${next} marcado!`, 'success')
      if (total > 0 && next >= total) showToast?.(`"${anime.node.title}" completo! Atualize o status no MAL.`, 'info')
    } catch {
      showToast?.('Erro ao marcar episódio no MAL.', 'error')
    }
  }, [setAnimeList, showToast])

  // Lançamentos da semana: séries com next_episode_air_date próxima + animes com broadcast
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7)
    const weekAheadIso = weekAhead.toISOString().slice(0, 10)

    const fromFilmes = watchingFilmes
      .filter(f => f.next_episode_air_date && f.next_episode_air_date >= today && f.next_episode_air_date <= weekAheadIso)
      .map(f => ({ kind: 'filme', id: f.id, title: f.title, date: f.next_episode_air_date, poster: f.poster_url, filme: f }))

    const fromAnimes = watchingAnimes
      .filter(a => a.node.status === 'currently_airing' && a.node.broadcast?.day_of_the_week)
      .map(a => {
        const date = nextDateForWeekday(a.node.broadcast.day_of_the_week)
        return date ? { kind: 'anime', id: a.node.id, title: a.node.title, date, poster: a.node._cachedPoster || a.node.main_picture?.medium, anime: a } : null
      })
      .filter(Boolean)

    return [...fromFilmes, ...fromAnimes].sort((a, b) => a.date.localeCompare(b.date))
  }, [watchingFilmes, watchingAnimes])

  const hasContent = watchingFilmes.length > 0 || watchingAnimes.length > 0

  if (!hasContent) {
    return (
      <div className="page">
        <h1 className="page-title">Continuando</h1>
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>▶</div>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            Nada marcado como "Assistindo" no momento. Marque uma série ou anime como "▶ Assistindo" pra ele aparecer aqui.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: 20 }}>Continuando</h1>

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>📅 Lançamentos da semana</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcoming.map(item => (
              <div key={`${item.kind}-${item.id}`} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 16 }}>{item.kind === 'anime' ? '🎌' : '📺'}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <span style={{ fontSize: 12, color: '#4a9eff', textTransform: 'capitalize', flexShrink: 0 }}>{formatDateLabel(item.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>▶ Continue assistindo</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {watchingFilmes.map(f => {
          const nextUp = nextUpMap[f.id]
          return (
            <div key={f.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '16/9', background: 'var(--bg4)', overflow: 'hidden' }}>
                {f.poster_url && f.poster_url !== 'N/A' && <img src={f.poster_url} alt={f.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
                {!nextUp && loadingNextUp && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Carregando…</div>}
                {nextUp === 'caught_up' && <div style={{ fontSize: 12, color: '#4caf7d' }}>✓ Em dia</div>}
                {nextUp && nextUp !== 'caught_up' && (
                  <div style={{ fontSize: 12, color: '#f59e0b' }}>Próximo: T{nextUp.season}E{nextUp.episode}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  {nextUp && nextUp !== 'caught_up' && (
                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => markFilmeWatched(f, nextUp)}>✓ Visto</button>
                  )}
                  <button className="btn btn-sm" onClick={() => onEdit(f)}>Editar</button>
                </div>
              </div>
            </div>
          )
        })}

        {watchingAnimes.map(a => {
          const current = a.list_status?.num_episodes_watched || 0
          const total = a.node.num_episodes || 0
          return (
            <div key={a.node.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '16/9', background: 'var(--bg4)', overflow: 'hidden' }}>
                {(a.node._cachedPoster || a.node.main_picture?.medium) && (
                  <img src={a.node._cachedPoster || a.node.main_picture?.medium} alt={a.node.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.node.title}</div>
                <div style={{ fontSize: 12, color: '#f59e0b' }}>Episódio {current + 1}{total > 0 ? ` de ${total}` : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => advanceAnime(a)}>✓ Visto</button>
                  <button className="btn btn-sm" onClick={() => setPage('animes')}>Ver</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
