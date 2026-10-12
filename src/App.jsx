import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import ContinuePage from './pages/ContinuePage.jsx'
import AddDiscPage from './pages/AddDiscPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AnimePage from './pages/AnimePage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import Toast from './components/Toast.jsx'
import { SERIES_CATEGORIES, WEEKDAY_INDEX } from './constants.js'
import appIcon from '../icon.png'
import './App.css'

// Notifica (uma vez por abertura do app) episódios que saem hoje e temporadas novas em séries já "Assistido"
function notifyNewEpisodes(filmes, animeList) {
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return
  const today = new Date().toISOString().slice(0, 10)
  const todayWeekday = new Date().getDay()

  const releasesTodayFilmes = filmes.filter(f => !!f.watching && f.next_episode_air_date === today)
  const releasesTodayAnimes = animeList.filter(a =>
    a.list_status?.status === 'watching' &&
    a.node.status === 'currently_airing' &&
    WEEKDAY_INDEX[a.node.broadcast?.day_of_the_week] === todayWeekday
  )
  const newSeasons = filmes.filter(f =>
    !!f.watched_at && f.episodes_aired != null && (f.episodes_watched_count || 0) < f.episodes_aired
  )

  const notify = (title, body) => { try { new Notification(title, { body }) } catch {} }
  releasesTodayFilmes.forEach(f => notify('🆕 Novo episódio hoje', f.title))
  releasesTodayAnimes.forEach(a => notify('🆕 Novo episódio hoje', a.node.title))
  newSeasons.forEach(f => notify('📺 Nova temporada disponível', f.title))
}

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
        // abre direto em "Continuando" se há algo em andamento, senão cai no catálogo como sempre
        const hasWatching = all.some(f => !!f.watching) || (cachedAnimes || []).some(a => a.list_status?.status === 'watching')
        if (hasWatching) setPage('continue')
        notifyNewEpisodes(all, cachedAnimes || [])
      } catch (e) { console.error(e) }
      finally {
        const elapsed = Date.now() - start
        const remaining = Math.max(0, 1800 - elapsed)
        setTimeout(() => setLoading(false), remaining)
      }
    }
    init()
  }, [])

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
            tags={tags}
            onEdit={handleEdit}
            onDelete={async () => { await refresh(); await refreshCollections(); if (selectedCollection) { const ids = await window.api.colecoesGetFilmeIds(selectedCollection.id); setCollectionFilmeIds(ids) } }}
            onToggleWatched={handleToggleWatched}
            onFilmeUpdated={handleFilmeUpdated}
            showToast={showToast}
            selectedCollection={selectedCollection}
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
          <SettingsPage settings={settings} showToast={showToast} appVersion={appVersion} updateStatus={updateStatus} onCheckUpdates={checkForUpdates} onSave={async (s) => {
            await window.api.saveSettings(s)
            const updated = await window.api.getSettings()
            setSettings(updated)
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
