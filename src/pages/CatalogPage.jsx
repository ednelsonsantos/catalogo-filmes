import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import DiscCard from '../components/DiscCard.jsx'
import DiscDetailModal from '../components/DiscDetailModal.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import ImportModal from '../components/ImportModal.jsx'
import '../components/ImportModal.css'
import { parseProviders } from '../utils/providers.js'
import { SERIES_CATEGORIES } from '../constants.js'
import './CatalogPage.css'

const IconSearch = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>)
const IconGrid = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)
const IconList = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>)

// Formato = o que você possui (a mídia física/digital). Eixo independente do status de visualização.
const FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'Digital']

// Status = se você já assistiu ou está assistindo. Combina com o filtro de formato (ex: Blu-ray + Assistidos).
const STATUS_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'nao-assistidos', label: 'Não assistidos' },
  { id: 'assistindo', label: '▶ Assistindo' },
  { id: 'assistidos', label: '✓ Assistidos' },
]

const ALL_CATEGORIES = ['Filme', 'Série', 'Mini-série', 'Documentário', 'Animação', 'Anime', 'Show/Stand-up', 'Musical', 'Esporte', 'Streaming', 'Outro']

const SORTS = ['title', 'year', 'rating', 'myRating', 'watched', 'added']

// Filtros, ordenação e grade/lista ficam como o usuário deixou ao reabrir o app (a busca não)
const VIEW_KEY = 'catalogo:catalogView'
function loadView() {
  let v = {}
  try { v = JSON.parse(localStorage.getItem(VIEW_KEY)) || {} } catch {}
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)
  return {
    format: pick(v.format, ['all', ...FORMATS], 'all'),
    watchStatus: pick(v.watchStatus, STATUS_FILTERS.map(s => s.id), 'all'),
    category: pick(v.category, ['all', ...ALL_CATEGORIES], 'all'),
    tagFilter: typeof v.tagFilter === 'string' ? v.tagFilter : 'all',
    providerFilter: typeof v.providerFilter === 'string' ? v.providerFilter : 'all',
    sort: pick(v.sort, SORTS, 'title'),
    viewMode: pick(v.viewMode, ['grid', 'list'], 'grid'),
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Menu suspenso simples (fecha ao clicar fora ou com Esc)
function DropdownMenu({ label, items, disabled, up = false, emptyLabel = 'Nenhuma ainda' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <button className="btn btn-sm" onClick={() => setOpen(o => !o)} disabled={disabled} aria-expanded={open}>{label} ▾</button>
      {open && (
        <div className={`dropdown-menu${up ? ' dropdown-menu--up' : ''}`} role="menu">
          {items.length === 0 && <div className="dropdown-empty">{emptyLabel}</div>}
          {items.map((it, i) => it === '-'
            ? <div key={i} className="dropdown-sep" />
            : <button key={i} role="menuitem" className="dropdown-item" onClick={() => { setOpen(false); it.onClick() }}>{it.label}</button>)}
        </div>
      )}
    </div>
  )
}

export default function CatalogPage({ filmes, allFilmes = filmes, tags = [], collections = [], tmdbConfigured = false, onEdit, onDelete, onImported, onToggleWatched, onFilmeUpdated, onBulkDone, showToast, selectedCollection, command, onCommandHandled }) {
  const initialView = useMemo(loadView, [])
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState(initialView.format)
  const [watchStatus, setWatchStatus] = useState(initialView.watchStatus)
  const [category, setCategory] = useState(initialView.category)
  const [tagFilter, setTagFilter] = useState(() => (
    initialView.tagFilter === 'all' || tags.some(t => String(t.id) === initialView.tagFilter) ? initialView.tagFilter : 'all'
  ))
  const [tagFilmeIds, setTagFilmeIds] = useState(null)
  const [providerFilter, setProviderFilter] = useState(initialView.providerFilter)
  const [sort, setSort] = useState(initialView.sort)
  const [viewMode, setViewMode] = useState(initialView.viewMode)
  const [detail, setDetail] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [exporting, setExporting] = useState(false)
  // Ações em lote: null = fora do modo de seleção
  const [selectedIds, setSelectedIds] = useState(null)
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ format, watchStatus, category, tagFilter, providerFilter, sort, viewMode })) } catch {}
  }, [format, watchStatus, category, tagFilter, providerFilter, sort, viewMode])

  const hasActiveFilters = search || format !== 'all' || watchStatus !== 'all' || category !== 'all' || tagFilter !== 'all' || providerFilter !== 'all'

  const clearFilters = useCallback(() => {
    setSearch(''); setFormat('all'); setWatchStatus('all'); setCategory('all'); setTagFilter('all'); setProviderFilter('all')
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (tagFilter === 'all') { setTagFilmeIds(null); return }
    window.api.tagsGetFilmeIds(Number(tagFilter)).then(ids => setTagFilmeIds(ids))
  }, [tagFilter, tags]) // tags muda depois de uma ação em lote (contagens): relê quem tem a tag

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
    } else if (watchStatus === 'nao-assistidos') {
      items = items.filter(f => !f.watched_at)
    } else if (watchStatus === 'assistindo') {
      items = items.filter(f => !!f.watching)
    }
    if (category !== 'all') {
      items = items.filter(f => (f.category || '') === category)
    }
    if (tagFilmeIds) {
      items = items.filter(f => tagFilmeIds.includes(f.id))
    }
    if (providerFilter === 'any') {
      items = items.filter(f => parseProviders(f)?.length > 0)
    } else if (providerFilter === 'none') {
      items = items.filter(f => parseProviders(f)?.length === 0)
    } else if (providerFilter !== 'all') {
      items = items.filter(f => parseProviders(f)?.some(p => String(p.id) === providerFilter))
    }
    items.sort((a, b) => {
      if (sort === 'title')  return (a.title || '').localeCompare(b.title || '', 'pt-BR')
      if (sort === 'year')   return (b.year || 0) - (a.year || 0)
      if (sort === 'rating') return parseFloat(b.imdb_rating || 0) - parseFloat(a.imdb_rating || 0)
      if (sort === 'myRating') {
        const ra = a.my_rating ?? -1, rb = b.my_rating ?? -1
        return rb - ra || (a.title || '').localeCompare(b.title || '', 'pt-BR')
      }
      if (sort === 'added')  return b.id - a.id
      if (sort === 'watched') return (b.watched_at || '').localeCompare(a.watched_at || '')
      return 0
    })
    return items
  }, [filmes, search, format, watchStatus, category, tagFilmeIds, providerFilter, sort])

  // Detalhe: ← → percorrem a lista como ela está na tela (com filtros e ordenação)
  const detailIndex = detail ? filtered.findIndex(f => f.id === detail.id) : -1
  const goPrev = useCallback(() => setDetail(filtered[detailIndex - 1]), [filtered, detailIndex])
  const goNext = useCallback(() => setDetail(filtered[detailIndex + 1]), [filtered, detailIndex])

  // Sortear: abre um título ao acaso entre os que estão na lista (evita repetir o último sorteado)
  const lastPickRef = useRef(null)
  const pickRandom = useCallback(() => {
    if (filtered.length === 0) return
    const pool = filtered.length > 1 ? filtered.filter(f => f.id !== lastPickRef.current) : filtered
    const pick = pool[Math.floor(Math.random() * pool.length)]
    lastPickRef.current = pick.id
    setDetail(pick)
  }, [filtered])

  // Só conta (e só recebe a ação) o que está selecionado E visível — trocar o filtro não deixa nada escondido no lote
  const selecting = selectedIds !== null
  const selectedVisible = useMemo(() => (selecting ? filtered.filter(f => selectedIds.has(f.id)) : []), [selecting, filtered, selectedIds])
  const allVisibleSelected = selecting && filtered.length > 0 && selectedVisible.length === filtered.length

  const toggleSelected = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filtered.map(f => f.id)))
  }, [allVisibleSelected, filtered])
  const exitSelection = useCallback(() => { setSelectedIds(null); setConfirmingBulkDelete(false) }, [])

  // Esc sai do modo de seleção; Ctrl+A seleciona a lista toda (fora de campos de texto)
  useEffect(() => {
    if (!selecting) return
    const onKey = (e) => {
      if (detail || confirmingBulkDelete || importing) return
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (e.key === 'Escape') { e.preventDefault(); exitSelection() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelectedIds(new Set(filtered.map(f => f.id))) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting, detail, confirmingBulkDelete, importing, filtered, exitSelection])

  const runBulk = useCallback(async (action, target) => {
    const items = selectedVisible
    if (items.length === 0) return
    setBulkBusy(true)
    try {
      await window.api.bulkApply({ ids: items.map(f => f.id), action, targetId: target?.id })
      const one = items.length === 1
      const n = plural(items.length, 'título', 'títulos')
      if (action === 'watched') {
        // igual ao ✓ individual: série da TMDB marcada agora fica com os episódios já lançados assistidos
        if (tmdbConfigured) {
          for (const f of items.filter(f => !f.watched_at && f.tmdb_id && f.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(f.category))) {
            await window.api.episodesRefresh({ filmeId: f.id, tmdbId: f.tmdb_id, markAllWatched: true }).catch(() => {})
          }
        }
        showToast(`${n} marcado${one ? '' : 's'} como assistido${one ? '' : 's'}.`)
      } else if (action === 'unwatched') {
        showToast(`${n} marcado${one ? '' : 's'} como não assistido${one ? '' : 's'}.`)
      } else if (action === 'addColecao') {
        showToast(`${n} na coleção "${target.name}".`)
      } else if (action === 'addTag') {
        showToast(`Tag "${target.name}" em ${n}.`)
      } else if (action === 'delete') {
        showToast(`${n} removido${one ? '' : 's'}.`, 'info')
        setSelectedIds(new Set())
      }
      await onBulkDone?.()
    } catch (e) {
      showToast(`Erro: ${e.message}`, 'error')
    } finally {
      setBulkBusy(false)
      setConfirmingBulkDelete(false)
    }
  }, [selectedVisible, tmdbConfigured, onBulkDone, showToast])

  // Serviços presentes na coleção (pelo cache do "Onde assistir"), do mais comum pro menos
  const providerOptions = useMemo(() => {
    const byId = new Map()
    let checked = 0
    for (const f of filmes) {
      const list = parseProviders(f)
      if (!list) continue
      checked++
      for (const p of list) {
        const cur = byId.get(p.id) || { id: p.id, name: p.name, count: 0 }
        cur.count++
        byId.set(p.id, cur)
      }
    }
    return { checked, list: [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')) }
  }, [filmes])

  // serviço lembrado que sumiu do catálogo (ou cache ainda vazio) volta pra "todos" em vez de filtrar o nada
  useEffect(() => {
    if (providerFilter === 'all') return
    // sem nenhum título verificado o seletor nem aparece — um filtro lembrado ficaria ativo e invisível
    if (providerOptions.checked === 0) { setProviderFilter('all'); return }
    if (['any', 'none'].includes(providerFilter)) return
    if (!providerOptions.list.some(p => String(p.id) === providerFilter)) setProviderFilter('all')
  }, [providerFilter, providerOptions])

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
    const formatCounts = {}
    for (const f of filmes) {
      for (const fm of (f.formats || f.format || '').split(',').map(x => x.trim()).filter(Boolean)) formatCounts[fm] = (formatCounts[fm] || 0) + 1
    }
    const watched = filmes.filter(f => !!f.watched_at).length
    return {
      formatCounts,
      total: filmes.length,
      watched,
      watchedPct: filmes.length ? Math.round((watched / filmes.length) * 100) : 0,
      watching: filmes.filter(f => !!f.watching).length,
      categoryCounts,
    }
  }, [filmes])

  // Ações vindas do menu da janela (Arquivo → Importar/Exportar, Exibir → Buscar)
  useEffect(() => {
    if (!command) return
    if (command.type === 'import') setImporting(true)
    else if (command.type === 'export') handleExport(command.format)
    else if (command.type === 'search') searchRef.current?.focus()
    onCommandHandled?.() // senão voltar pra tela depois repetiria a ação
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command])

  const scope = selectedCollection ? ` da coleção` : ''

  return (
    <div className="page catalog-page">
      <div className="catalog-header">
        <div className="catalog-summary">
          <h1 className="page-title">{selectedCollection ? selectedCollection.name : 'Catálogo'}</h1>
          <span className="catalog-counts" data-testid="catalog-counts">
            {stats.total} título{stats.total !== 1 ? 's' : ''}
            {stats.total > 0 && <> · {stats.watched} assistido{stats.watched !== 1 ? 's' : ''} ({stats.watchedPct}%)</>}
            {stats.watching > 0 && <> · {stats.watching} assistindo</>}
          </span>
        </div>
        <DropdownMenu
          label="Importar / Exportar"
          disabled={exporting}
          items={[
            { label: 'Importar lista (Letterboxd, IMDb, CSV, Excel)…', onClick: () => setImporting(true) },
            '-',
            { label: `Exportar${scope} em CSV`, onClick: () => handleExport('csv') },
            { label: `Exportar${scope} em Excel`, onClick: () => handleExport('xlsx') },
            { label: `Exportar${scope} para site (JSON)`, onClick: () => handleExport('site') },
          ]}
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-wrap">
          <IconSearch />
          <input ref={searchRef} className="search-input" placeholder="Buscar título, diretor, gênero... (Ctrl+F)" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="clear-search" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="toolbar-right">
          <div className="filter-group" title="Status — o que você já assistiu">
            {STATUS_FILTERS.map(f => (
              <button key={f.id} className={`filter-btn ${watchStatus === f.id ? 'active' : ''}`} onClick={() => setWatchStatus(f.id)}>{f.label}</button>
            ))}
          </div>
          <select className="sort-select" data-testid="format-filter" value={format} onChange={e => setFormat(e.target.value)} title="Formato — o que você possui">
            <option value="all">Todos os formatos</option>
            {FORMATS.map(f => <option key={f} value={f}>{f}{stats.formatCounts[f] ? ` (${stats.formatCounts[f]})` : ''}</option>)}
          </select>
          <select className="sort-select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {ALL_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}{stats.categoryCounts[c] ? ` (${stats.categoryCounts[c]})` : ''}</option>
            ))}
          </select>
          {tags.length > 0 && (
            <select className="sort-select" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
              <option value="all">Todas as tags</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>{t.name}{t.count ? ` (${t.count})` : ''}</option>
              ))}
            </select>
          )}
          {providerOptions.checked > 0 && (
            <select className="sort-select" data-testid="provider-filter" value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
              <option value="all">Onde assistir: todos</option>
              <option value="any">Em algum streaming</option>
              <option value="none">Em nenhum streaming</option>
              {providerOptions.list.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name} ({p.count})</option>
              ))}
            </select>
          )}
          <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="title">A → Z</option>
            <option value="year">Mais recente</option>
            <option value="rating">Melhor nota (IMDb)</option>
            <option value="myRating">Minha nota (maior primeiro)</option>
            <option value="watched">Assistido recentemente</option>
            <option value="added">Adicionado por último</option>
          </select>
          <button className={`btn btn-sm ${selecting ? 'active' : ''}`} onClick={selecting ? exitSelection : () => setSelectedIds(new Set())} disabled={!selecting && filtered.length === 0} title="Marcar vários títulos pra aplicar uma ação em todos de uma vez">☑ Selecionar</button>
          <button className="btn btn-sm" onClick={pickRandom} disabled={filtered.length === 0} title="Abre um título ao acaso entre os que estão na lista (use os filtros pra escolher de onde sortear)">🎲 Sortear</button>
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
              selected={selecting ? selectedIds.has(f.id) : undefined}
              onClick={selecting ? () => toggleSelected(f.id) : () => setDetail(f)} onEdit={() => onEdit(f)} onDelete={() => handleDelete(f)}
              onToggleWatched={onToggleWatched} />
          ))}
        </div>
      )}

      {selecting && (
        <div className="bulk-bar" role="toolbar" aria-label="Ações nos selecionados">
          <span className="bulk-count" data-testid="bulk-count">
            {selectedVisible.length === 0 ? 'Clique nos títulos pra selecionar' : plural(selectedVisible.length, 'selecionado', 'selecionados')}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={toggleSelectAll} disabled={filtered.length === 0}>
            {allVisibleSelected ? 'Desmarcar todos' : `Selecionar todos (${filtered.length})`}
          </button>
          <div className="bulk-actions">
            <button className="btn btn-sm" disabled={bulkBusy || selectedVisible.length === 0} onClick={() => runBulk('watched')}>✓ Assistido</button>
            <button className="btn btn-sm" disabled={bulkBusy || selectedVisible.length === 0} onClick={() => runBulk('unwatched')}>Não assistido</button>
            <DropdownMenu up label="Coleção" disabled={bulkBusy || selectedVisible.length === 0}
              items={collections.map(c => ({ label: c.name, onClick: () => runBulk('addColecao', c) }))} />
            <DropdownMenu up label="Tag" disabled={bulkBusy || selectedVisible.length === 0}
              items={tags.map(t => ({ label: t.name, onClick: () => runBulk('addTag', t) }))} />
            <button className="btn btn-sm btn-danger" disabled={bulkBusy || selectedVisible.length === 0} onClick={() => setConfirmingBulkDelete(true)}>Remover</button>
          </div>
          <button className="btn btn-sm btn-primary" onClick={exitSelection}>Concluir</button>
        </div>
      )}

      {confirmingBulkDelete && (
        <ConfirmModal
          title="Remover títulos"
          message={`Tem certeza que quer remover ${plural(selectedVisible.length, 'título', 'títulos')} da sua coleção? Essa ação não pode ser desfeita.`}
          confirmLabel="Remover"
          onConfirm={() => runBulk('delete')}
          onCancel={() => setConfirmingBulkDelete(false)}
        />
      )}

      {detail && (
        <DiscDetailModal filme={detail} onClose={() => setDetail(null)}
          onEdit={() => { onEdit(detail); setDetail(null) }}
          onDelete={() => handleDelete(detail)}
          onUpdated={(updated) => { setDetail(updated); onFilmeUpdated?.(updated) }}
          onPrev={detailIndex > 0 ? goPrev : null}
          onNext={detailIndex >= 0 && detailIndex < filtered.length - 1 ? goNext : null}
          position={detailIndex >= 0 ? `${detailIndex + 1} de ${filtered.length}` : null}
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

      {importing && (
        <ImportModal
          filmes={allFilmes}
          tmdbConfigured={tmdbConfigured}
          showToast={showToast}
          onImported={onImported}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  )
}
