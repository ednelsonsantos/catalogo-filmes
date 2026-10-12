import React, { useState, useEffect, useCallback } from 'react'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function EpisodesPanel({ filme, onUpdated, showToast }) {
  const tmdbId = Number(filme.tmdb_id)
  const [seasons, setSeasons] = useState(null)
  const [lastAired, setLastAired] = useState(null)
  const [nextAiring, setNextAiring] = useState(null)
  const [invalidId, setInvalidId] = useState(false)
  const [watchedSet, setWatchedSet] = useState(new Set())
  const [expanded, setExpanded] = useState(null)
  const [seasonEpisodes, setSeasonEpisodes] = useState({})
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadWatched = useCallback(async () => {
    try {
      const rows = await window.api.episodesGetWatched(filme.id)
      setWatchedSet(new Set(rows.map(r => `${r.season_number}-${r.episode_number}`)))
    } catch {}
  }, [filme.id])

  useEffect(() => { loadWatched() }, [loadWatched])

  useEffect(() => {
    let cancelled = false
    setSeasons(null)
    setLastAired(null)
    setNextAiring(null)
    setInvalidId(false)
    window.api.tmdbTvDetails({ id: tmdbId })
      .then(data => {
        if (cancelled) return
        if (data.success === false) { setInvalidId(true); setSeasons([]); return }
        setSeasons((data.seasons || []).filter(s => s.season_number >= 1))
        setLastAired(data.last_episode_to_air || null)
        setNextAiring(data.next_episode_to_air || null)
      })
      .catch(() => { if (!cancelled) setSeasons([]) })
    return () => { cancelled = true }
  }, [tmdbId])

  const today = new Date().toISOString().slice(0, 10)

  const toggleSeason = async (seasonNumber) => {
    if (expanded === seasonNumber) { setExpanded(null); return }
    setExpanded(seasonNumber)
    if (!seasonEpisodes[seasonNumber]) {
      setLoadingEpisodes(true)
      try {
        const data = await window.api.tmdbTvSeasonDetails({ id: tmdbId, season: seasonNumber })
        setSeasonEpisodes(prev => ({ ...prev, [seasonNumber]: data.episodes || [] }))
      } catch {
        showToast?.('Erro ao buscar episódios da temporada.', 'error')
      } finally {
        setLoadingEpisodes(false)
      }
    }
  }

  const toggleEpisode = async (seasonNumber, episodeNumber, aired) => {
    if (!aired) return
    const key = `${seasonNumber}-${episodeNumber}`
    const isWatched = watchedSet.has(key)
    const nextSet = new Set(watchedSet)
    isWatched ? nextSet.delete(key) : nextSet.add(key)
    setWatchedSet(nextSet)
    onUpdated?.({ ...filme, episodes_watched_count: nextSet.size })
    try {
      await window.api.episodesSetWatched({ filmeId: filme.id, season: seasonNumber, episode: episodeNumber, watched: !isWatched })
    } catch {
      showToast?.('Erro ao salvar episódio.', 'error')
      loadWatched()
    }
  }

  const markUpTo = async (seasonNumber, episodeNumber) => {
    const episodes = seasonEpisodes[seasonNumber] || []
    const toMark = episodes
      .filter(e => e.episode_number <= episodeNumber && e.air_date && e.air_date <= today)
      .map(e => ({ season: seasonNumber, episode: e.episode_number }))
    const nextSet = new Set(watchedSet)
    toMark.forEach(({ season, episode }) => nextSet.add(`${season}-${episode}`))
    setWatchedSet(nextSet)
    onUpdated?.({ ...filme, episodes_watched_count: nextSet.size })
    try {
      await window.api.episodesSetWatchedBulk({ filmeId: filme.id, episodes: toMark, watched: true })
    } catch {
      showToast?.('Erro ao marcar episódios.', 'error')
      loadWatched()
    }
  }

  const handleRefresh = async (markAllWatched = false) => {
    setRefreshing(true)
    try {
      const updated = await window.api.episodesRefresh({ filmeId: filme.id, tmdbId, markAllWatched })
      onUpdated?.(updated)
      await loadWatched()
      showToast?.(markAllWatched ? 'Todos os episódios lançados foram marcados!' : 'Episódios atualizados!', 'success')
    } catch (e) {
      showToast?.(e.message || 'Erro ao atualizar episódios.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const watchedCount = filme.episodes_watched_count || 0
  const missing = filme.episodes_aired != null ? Math.max(0, filme.episodes_aired - watchedCount) : null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Episódios</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => handleRefresh(false)} disabled={refreshing}>
            {refreshing ? 'Atualizando…' : '↻ Atualizar episódios'}
          </button>
          <button className="btn btn-sm" onClick={() => handleRefresh(true)} disabled={refreshing} title="Marca todos os episódios já lançados como assistidos">
            ✓ Marcar tudo assistido
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
        {filme.episodes_aired != null && (
          <span>✓ {watchedCount}/{filme.episodes_aired} assistidos</span>
        )}
        {missing != null && missing > 0 && (
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>faltam {missing}</span>
        )}
        {filme.episodes_aired == null && (
          <span style={{ color: 'var(--text3)' }}>Clique em "Atualizar episódios" pra ver o progresso</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
        {lastAired && (
          <span>📺 Episódio atual: T{lastAired.season_number}E{lastAired.episode_number} — {formatDate(lastAired.air_date)}</span>
        )}
        {nextAiring && (
          <span>📅 Próximo: T{nextAiring.season_number}E{nextAiring.episode_number} — {formatDate(nextAiring.air_date)}</span>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {seasons === null && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Carregando temporadas…</div>}
        {seasons?.length === 0 && invalidId && (
          <div style={{ fontSize: 12, color: '#f59e0b' }}>
            ⚠ O ID da TMDB salvo para este título ({filme.tmdb_id}) não existe mais — a TMDB pode ter mesclado ou removido essa página. Remova e re-adicione o título pela busca pra corrigir o vínculo.
          </div>
        )}
        {seasons?.length === 0 && !invalidId && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma temporada encontrada.</div>}
        {seasons?.map(s => {
          const isOpen = expanded === s.season_number
          const episodes = seasonEpisodes[s.season_number]
          const watchedInSeason = episodes
            ? episodes.filter(e => watchedSet.has(`${s.season_number}-${e.episode_number}`)).length
            : null
          return (
            <div key={s.season_number} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                onClick={() => toggleSeason(s.season_number)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--bg3)', border: 'none', cursor: 'pointer',
                  color: 'var(--text)', fontSize: 12, fontWeight: 500,
                }}
              >
                <span>{s.name || `Temporada ${s.season_number}`}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 400 }}>
                  {watchedInSeason != null ? `${watchedInSeason}/${s.episode_count} · ` : ''}{isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: '6px 10px' }}>
                  {loadingEpisodes && !episodes && <div style={{ fontSize: 12, color: 'var(--text3)', padding: 6 }}>Carregando episódios…</div>}
                  {episodes?.map(e => {
                    const aired = !!e.air_date && e.air_date <= today
                    const key = `${s.season_number}-${e.episode_number}`
                    const checked = watchedSet.has(key)
                    return (
                      <div
                        key={e.episode_number}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px',
                          opacity: aired ? 1 : 0.45,
                        }}
                      >
                        <label
                          style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: aired ? 'pointer' : 'default', minWidth: 0 }}
                          onClick={() => toggleEpisode(s.season_number, e.episode_number, aired)}
                        >
                          <span style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `1px solid ${checked ? '#4caf7d' : 'var(--border2)'}`,
                            background: checked ? 'rgba(76,175,125,0.25)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#4caf7d',
                          }}>
                            {checked ? '✓' : ''}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>Ep {e.episode_number}</span>
                          <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {e.name}
                          </span>
                        </label>
                        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                          {aired ? formatDate(e.air_date) : (e.air_date ? `${formatDate(e.air_date)} (em breve)` : '—')}
                        </span>
                        {aired && (
                          <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
                            onClick={() => markUpTo(s.season_number, e.episode_number)}
                            title="Marcar todos até este episódio">
                            até aqui
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
