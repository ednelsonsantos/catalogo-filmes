import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import DiscCard from '../components/DiscCard.jsx'
import DiscDetailModal from '../components/DiscDetailModal.jsx'
import './CatalogPage.css'

const IconSearch = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>)
const IconExport = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>)
const IconGrid = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
const IconList = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)

const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'DVD', label: 'DVD' },
  { id: 'Blu-ray', label: 'Blu-ray' },
  { id: '4K UHD', label: '4K UHD' },
  { id: 'assistidos', label: '✓ Assistidos' },
]

const ALL_CATEGORIES = ['Filme', 'Série', 'Mini-série', 'Documentário', 'Animação', 'Anime', 'Show/Stand-up', 'Musical', 'Esporte', 'Outro']

export default function CatalogPage({ filmes, onEdit, onDelete, onToggleWatched, showToast }) {
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('title')
  const [viewMode, setViewMode] = useState('grid')
  const [detail, setDetail] = useState(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef(null)

  const hasActiveFilters = search || format !== 'all' || category !== 'all'

  const clearFilters = useCallback(() => {
    setSearch(''); setFormat('all'); setCategory('all')
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
    if (format === 'assistidos') {
      items = items.filter(f => !!f.watched_at)
    } else if (format !== 'all') {
      items = items.filter(f => (f.formats || f.format || '').split(',').map(x => x.trim()).includes(format))
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
  }, [filmes, search, format, category, sort])

  const handleDelete = useCallback(async (filme) => {
    if (!confirm(`Remover "${filme.title}" da coleção?`)) return
    await window.api.delete(filme.id)
    onDelete(); setDetail(null)
    showToast(`"${filme.title}" removido.`, 'info')
  }, [onDelete, showToast])

  const handleExport = useCallback(async (type) => {
    setExporting(true)
    try {
      const result = type === 'csv' ? await window.api.exportCsv() : type === 'xlsx' ? await window.api.exportXlsx() : await window.api.exportSiteJson()
      if (result.success) showToast('Exportado com sucesso!')
    } catch { showToast('Erro ao exportar.', 'error') }
    finally { setExporting(false) }
  }, [showToast])

  const stats = useMemo(() => {
    const categoryCounts = {}
    for (const f of filmes) {
      const c = f.category || ''
      if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1
    }
    const uhd = filmes.filter(f => (f.formats || f.format || '').includes('4K UHD')).length
    const watched = filmes.filter(f => !!f.watched_at).length
    const lastAdded = filmes.length ? [...filmes].sort((a, b) => b.id - a.id)[0] : null
    return {
      total: filmes.length,
      bluray: filmes.filter(f => (f.formats || f.format || '').includes('Blu-ray')).length,
      dvd: filmes.filter(f => (f.formats || f.format || '').includes('DVD')).length,
      uhd,
      watched,
      watchedPct: filmes.length ? Math.round((watched / filmes.length) * 100) : 0,
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
          <button className="btn btn-sm" onClick={() => handleExport('csv')} disabled={exporting}><IconExport /> CSV</button>
          <button className="btn btn-sm" onClick={() => handleExport('xlsx')} disabled={exporting}><IconExport /> Excel</button>
          <button className="btn btn-sm" onClick={() => handleExport('site')} disabled={exporting}><IconExport /> Site</button>
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
          <div className="filter-group">
            {FILTERS.map(f => (
              <button key={f.id} className={`filter-btn ${format === f.id ? 'active' : ''}`} onClick={() => setFormat(f.id)}>{f.label}</button>
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
          onDelete={() => handleDelete(detail)} />
      )}
    </div>
  )
}
