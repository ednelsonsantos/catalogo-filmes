import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'

const STATUS_LABELS = {
  watching:      'Assistindo',
  completed:     'Completo',
  on_hold:       'Em pausa',
  dropped:       'Abandonado',
  plan_to_watch: 'Planejo assistir',
}

const STATUS_COLORS = {
  watching:      '#4a9eff',
  completed:     '#4caf7d',
  on_hold:       '#f59e0b',
  dropped:       '#ef4444',
  plan_to_watch: '#8b8b8b',
}

const FILTER_OPTIONS = [
  { value: 'all',           label: 'Todos' },
  { value: 'completed',     label: 'Completos' },
  { value: 'watching',      label: 'Assistindo' },
  { value: 'plan_to_watch', label: 'Planejo assistir' },
  { value: 'on_hold',       label: 'Em pausa' },
  { value: 'dropped',       label: 'Abandonados' },
]

const SCORE_LABELS = {
  0: 'Sem nota', 1: '(1) Horrível', 2: '(2) Terrível', 3: '(3) Muito ruim',
  4: '(4) Ruim', 5: '(5) Médio', 6: '(6) Bom', 7: '(7) Muito bom',
  8: '(8) Ótimo', 9: '(9) Excelente', 10: '(10) Obra-prima',
}

const IconGrid = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
const IconList = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)

