import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AnimeCard, AnimeListRow } from '../components/anime/AnimeCard.jsx'
import AnimeStatusModal from '../components/anime/AnimeStatusModal.jsx'
import { posterUrl } from '../utils/mal.js'
import '../components/anime/anime.css'

const FILTER_OPTIONS = [
  { value: 'all',           label: 'Todos' },
  { value: 'completed',     label: 'Completos' },
  { value: 'watching',      label: 'Assistindo' },
  { value: 'plan_to_watch', label: 'Planejo assistir' },
  { value: 'on_hold',       label: 'Em pausa' },
  { value: 'dropped',       label: 'Abandonados' },
]

const ALL_STATUSES = ['completed', 'watching', 'on_hold', 'dropped', 'plan_to_watch']

const IconGrid = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
const IconList = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)

function sortAnimes(list, sort) {
  return [...list].sort((a, b) => {
    if (sort === 'title')   return a.node.title.localeCompare(b.node.title, 'pt-BR')
    if (sort === 'score')   return (b.node.mean || 0) - (a.node.mean || 0)
    if (sort === 'myscore') return (b.list_status?.score || 0) - (a.list_status?.score || 0)
    if (sort === 'year')    return (b.node.start_date || '').localeCompare(a.node.start_date || '')
    if (sort === 'eps')     return (b.node.num_episodes || 0) - (a.node.num_episodes || 0)
    return 0
  })
}

