import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Sidebar from './components/Sidebar.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import ContinuePage from './pages/ContinuePage.jsx'
import AddDiscPage from './pages/AddDiscPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AnimePage from './pages/AnimePage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import Toast from './components/Toast.jsx'
import { SERIES_CATEGORIES } from './constants.js'
import { pendingNotifications, notifyPending } from './utils/notifications.js'
import appIcon from '../icon.png'
import './App.css'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

export default function App() {
  const [page, setPage] = useState('catalog')
  const [filmes, setFilmes] = useState([])
  const [collections, setCollections] = useState([])
  const [tags, setTags] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [collectionFilmeIds, setCollectionFilmeIds] = useState(null)
  const [settings, setSettings] = useState({ omdbApiKey: '' })
  const [animeList, setAnimeList] = useState([])
  const [toast, setToast] = useState(null)
  const [editFilme, setEditFilme] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState({ enabled: false, state: 'idle' })
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false)
  const [catalogCommand, setCatalogCommand] = useState(null) // ação do menu da janela pra tela do catálogo

  useEffect(() => {
    window.api.appGetVersion().then(setAppVersion).catch(() => {})
    window.api.updaterGetStatus().then(setUpdateStatus).catch(() => {})
    // cada aviso substitui o anterior inteiro, pra não sobrar mensagem de erro/percentual de um estado antigo
    return window.api.onUpdaterStatus(s => setUpdateStatus({ enabled: true, ...s }))
  }, [])

  const checkForUpdates = useCallback(async () => {
    const s = await window.api.updaterCheck()
    setUpdateStatus(s)
    setUpdateBannerDismissed(false)
  }, [])

  // Checagem em segundo plano: ao abrir, a cada 30 min e ao voltar pra janela.
  // Atualiza os episódios das séries acompanhadas (no máximo 1x por dia cada) e avisa o que for novo, sem repetir.
  const filmesRef = useRef([])
  const animeRef = useRef([])
  const tmdbRef = useRef(false)
  const checkingRef = useRef(false)
  useEffect(() => { filmesRef.current = filmes }, [filmes])
  useEffect(() => { animeRef.current = animeList }, [animeList])

  const runBackgroundChecks = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      if (tmdbRef.current) {
        const r = await window.api.episodesRefreshStale().catch(() => ({ updated: 0 }))
        if (r.updated) {
          const all = await window.api.getAll()
          filmesRef.current = all
          setFilmes(all)
        }
      }
      notifyPending(pendingNotifications(filmesRef.current, animeRef.current), () => window.api.appShow())
      // backup automático semanal (o processo principal decide se já está na hora)
      await window.api.backupAutoCheck().catch(() => {})
    } finally {
      checkingRef.current = false
    }
  }, [])

  useEffect(() => {
    const id = setInterval(runBackgroundChecks, CHECK_INTERVAL_MS)
    window.addEventListener('focus', runBackgroundChecks)
    return () => { clearInterval(id); window.removeEventListener('focus', runBackgroundChecks) }
  }, [runBackgroundChecks])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  useEffect(() => {
    const init = async () => {
      const start = Date.now()
      try {
        const [all, cols, allTags, saved, cachedAnimes] = await Promise.all([
          window.api.getAll(),
          window.api.colecoesGetAll(),
          window.api.tagsGetAll(),
          window.api.getSettings(),
          window.api.malLoadCache(),
        ])
        setFilmes(all)
        setCollections(cols)
        setTags(allTags)
        if (saved) setSettings(s => ({ ...s, ...saved }))
        if (cachedAnimes?.length) setAnimeList(cachedAnimes)
        // abre direto em "Assistindo" se há algo em andamento, senão cai no catálogo como sempre
        const hasWatching = all.some(f => !!f.watching) || (cachedAnimes || []).some(a => a.list_status?.status === 'watching')
        if (hasWatching) setPage('continue')
        filmesRef.current = all
        animeRef.current = cachedAnimes || []
        tmdbRef.current = !!saved?.tmdbConfigured
        runBackgroundChecks()
        // "Onde assistir" do card/filtro: atualiza em segundo plano só o que tem cache vencido (7 dias)
        if (saved?.tmdbConfigured) {
          window.api.providersRefreshStale()
            .then(r => { if (r.updated) return window.api.getAll().then(setFilmes) })
            .catch(() => {})
        }
      } catch (e) { console.error(e) }
      finally {
        const elapsed = Date.now() - start
        const remaining = Math.max(0, 1800 - elapsed)
        setTimeout(() => setLoading(false), remaining)
      }
    }
    init()
  }, [runBackgroundChecks])

  useEffect(() => {
    if (animeList.length === 0) return
    const t = setTimeout(() => window.api.malSaveCache(animeList), 800)
    return () => clearTimeout(t)
  }, [animeList])

  const refresh = useCallback(async () => {
    const all = await window.api.getAll()
    setFilmes(all)
  }, [])

  const refreshCollections = useCallback(async () => {
    const cols = await window.api.colecoesGetAll()
    setCollections(cols)
  }, [])

  const refreshTags = useCallback(async () => {
    const allTags = await window.api.tagsGetAll()
    setTags(allTags)
  }, [])

  const handleSelectCollection = useCallback(async (col) => {
    if (!col) {
      setSelectedCollection(null)
      setCollectionFilmeIds(null)
      return
    }
    setSelectedCollection(col)
    const ids = await window.api.colecoesGetFilmeIds(col.id)
    setCollectionFilmeIds(ids)
  }, [])

  const catalogFilmes = useMemo(() => {
    if (!collectionFilmeIds) return filmes
    return filmes.filter(f => collectionFilmeIds.includes(f.id))
  }, [filmes, collectionFilmeIds])

  const continueCount = useMemo(() => (
    filmes.filter(f => !!f.watching).length + animeList.filter(a => a.list_status?.status === 'watching').length
  ), [filmes, animeList])

  const handleToggleWatched = useCallback(async (filme) => {
    const wasWatched = !!filme.watched_at
    const updated = {
      ...filme,
      watched_at: wasWatched ? null : new Date().toISOString().slice(0, 10),
      // marcar como assistido agora encerra o "assistindo" (não soma nos dois contadores)
      watching: wasWatched ? filme.watching : false,
    }
    let saved = await window.api.update(updated)

    // Marcou "Assistido" agora: sincroniza episódios já lançados pra séries/animes da TMDB
    if (!wasWatched && updated.tmdb_id && updated.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(updated.category)) {
      try { saved = await window.api.episodesRefresh({ filmeId: updated.id, tmdbId: updated.tmdb_id, markAllWatched: true }) }
      catch (e) { console.error('Erro ao sincronizar episódios:', e) }
    }

    setFilmes(prev => prev.map(f => f.id === saved.id ? saved : f))
  }, [])

  const handleFilmeUpdated = useCallback((updated) => {
    setFilmes(prev => prev.map(f => f.id === updated.id ? updated : f))
  }, [])

  const handleEdit = useCallback((filme) => { setEditFilme(filme); setPage('add') }, [])
  const handleAddNew = useCallback(() => { setEditFilme(null); setPage('add') }, [])

  // Menu da janela (Arquivo/Exibir/Ajuda)
  useEffect(() => window.api.onMenuAction(async (action) => {
    const toCatalog = (command) => {
      setEditFilme(null)
      setPage('catalog')
      setCatalogCommand({ ...command, n: Date.now() })
    }
    if (action === 'add') { setEditFilme(null); setPage('add') }
    else if (action === 'settings') { setEditFilme(null); setPage('settings') }
    else if (action.startsWith('page:')) { setEditFilme(null); setPage(action.slice(5)) }
    else if (action === 'import') toCatalog({ type: 'import' })
    else if (action === 'search') toCatalog({ type: 'search' })
    else if (action.startsWith('export:')) toCatalog({ type: 'export', format: action.slice(7) })
    else if (action === 'check-updates') { setPage('settings'); checkForUpdates().catch(() => {}) }
    else if (action === 'backup') {
      try {
        const res = await window.api.backupCreate()
        if (res.success) showToast('Backup criado com sucesso!', 'success')
      } catch (e) { showToast(e.message || 'Erro ao criar backup.', 'error') }
    }
  }), [checkForUpdates, showToast])

  const handleSavedFilme = useCallback(async (savedId, colecaoIds, tagIds) => {
    if (savedId != null) {
      await window.api.colecoesSetForFilme({ filmeId: savedId, colecaoIds: colecaoIds ?? [] })
      await window.api.tagsSetForFilme({ filmeId: savedId, tagIds: tagIds ?? [] })
    }
    await refresh()
    await refreshCollections()
    await refreshTags()
    if (selectedCollection) {
      const ids = await window.api.colecoesGetFilmeIds(selectedCollection.id)
      setCollectionFilmeIds(ids)
    }
    setPage('catalog')
    setEditFilme(null)
  }, [refresh, refreshCollections, refreshTags, selectedCollection])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-icon-wrap">
        <img src={appIcon} alt="Meu Catálogo" className="loading-icon" />
      </div>
      <div className="loading-app-name">Meu Catálogo</div>
      <div className="loading-bar-wrap">
        <div className="loading-bar" />
      </div>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        setPage={(p) => { setPage(p); if (p !== 'add') setEditFilme(null) }}
        count={filmes.length}
        animeCount={animeList.length}
        continueCount={continueCount}
        showMal={!!settings.malConfigured || animeList.length > 0}
        onAddNew={handleAddNew}
        collections={collections}
        selectedCollection={selectedCollection}
        onSelectCollection={handleSelectCollection}
        onCollectionsChange={refreshCollections}
        showToast={showToast}
      />
      <main className="app-main">
        {page === 'continue' && (
          <ContinuePage
            filmes={filmes}
            animeList={animeList}
            setAnimeList={setAnimeList}
            onEdit={handleEdit}
            onFilmeUpdated={handleFilmeUpdated}
            setPage={(p) => { setPage(p); if (p !== 'add') setEditFilme(null) }}
            showToast={showToast}
          />
        )}
        {page === 'catalog' && (
          <CatalogPage
            filmes={catalogFilmes}
            allFilmes={filmes}
            tags={tags}
            tmdbConfigured={!!settings.tmdbConfigured}
            onImported={refresh}
            onEdit={handleEdit}
            onDelete={async () => { await refresh(); await refreshCollections(); if (selectedCollection) { const ids = await window.api.colecoesGetFilmeIds(selectedCollection.id); setCollectionFilmeIds(ids) } }}
            onToggleWatched={handleToggleWatched}
            onFilmeUpdated={handleFilmeUpdated}
            showToast={showToast}
            selectedCollection={selectedCollection}
            command={catalogCommand}
            onCommandHandled={() => setCatalogCommand(null)}
          />
        )}
        {page === 'add' && (
          <AddDiscPage
            settings={settings}
            editFilme={editFilme}
            filmes={filmes}
            collections={collections}
            tags={tags}
            onCollectionsChange={refreshCollections}
            onTagsChange={refreshTags}
            onSaved={handleSavedFilme}
            showToast={showToast}
            animeList={animeList}
            setAnimeList={setAnimeList}
          />
        )}
        {page === 'animes' && (
          <AnimePage settings={settings} showToast={showToast} animeList={animeList} setAnimeList={setAnimeList} />
        )}
        {page === 'stats' && <StatsPage filmes={filmes} animeList={animeList} />}
        {page === 'settings' && (
          <SettingsPage settings={settings} showToast={showToast} filmes={filmes} onFilmeUpdated={handleFilmeUpdated} onEdit={handleEdit} appVersion={appVersion} updateStatus={updateStatus} onCheckUpdates={checkForUpdates} onSave={async (s) => {
            await window.api.saveSettings(s)
            const updated = await window.api.getSettings()
            setSettings(updated)
            tmdbRef.current = !!updated?.tmdbConfigured
            showToast('Configurações salvas!')
          }} />
        )}
      </main>
      {updateStatus.state === 'ready' && !updateBannerDismissed && (
        <div className="update-banner" role="status">
          <span>⬆ Versão <strong>{updateStatus.version}</strong> baixada. Ela também é instalada sozinha quando você fechar o app.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setUpdateBannerDismissed(true)}>Depois</button>
            <button className="btn btn-sm btn-primary" onClick={() => window.api.updaterInstall()}>Reiniciar e atualizar</button>
          </div>
        </div>
      )}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