export default function AnimePage({ settings, showToast, animeList, setAnimeList }) {
  const [status, setStatus]           = useState({ configured: false, authenticated: false })
  const animes    = animeList
  const setAnimes = setAnimeList
  const [loading, setLoading]         = useState(false)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState('title')
  const [viewMode, setViewMode]       = useState('grid')
  const [exporting, setExporting]     = useState(false)
  const [waitingAuth, setWaitingAuth] = useState(false)
  const [editAnime, setEditAnime]     = useState(null)
  const cleanupRef = useRef(null)

  const refreshStatus = useCallback(async () => {
    const s = await window.api.malGetStatus()
    setStatus(s)
    return s
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  useEffect(() => {
    const cleanup = window.api.onMalCallback(async ({ code, state }) => {
      setWaitingAuth(false)
      try {
        await window.api.malExchangeCode({ code, state })
        await refreshStatus()
        showToast('MyAnimeList conectado!', 'success')
      } catch (e) {
        showToast('Erro na autenticação: ' + e.message, 'error')
      }
    })
    cleanupRef.current = cleanup
    return () => cleanup?.()
  }, [refreshStatus, showToast])

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
      const allStatuses = ['completed', 'watching', 'on_hold', 'dropped', 'plan_to_watch']
      const collected = []
      for (const s of allStatuses) {
        try {
          const res = await window.api.malGetAnimeList({ status: s, limit: 1000 })
          const items = (res.data || []).map(item => ({
            node: item.node,
            list_status: { status: s, ...item.node.my_list_status },
          }))
          collected.push(...items)
        } catch {}
      }

      // baixa posters em lotes de 10 para não sobrecarregar
      const BATCH = 10
      const withPosters = [...collected]
      for (let i = 0; i < withPosters.length; i += BATCH) {
        const batch = withPosters.slice(i, i + BATCH)
        await Promise.all(batch.map(async (anime, bi) => {
          const url = anime.node.main_picture?.large || anime.node.main_picture?.medium
          if (!url) return
          try {
            const data = await window.api.malSavePoster({ malId: anime.node.id, url })
            if (data) withPosters[i + bi] = { ...anime, node: { ...anime.node, _cachedPoster: data } }
          } catch {}
        }))
        // atualiza o estado progressivamente para o usuário ver os posters chegando
        setAnimes([...withPosters])
      }

      showToast(`${collected.length} animes carregados do MAL.`, 'success')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

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
      setAnimes(prev => prev.map(a =>
        a.node.id === animeId
          ? { ...a, list_status: { ...a.list_status, ...patch } }
          : a
      ))
      showToast('Atualizado no MyAnimeList!', 'success')
      setEditAnime(null)
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    }
  }, [showToast])

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
    list = [...list].sort((a, b) => {
      if (sort === 'title')  return a.node.title.localeCompare(b.node.title, 'pt-BR')
      if (sort === 'score')  return (b.node.mean || 0) - (a.node.mean || 0)
      if (sort === 'myscore') return (b.list_status?.score || 0) - (a.list_status?.score || 0)
      if (sort === 'year')   return (b.node.start_date || '').localeCompare(a.node.start_date || '')
      if (sort === 'eps')    return (b.node.num_episodes || 0) - (a.node.num_episodes || 0)
      return 0
    })
    return list
  }, [animes, filter, search, sort])

  if (!settings.malConfigured) {
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1 className="page-title">Animes — MyAnimeList</h1>
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎌</div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Client ID não configurado</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20 }}>
            Acesse <strong>Configurações</strong> e informe o Client ID do MyAnimeList.
          </p>
          <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            Use o tipo <strong>other</strong> e coloque{' '}
            <code style={{ background: 'var(--bg4)', padding: '1px 5px', borderRadius: 4 }}>http://localhost:7813</code>{' '}
            como App Redirect URL.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Animes — MyAnimeList</h1>
        <div style={{ display: 'flex', gap: 8 }}>
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
        <div className="card" style={{ marginBottom: 20, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.25)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="spinner" style={{ width: 18, height: 18, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 500 }}>Aguardando autorização no navegador…</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              Autorize o acesso e volte aqui.
            </p>
          </div>
        </div>
      )}

      {!status.authenticated && !waitingAuth && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Conecte sua conta MAL</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20 }}>
            Clique em <strong>Conectar ao MAL</strong> para autorizar via OAuth2.
          </p>
        </div>
      )}

      {status.authenticated && animes.length === 0 && !loading && !waitingAuth && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            Clique em <strong>Carregar lista</strong> para buscar seus animes.
          </p>
        </div>
      )}

      {animes.length > 0 && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Buscar anime..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13, width: 200 }}
            />
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`btn btn-sm ${filter === opt.value ? 'btn-primary' : ''}`}
                onClick={() => setFilter(opt.value)}
                style={{ fontSize: 12 }}
              >
                {opt.label}{' '}
                ({opt.value === 'all'
                  ? animes.length
                  : animes.filter(a => a.list_status?.status === opt.value).length})
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                style={{ padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12 }}
              >
                <option value="title">A → Z</option>
                <option value="score">Melhor score MAL</option>
                <option value="myscore">Minha nota</option>
                <option value="year">Mais recente</option>
                <option value="eps">Mais episódios</option>
              </select>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  className="btn btn-icon btn-sm"
                  onClick={() => setViewMode('grid')}
                  style={viewMode === 'grid' ? { background: 'var(--bg4)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                >
                  <IconGrid />
                </button>
                <button
                  className="btn btn-icon btn-sm"
                  onClick={() => setViewMode('list')}
                  style={viewMode === 'list' ? { background: 'var(--bg4)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                >
                  <IconList />
                </button>
              </div>
            </div>
          </div>

          {/* Grid */}
          {viewMode === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
              {filtered.map(anime => (
                <AnimeCard key={anime.node.id} node={anime.node} listStatus={anime.list_status} onClick={() => setEditAnime(anime)} />
              ))}
            </div>
          )}

          {/* List */}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(anime => (
                <AnimeListRow key={anime.node.id} node={anime.node} listStatus={anime.list_status} onClick={() => setEditAnime(anime)} />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
              Nenhum anime encontrado.
            </div>
          )}
        </>
      )}

      {editAnime && (
        <AnimeEditModal
          anime={editAnime}
          onSave={handleSaveEdit}
          onClose={() => setEditAnime(null)}
        />
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function AnimeCard({ node, listStatus, onClick }) {
  const posterUrl   = node.main_picture?.large || node.main_picture?.medium
  const [imgSrc, setImgSrc]   = useState(node._cachedPoster || null)
  const [imgError, setImgError] = useState(false)
  const statusColor = STATUS_COLORS[listStatus?.status] || '#666'
  const statusLabel = STATUS_LABELS[listStatus?.status] || listStatus?.status || ''
  const myScore     = listStatus?.score > 0 ? listStatus.score : null
  const malScore    = node.mean ? Number(node.mean).toFixed(2) : null

  // fallback para animes adicionados via busca (sem _cachedPoster ainda)
  useEffect(() => {
    if (imgSrc || !posterUrl) return
    window.api.malSavePoster({ malId: node.id, url: posterUrl })
      .then(data => { if (data) setImgSrc(data) })
      .catch(() => {})
  }, [node.id])

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 8, overflow: 'hidden', display: 'flex',
        flexDirection: 'column', cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.transform = 'none' }}
    >
      <div style={{ position: 'relative', aspectRatio: '2/3', background: 'var(--bg4)', overflow: 'hidden' }}>
        {imgSrc && !imgError ? (
          <img src={imgSrc} alt={node.title} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎌</div>
        )}

        {/* Badge status */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: `${statusColor}ee`,
          color: '#fff', fontSize: 9, fontWeight: 700,
          padding: '3px 6px', textTransform: 'uppercase',
          letterSpacing: '0.05em', textAlign: 'center',
        }}>
          {statusLabel}
        </div>

        {/* Minha nota */}
        {myScore && (
          <div style={{
            position: 'absolute', top: 5, right: 5,
            background: 'rgba(0,0,0,0.8)', color: '#f59e0b',
            fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
          }}>
            ★ {myScore}
          </div>
        )}
      </div>

      <div style={{ padding: '8px 8px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text)',
          lineHeight: 1.4, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {node.title}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          {node.num_episodes > 0
            ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>{node.num_episodes} eps</span>
            : listStatus?.num_episodes_watched > 0
              ? <span style={{ fontSize: 10, color: 'var(--text3)' }}>{listStatus.num_episodes_watched} vistos</span>
              : null
          }
          {malScore && (
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>⭐ {malScore}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function AnimeListRow({ node, listStatus, onClick }) {
  const [imgSrc, setImgSrc] = useState(node._cachedPoster || null)
  const [imgError, setImgError] = useState(false)
  const posterUrl   = node.main_picture?.large || node.main_picture?.medium
  const statusColor = STATUS_COLORS[listStatus?.status] || '#666'
  const statusLabel = STATUS_LABELS[listStatus?.status] || listStatus?.status || ''
  const myScore     = listStatus?.score > 0 ? listStatus.score : null
  const malScore    = node.mean ? Number(node.mean).toFixed(2) : null

  useEffect(() => {
    if (imgSrc || !posterUrl) return
    window.api.malSavePoster({ malId: node.id, url: posterUrl })
      .then(data => { if (data) setImgSrc(data) })
      .catch(() => {})
  }, [node.id])

  const epsLabel = node.num_episodes > 0
    ? `${node.num_episodes} ep`
    : listStatus?.num_episodes_watched > 0
      ? `${listStatus.num_episodes_watched} vistos`
      : null

  return (
    <div
      onClick={onClick}
      className="disc-list-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)' }}
    >
      {/* Thumb */}
      <div style={{ width: 36, height: 52, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--bg4)' }}>
        {imgSrc && !imgError ? (
          <img src={imgSrc} alt={node.title} onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎌</div>
        )}
      </div>

      {/* Título + alt */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.title}
        </p>
        {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.alternative_titles.en}
          </p>
        )}
      </div>

      {/* Episódios */}
      {epsLabel && (
        <span style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0, minWidth: 60, textAlign: 'right' }}>
          {epsLabel}
        </span>
      )}

      {/* Score MAL */}
      {malScore && (
        <span style={{ fontSize: 12, color: '#f59e0b', flexShrink: 0, minWidth: 48, textAlign: 'right' }}>
          ⭐ {malScore}
        </span>
      )}

      {/* Minha nota */}
      {myScore && (
        <span style={{ fontSize: 12, color: '#4a9eff', flexShrink: 0, minWidth: 32, textAlign: 'right' }}>
          ★ {myScore}
        </span>
      )}

      {/* Status badge */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
        background: `${statusColor}22`, color: statusColor,
        flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {statusLabel}
      </span>
    </div>
  )
}

// ─── Modal de edição ──────────────────────────────────────────────────────────

function AnimeEditModal({ anime, onSave, onClose }) {
  const { node, list_status } = anime
  const [form, setForm] = useState({
    status:               list_status?.status       || 'plan_to_watch',
    score:                list_status?.score        ?? 0,
    num_episodes_watched: list_status?.num_episodes_watched ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const poster   = node._cachedPoster || node.main_picture?.large || node.main_picture?.medium
  const malScore = node.mean ? Number(node.mean).toFixed(2) : null

  const handleSave = async () => {
    setSaving(true)
    await onSave(node.id, {
      status:               form.status,
      score:                Number(form.score),
      num_episodes_watched: Number(form.num_episodes_watched),
    })
    setSaving(false)
  }

  // fecha com Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalEps = node.num_episodes || 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
    >
      <div style={{
        background: 'var(--bg2)', borderRadius: 12, width: '100%', maxWidth: 560,
        border: '1px solid var(--border2)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Topo com poster + info */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg3)' }}>
          {/* Poster */}
          {poster && (
            <div style={{ width: 100, flexShrink: 0, aspectRatio: '2/3', overflow: 'hidden' }}>
              <img src={poster} alt={node.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          {/* Info do anime */}
          <div style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
              {node.title}
            </h2>
            {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
                {node.alternative_titles.en}
              </p>
            )}

            {/* Scores lado a lado */}
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              {malScore && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>⭐ {malScore}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Score MAL</div>
                </div>
              )}
              {form.score > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#4a9eff' }}>★ {form.score}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Minha nota</div>
                </div>
              )}
            </div>

            {/* Metadados */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 2 }}>
              {node.media_type && (
                <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>
                  {node.media_type}
                </span>
              )}
              {totalEps > 0 && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{totalEps} episódios</span>
              )}
              {node.start_date && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{node.start_date.slice(0, 4)}</span>
              )}
              {(node.genres || []).slice(0, 3).map(g => (
                <span key={g.id} style={{
                  fontSize: 10, color: 'var(--text2)',
                  background: 'var(--bg4)', padding: '1px 6px',
                  borderRadius: 99,
                }}>
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Formulário */}
        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

          {/* Status */}
          <div className="field">
            <label>Status na lista</label>
            <select
              value={form.status}
              onChange={e => {
                const s = e.target.value
                const updates = { status: s }
                // se marcou completo, preenche eps automaticamente
                if (s === 'completed' && totalEps > 0) updates.num_episodes_watched = totalEps
                setForm(f => ({ ...f, ...updates }))
              }}
              style={{ background: `${STATUS_COLORS[form.status]}22`, borderColor: STATUS_COLORS[form.status], fontWeight: 600, color: STATUS_COLORS[form.status] }}
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val} style={{ background: 'var(--bg3)', color: 'var(--text)' }}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Episódios */}
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Episódios assistidos</span>
              {totalEps > 0 && (
                <span style={{ color: 'var(--text3)', fontWeight: 400 }}>de {totalEps}</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number" min={0} max={totalEps || 9999}
                value={form.num_episodes_watched}
                onChange={e => setForm(f => ({ ...f, num_episodes_watched: Math.max(0, Number(e.target.value)) }))}
                style={{ flex: 1 }}
              />
              {totalEps > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => setForm(f => ({ ...f, num_episodes_watched: totalEps }))}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Completo
                </button>
              )}
            </div>
            {totalEps > 0 && (
              <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 99, marginTop: 4 }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  background: STATUS_COLORS[form.status] || 'var(--accent)',
                  width: `${Math.min(100, (form.num_episodes_watched / totalEps) * 100)}%`,
                  transition: 'width 0.2s',
                }} />
              </div>
            )}
          </div>

          {/* Nota */}
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Minha nota</span>
              <span style={{ color: form.score > 0 ? '#4a9eff' : 'var(--text3)', fontWeight: form.score > 0 ? 600 : 400 }}>
                {SCORE_LABELS[form.score]}
              </span>
            </label>
            <input
              type="range" min={0} max={10} step={1}
              value={form.score}
              onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#4a9eff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              <span>Sem nota</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 20px' }}>
          <button className="btn btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar no MAL'}
          </button>
        </div>
      </div>
    </div>
  )
}
