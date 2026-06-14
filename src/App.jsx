import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import AddDiscPage from './pages/AddDiscPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import AnimePage from './pages/AnimePage.jsx'
import Toast from './components/Toast.jsx'
import appIcon from '../icon.png'
import './App.css'

export default function App() {
  const [page, setPage] = useState('catalog')
  const [filmes, setFilmes] = useState([])
  const [collections, setCollections] = useState([])
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [collectionFilmeIds, setCollectionFilmeIds] = useState(null)
  const [settings, setSettings] = useState({ omdbApiKey: '' })
  const [animeList, setAnimeList] = useState([])
  const [toast, setToast] = useState(null)
  const [editFilme, setEditFilme] = useState(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  useEffect(() => {
    const init = async () => {
      const start = Date.now()
      try {
        const [all, cols, saved, cachedAnimes] = await Promise.all([
          window.api.getAll(),
          window.api.colecoesGetAll(),
          window.api.getSettings(),
          window.api.malLoadCache(),
        ])
        setFilmes(all)
        setCollections(cols)
        if (saved) setSettings(s => ({ ...s, ...saved }))
        if (cachedAnimes?.length) setAnimeList(cachedAnimes)
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

  const handleToggleWatched = useCallback(async (filme) => {
    const wasWatched = !!filme.watched_at
    const updated = { ...filme, watched_at: wasWatched ? null : new Date().toISOString().slice(0, 10) }
    await window.api.update(updated)
    setFilmes(prev => prev.map(f => f.id === updated.id ? updated : f))
  }, [])

  const handleEdit = useCallback((filme) => { setEditFilme(filme); setPage('add') }, [])
  const handleAddNew = useCallback(() => { setEditFilme(null); setPage('add') }, [])

  const handleSavedFilme = useCallback(async (savedId, colecaoIds) => {
    if (savedId != null) {
      await window.api.colecoesSetForFilme({ filmeId: savedId, colecaoIds: colecaoIds ?? [] })
    }
    await refresh()
    await refreshCollections()
    if (selectedCollection) {
      const ids = await window.api.colecoesGetFilmeIds(selectedCollection.id)
      setCollectionFilmeIds(ids)
    }
    setPage('catalog')
    setEditFilme(null)
  }, [refresh, refreshCollections, selectedCollection])

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
        onAddNew={handleAddNew}
        collections={collections}
        selectedCollection={selectedCollection}
        onSelectCollection={handleSelectCollection}
        onCollectionsChange={refreshCollections}
        showToast={showToast}
      />
      <main className="app-main">
        {page === 'catalog' && (
          <CatalogPage
            filmes={catalogFilmes}
            onEdit={handleEdit}
            onDelete={async () => { await refresh(); await refreshCollections(); if (selectedCollection) { const ids = await window.api.colecoesGetFilmeIds(selectedCollection.id); setCollectionFilmeIds(ids) } }}
            onToggleWatched={handleToggleWatched}
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
            onSaved={handleSavedFilme}
            showToast={showToast}
            animeList={animeList}
            setAnimeList={setAnimeList}
          />
        )}
        {page === 'animes' && (
          <AnimePage settings={settings} showToast={showToast} animeList={animeList} setAnimeList={setAnimeList} />
        )}
        {page === 'settings' && (
          <SettingsPage settings={settings} onSave={async (s) => {
            await window.api.saveSettings(s)
            const updated = await window.api.getSettings()
            setSettings(updated)
            showToast('Configurações salvas!')
          }} />
        )}
      </main>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
