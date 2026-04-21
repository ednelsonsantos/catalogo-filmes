import React, { useState, useMemo, useCallback } from 'react'
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

export default function CatalogPage({ filmes, onEdit, onDelete, showToast }) {
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('title')
  const [viewMode, setViewMode] = useState('grid')
  const [detail, setDetail] = useState(null)
  const [exporting, setExporting] = useState(false)

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
      const result = type === 'csv' ? await window.api.exportCsv() : await window.api.exportXlsx()
      if (result.success) showToast('Exportado com sucesso!')
    } catch { showToast('Erro ao exportar.', 'error') }
    finally { setExporting(false) }
  }, [showToast])

  const stats = useMemo(() => ({
    total: filmes.length,
    bluray: filmes.filter(f => (f.formats || f.format || '').includes('Blu-ray')).length,
    dvd: filmes.filter(f => (f.formats || f.format || '').includes('DVD')).length,
    watched: filmes.filter(f => !!f.watched_at).length,
  }), [filmes])

  return (
    <div className="page catalog-page">
      {/* Stats */}
      <div className="stats-bar">
        <div className="stat"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
        <div className="stat-divider"/>
        <div className="stat"><span className="stat-value">{stats.bluray}</span><span className="stat-label">Blu-ray</span></div>
        <div className="stat-divider"/>
        <div className="stat"><span className="stat-value">{stats.dvd}</span><span className="stat-label">DVD</span></div>
        <div className="stat-divider"/>
        <div className="stat"><span className="stat-value">{stats.watched}</span><span className="stat-label">Assistidos</span></div>
        <div style={{ flex: 1 }}/>
        <div className="export-group">
          <button className="btn btn-sm" onClick={() => handleExport('csv')} disabled={exporting}><IconExport /> CSV</button>
          <button className="btn btn-sm" onClick={() => handleExport('xlsx')} disabled={exporting}><IconExport /> Excel</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch />
          <input className="search-input" placeholder="Buscar título, diretor, gênero..." value={search} onChange={e => setSearch(e.target.value)} />
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
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
        </div>
      </div>

      {/* Grid / List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          {filmes.length === 0
            ? <><div className="empty-icon">🎬</div><p>Sua coleção está vazia.</p><span>Clique em "Adicionar Filme" para começar!</span></>
            : <><div className="empty-icon">🔍</div><p>Nenhum resultado{search ? ` para "${search}"` : category !== 'all' ? ` na categoria "${category}"` : ''}</p></>
          }
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'disc-grid' : 'disc-list'}>
          {filtered.map(f => (
            <DiscCard key={f.id} filme={f} viewMode={viewMode}
              onClick={() => setDetail(f)} onEdit={() => onEdit(f)} onDelete={() => handleDelete(f)} />
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
