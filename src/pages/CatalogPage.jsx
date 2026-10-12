import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import DiscCard from '../components/DiscCard.jsx'
import DiscDetailModal from '../components/DiscDetailModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { SERIES_CATEGORIES } from '../constants.js'
import './CatalogPage.css'

const IconSearch = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>)
const IconExport = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>)
const IconGrid = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
const IconList = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)

// Formato = o que você possui (a mídia física/digital). Eixo independente do status de visualização.
const FORMAT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'DVD', label: 'DVD' },
  { id: 'Blu-ray', label: 'Blu-ray' },
  { id: '4K UHD', label: '4K UHD' },
  { id: 'VHS', label: 'VHS' },
  { id: 'Digital', label: 'Digital' },
]

// Status = se você já assistiu ou está assistindo. Combina com o filtro de formato (ex: Blu-ray + Assistidos).
const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'assistidos', label: '✓ Assistidos' },
  { id: 'assistindo', label: '▶ Assistindo' },
]

const ALL_CATEGORIES = ['Filme', 'Série', 'Mini-série', 'Documentário', 'Animação', 'Anime', 'Show/Stand-up', 'Musical', 'Esporte', 'Streaming', 'Outro']

export default function CatalogPage({ filmes, onEdit, onDelete, onToggleWatched, onFilmeUpdated, showToast, selectedCollection }) {
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState('all')
  const [watchStatus, setWatchStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('title')
  const [viewMode, setViewMode] = useState('grid')
  const [detail, setDetail] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [bulkRefreshing, setBulkRefreshing] = useState(null) // { done, total } ou null
  const [brokenLinks, setBrokenLinks] = useState(null) // [{ id, title }] ou null
  const searchRef = useRef(null)

  const trackableFilmes = useMemo(
    () => filmes.filter(f => f.tmdb_id && f.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(f.category)),
    [filmes]
  )

  const handleBulkRefreshEpisodes = useCallback(async () => {
    const targets = trackableFilmes
    if (targets.length === 0) return
    setBulkRefreshing({ done: 0, total: targets.length })
    setBrokenLinks(null)
    let okCount = 0
    const failed = []
    for (let i = 0; i < targets.length; i++) {
      const f = targets[i]
      try {
        // Marca tudo como visto automaticamente só no catch-up único de título "Assistido" legado
        // (nunca teve nenhum episódio registrado ainda). Se já tem episódios marcados, não mexe —
        // senão uma temporada nova lançada depois seria marcada como vista sem o usuário ter assistido
        const isLegacyWatched = !!f.watched_at && (f.episodes_watched_count || 0) === 0
        const updated = await window.api.episodesRefresh({ filmeId: f.id, tmdbId: f.tmdb_id, markAllWatched: isLegacyWatched })
        onFilmeUpdated?.(updated)
        okCount++
      } catch {
        failed.push({ id: f.id, title: f.title })
      }
      setBulkRefreshing({ done: i + 1, total: targets.length })
    }
    setBulkRefreshing(null)
    if (failed.length > 0) {
      setBrokenLinks(failed)
    } else {
      showToast(`${okCount} séries/animes atualizados!`, 'success')
    }
  }, [trackableFilmes, onFilmeUpdated, showToast])

  const hasActiveFilters = search || format !== 'all' || watchStatus !== 'all' || category !== 'all'

  const clearFilters = useCallback(() => {
    setSearch(''); setFormat('all'); setWatchStatus('all'); setCategory('all')
    searchRef.current?.focus()
  }, [])

  // Ctrl+F foca na busca
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = useMemo(() => {
    let items = [...filmes]
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(f =>
        f.title?.toLowerCase().includes(q) ||
        f.original_title?.toLowerCase().includes(q) ||
        f.director?.toLowerCase().includes(q) ||
        f.genre?.toLowerCase().includes(q) ||
        f.cast?.toLowerCase().includes(q)
      )
    }
    if (format !== 'all') {
      items = items.filter(f => (f.formats || f.format || '').split(',').map(x => x.trim()).includes(format))
    }
    if (watchStatus === 'assistidos') {
      items = items.filter(f => !!f.watched_at)
    } else if (watchStatus === 'assistindo') {
      items = items.filter(f => !!f.watching)
    }
    if (category !== 'all') {
      items = items.filter(f => (f.category || '') === category)
    }
    items.sort((a, b) => {
      if (sort === 'title')  return (a.title || '').localeCompare(b.title || '', 'pt-BR')
      if (sort === 'year')   return (b.year || 0) - (a.year || 0)
      if (sort === 'rating') return parseFloat(b.imdb_rating || 0) - parseFloat(a.imdb_rating || 0)
      if (sort === 'added')  return b.id - a.id
      if (sort === 'watched') return (b.watched_at || '').localeCompare(a.watched_at || '')
      return 0
    })
    return items
  }, [filmes, search, format, watchStatus, category, sort])

  const handleDelete = useCallback((filme) => {
    setConfirmingDelete(filme)
  }, [])

  const confirmDelete = useCallback(async () => {
    const filme = confirmingDelete
    if (!filme) return
    setConfirmingDelete(null)
    await window.api.delete(filme.id)
    onDelete(); setDetail(null)
    showToast(`"${filme.title}" removido.`, 'info')
  }, [confirmingDelete, onDelete, showToast])

  const handleExport = useCallback(async (type) => {
    setExporting(true)
    try {
      const opts = selectedCollection ? { filmeIds: filmes.map(f => f.id) } : undefined
      const result = type === 'csv'
        ? await window.api.exportCsv(opts)
        : type === 'xlsx'
          ? await window.api.exportXlsx(opts)
          : await window.api.exportSiteJson(opts)
      if (result.success) showToast('Exportado com sucesso!')
    } catch { showToast('Erro ao exportar.', 'error') }
    finally { setExporting(false) }
  }, [showToast, selectedCollection, filmes])

  const stats = useMemo(() => {
    const categoryCounts = {}
    for (const f of filmes) {
      const c = f.category || ''
      if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1
    }
    const uhd = filmes.filter(f => (f.formats || f.format || '').includes('4K UHD')).length
    const watched = filmes.filter(f => !!f.watched_at).length
    const watching = filmes.filter(f => !!f.watching).length
    const lastAdded = filmes.length ? [...filmes].sort((a, b) => b.id - a.id)[0] : null
    return {
      total: filmes.length,
      bluray: filmes.filter(f => (f.formats || f.format || '').includes('Blu-ray')).length,
      dvd: filmes.filter(f => (f.formats || f.format || '').includes('DVD')).length,
      uhd,
      watched,
      watchedPct: filmes.length ? Math.round((watched / filmes.length) * 100) : 0,
      watching,
      categoryCounts,
      lastAdded,
    }
  }, [filmes])

  return (
    <div className="page catalog-page">
      {/* Stats */}
      <div className="stats-bar">
        <div className="stat"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
        <div className="stat-divider"/>
        <div className="stat"><span className="stat-value">{stats.bluray}</span><span className="stat-label">Blu-ray</span></div>
        {stats.uhd > 0 && <><div className="stat-divider"/><div className="stat"><span className="stat-value">{stats.uhd}</span><span className="stat-label">4K UHD</span></div></>}
        <div className="stat-divider"/>
        <div className="stat"><span className="stat-value">{stats.dvd}</span><span className="stat-label">DVD</span></div>
        <div className="stat-divider"/>
        <div className="stat" title={`${stats.watchedPct}% da coleção`}>
          <span className="stat-value">{stats.watched}</span>
          <span className="stat-label">Assistidos {stats.total > 0 && <span style={{ fontSize: 10, opacity: 0.7 }}>({stats.watchedPct}%)</span>}</span>
        </div>
        {stats.watching > 0 && (
          <>
            <div className="stat-divider"/>
            <div className="stat">
              <span className="stat-value">{stats.watching}</span>
              <span className="stat-label">Assistindo</span>
            </div>
          </>
        )}
        {stats.lastAdded && (
          <>
            <div className="stat-divider"/>
            <div className="stat" title={`Último adicionado: ${stats.lastAdded.title}`}>
              <span className="stat-value" style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stats.lastAdded.title}</span>
              <span className="stat-label">Último adicionado</span>
            </div>
          </>
        )}
        <div style={{ flex: 1 }}/>
        <div className="export-group">
          {selectedCollection && (
            <span style={{ fontSize: 10, color: 'var(--accent)', alignSelf: 'center', whiteSpace: 'nowrap' }}>
              ↳ {selectedCollection.name}
            </span>
          )}
          {trackableFilmes.length > 0 && (
            <button
              className="btn btn-sm"
              onClick={handleBulkRefreshEpisodes}
              disabled={!!bulkRefreshing}
              title="Busca na TMDB quantos episódios já saíram pra todas as séries/animes do catálogo (não marca nada como assistido)"
            >
              {bulkRefreshing ? `Atualizando ${bulkRefreshing.done}/${bulkRefreshing.total}…` : `↻ Atualizar episódios (${trackableFilmes.length})`}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => handleExport('csv')} disabled={exporting} title={selectedCollection ? `Exportar coleção "${selectedCollection.name}"` : 'Exportar tudo'}><IconExport /> CSV</button>
          <button className="btn btn-sm" onClick={() => handleExport('xlsx')} disabled={exporting} title={selectedCollection ? `Exportar coleção "${selectedCollection.name}"` : 'Exportar tudo'}><IconExport /> Excel</button>
          <button className="btn btn-sm" onClick={() => handleExport('site')} disabled={exporting} title={selectedCollection ? `Exportar coleção "${selectedCollection.name}"` : 'Exportar tudo'}><IconExport /> Site</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch />
          <input ref={searchRef} className="search-input" placeholder="Buscar título, diretor, gênero... (Ctrl+F)" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="clear-search" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="toolbar-right">
          <div className="filter-group" title="Formato — o que você possui">
            {FORMAT_FILTERS.map(f => (
              <button key={f.id} className={`filter-btn ${format === f.id ? 'active' : ''}`} onClick={() => setFormat(f.id)}>{f.label}</button>
            ))}
          </div>
          <div className="filter-group" title="Status — o que você já assistiu">
            {STATUS_FILTERS.map(f => (
              <button key={f.id} className={`filter-btn ${watchStatus === f.id ? 'active' : ''}`} onClick={() => setWatchStatus(f.id)}>{f.label}</button>
            ))}
          </div>
          <select className="sort-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}{stats.categoryCounts[c] ? ` (${stats.categoryCounts[c]})` : ''}</option>
            ))}
          </select>
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="title">A → Z</option>
            <option value="year">Mais recente</option>
            <option value="rating">Melhor nota</option>
            <option value="watched">Assistido recentemente</option>
            <option value="added">Adicionado por último</option>
          </select>
          <div className="view-toggle">
            <button className={`btn btn-icon btn-sm ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><IconGrid /></button>
            <button className={`btn btn-icon btn-sm ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><IconList /></button>
          </div>
          {hasActiveFilters && (
            <button className="btn btn-sm btn-ghost" onClick={clearFilters} style={{ color: 'var(--red)', borderColor: 'rgba(200,60,60,0.3)' }}>
              ✕ Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Contagem de resultados filtrados */}
      {hasActiveFilters && filmes.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '0 2px 12px', marginTop: -8 }}>
          Exibindo <strong style={{ color: 'var(--text2)' }}>{filtered.length}</strong> de <strong style={{ color: 'var(--text2)' }}>{filmes.length}</strong> título{filmes.length !== 1 ? 's' : ''}
          {filtered.length === 0 && <span style={{ color: 'var(--red)', marginLeft: 6 }}>— nenhum resultado</span>}
        </div>
      )}

      {/* Grid / List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          {filmes.length === 0
            ? <><div className="empty-icon">🎬</div><p>Sua coleção está vazia.</p><span>Clique em "Adicionar Título" para começar!</span></>
            : <><div className="empty-icon">🔍</div><p>Nenhum resultado{search ? ` para "${search}"` : category !== 'all' ? ` na categoria "${category}"` : ''}</p></>
          }
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'disc-grid' : 'disc-list'}>
          {filtered.map(f => (
            <DiscCard key={f.id} filme={f} viewMode={viewMode}
              onClick={() => setDetail(f)} onEdit={() => onEdit(f)} onDelete={() => handleDelete(f)}
              onToggleWatched={onToggleWatched} />
          ))}
        </div>
      )}

      {detail && (
        <DiscDetailModal filme={detail} onClose={() => setDetail(null)}
          onEdit={() => { onEdit(detail); setDetail(null) }}
          onDelete={() => handleDelete(detail)}
          onUpdated={(updated) => { setDetail(updated); onFilmeUpdated?.(updated) }}
          showToast={showToast} />
      )}

      {confirmingDelete && (
        <ConfirmModal
          title="Remover título"
          message={`Tem certeza que quer remover "${confirmingDelete.title}" da sua coleção? Essa ação não pode ser desfeita.`}
          confirmLabel="Remover"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}

      {brokenLinks && (
        <div
          onClick={e => e.target === e.currentTarget && setBrokenLinks(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24 }}
        >
          <div style={{ background: 'var(--bg2)', borderRadius: 12, width: '100%', maxWidth: 440, border: '1px solid var(--border2)', padding: '20px 20px 16px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>⚠ Vínculos TMDB quebrados</h3>
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginTop: 8 }}>
              A TMDB não reconhece mais o ID salvo pra estes títulos (pode ter sido mesclado/removido numa limpeza deles). Remova e re-adicione cada um pela busca pra corrigir o vínculo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, maxHeight: 220, overflowY: 'auto' }}>
              {brokenLinks.map(b => {
                const full = filmes.find(f => f.id === b.id)
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                    <button className="btn btn-sm" onClick={() => { setBrokenLinks(null); if (full) onEdit(full) }}>Editar</button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setBrokenLinks(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