export default function AnimePage({ settings, showToast, animeList: animes, setAnimeList: setAnimes }) {
  const [status, setStatus]           = useState({ configured: false, authenticated: false })
  const [loading, setLoading]         = useState(false)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState('title')
  const [viewMode, setViewMode]       = useState('grid')
  const [exporting, setExporting]     = useState(false)
  const [waitingAuth, setWaitingAuth] = useState(false)
  const [editAnime, setEditAnime]     = useState(null)

  const refreshStatus = useCallback(async () => {
    const s = await window.api.malGetStatus()
    setStatus(s)
    return s
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  // volta do navegador depois de autorizar (OAuth2)
  useEffect(() => window.api.onMalCallback(async ({ code, state }) => {
    setWaitingAuth(false)
    try {
      await window.api.malExchangeCode({ code, state })
      await refreshStatus()
      showToast('MyAnimeList conectado!', 'success')
    } catch (e) {
      showToast('Erro na autenticação: ' + e.message, 'error')
    }
  }), [refreshStatus, showToast])

  const handleAuth = async () => {
    try { setWaitingAuth(true); await window.api.malStartAuth() }
    catch (e) { setWaitingAuth(false); showToast(e.message, 'error') }
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar do MyAnimeList?')) return
    await window.api.malDisconnect()
    setAnimes([])
    await refreshStatus()
    showToast('Desconectado do MAL.', 'info')
  }

  const handleLoad = async () => {
    setLoading(true)
    try {
      const collected = []
      for (const s of ALL_STATUSES) {
        try {
          const res = await window.api.malGetAnimeList({ status: s, limit: 1000 })
          collected.push(...(res.data || []).map(item => ({
            node: item.node,
            list_status: { status: s, ...item.node.my_list_status },
          })))
        } catch {}
      }

      // baixa os pôsteres em lotes de 10 pra não sobrecarregar, mostrando conforme chegam
      const BATCH = 10
      const withPosters = [...collected]
      for (let i = 0; i < withPosters.length; i += BATCH) {
        await Promise.all(withPosters.slice(i, i + BATCH).map(async (anime, bi) => {
          const url = posterUrl(anime.node)
          if (!url) return
          try {
            const data = await window.api.malSavePoster({ malId: anime.node.id, url })
            if (data) withPosters[i + bi] = { ...anime, node: { ...anime.node, _cachedPoster: data } }
          } catch {}
        }))
        setAnimes([...withPosters])
      }

      showToast(`${collected.length} animes carregados do MAL.`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = animes
    if (filter !== 'all') list = list.filter(a => a.list_status?.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.node.title.toLowerCase().includes(q) ||
        (a.node.alternative_titles?.en || '').toLowerCase().includes(q)
      )
    }
    return sortAnimes(list, sort)
  }, [animes, filter, search, sort])

  const counts = useMemo(() => {
    const c = { all: animes.length }
    for (const a of animes) c[a.list_status?.status] = (c[a.list_status?.status] || 0) + 1
    return c
  }, [animes])

  const handleExport = async () => {
    if (animes.length === 0) return showToast('Carregue a lista primeiro.', 'info')
    setExporting(true)
    try {
      const res = await window.api.exportMalJson({ animes: filtered })
      if (res.success) showToast('JSON exportado!', 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleSaveEdit = useCallback(async (animeId, patch) => {
    try {
      await window.api.malUpdateAnime({ animeId, patch })
      // atualiza localmente sem precisar recarregar tudo
      setAnimes(prev => prev.map(a => (a.node.id === animeId ? { ...a, list_status: { ...a.list_status, ...patch } } : a)))
      showToast('Atualizado no MyAnimeList!', 'success')
      setEditAnime(null)
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    }
  }, [setAnimes, showToast])

  const closeEdit = useCallback(() => setEditAnime(null), [])

  if (!settings.malConfigured) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1 className="page-title">MyAnimeList</h1>
        <div className="card anime-empty">
          <div className="anime-empty-icon">🎌</div>
          <h2>Client ID não configurado</h2>
          <p>Acesse <strong>Configurações</strong> e informe o Client ID do MyAnimeList.</p>
          <p className="anime-empty-hint">
            Use o tipo <strong>other</strong> e coloque <code>http://localhost:7813</code> como App Redirect URL.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="anime-header">
        <h1 className="page-title">MyAnimeList</h1>
        <div className="anime-header-actions">
          {status.authenticated && animes.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exportando…' : `Exportar JSON (${filtered.length})`}
            </button>
          )}
          {status.authenticated && (
            <button className="btn btn-sm" onClick={handleLoad} disabled={loading}>
              {loading ? 'Carregando…' : animes.length > 0 ? 'Atualizar lista' : 'Carregar lista'}
            </button>
          )}
          {status.authenticated ? (
            <button className="btn btn-sm btn-danger" onClick={handleDisconnect}>Desconectar</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleAuth} disabled={waitingAuth}>
              {waitingAuth ? 'Aguardando autorização…' : 'Conectar ao MAL'}
            </button>
          )}
        </div>
      </div>

      {waitingAuth && (
        <div className="card anime-waiting">
          <div className="spinner" />
          <div>
            <p>Aguardando autorização no navegador…</p>
            <p>Autorize o acesso e volte aqui.</p>
          </div>
        </div>
      )}

      {!status.authenticated && !waitingAuth && (
        <div className="card anime-empty">
          <div className="anime-empty-icon">🔐</div>
          <h2>Conecte sua conta MAL</h2>
          <p>Clique em <strong>Conectar ao MAL</strong> para autorizar via OAuth2.</p>
        </div>
      )}

      {status.authenticated && animes.length === 0 && !loading && !waitingAuth && (
        <div className="card anime-empty">
          <div className="anime-empty-icon">📋</div>
          <p>Clique em <strong>Carregar lista</strong> para buscar seus animes.</p>
        </div>
      )}

      {animes.length > 0 && (
        <>
          <div className="anime-toolbar">
            <input type="text" className="anime-search" placeholder="Buscar anime..." value={search} onChange={e => setSearch(e.target.value)} />
            {FILTER_OPTIONS.map(opt => (
              <button key={opt.value} className={`btn btn-sm ${filter === opt.value ? 'btn-primary' : ''}`} onClick={() => setFilter(opt.value)}>
                {opt.label} ({counts[opt.value] || 0})
              </button>
            ))}
            <div className="anime-toolbar-right">
              <select className="anime-sort" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="title">A → Z</option>
                <option value="score">Melhor score MAL</option>
                <option value="myscore">Minha nota</option>
                <option value="year">Mais recente</option>
                <option value="eps">Mais episódios</option>
              </select>
              <div className="anime-view-toggle">
                <button className={`btn btn-icon btn-sm ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grade" title="Grade"><IconGrid /></button>
                <button className={`btn btn-icon btn-sm ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} aria-label="Lista" title="Lista"><IconList /></button>
              </div>
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="anime-grid">
              {filtered.map(anime => (
                <AnimeCard key={anime.node.id} node={anime.node} listStatus={anime.list_status} onClick={() => setEditAnime(anime)} />
              ))}
            </div>
          ) : (
            <div className="anime-list">
              {filtered.map(anime => (
                <AnimeListRow key={anime.node.id} node={anime.node} listStatus={anime.list_status} onClick={() => setEditAnime(anime)} />
              ))}
            </div>
          )}

          {filtered.length === 0 && <div className="anime-none">Nenhum anime encontrado.</div>}
        </>
      )}

      {editAnime && <AnimeStatusModal anime={editAnime} mode="edit" onSave={handleSaveEdit} onClose={closeEdit} />}
    </div>
  )
}
