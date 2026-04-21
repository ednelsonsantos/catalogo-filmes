import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import AddDiscPage from './pages/AddDiscPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import Toast from './components/Toast.jsx'
import './App.css'

export default function App() {
  const [page, setPage] = useState('catalog')
  const [filmes, setFilmes] = useState([])
  const [settings, setSettings] = useState({ omdbApiKey: '' })
  const [toast, setToast] = useState(null)
  const [editFilme, setEditFilme] = useState(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const [all, saved] = await Promise.all([window.api.getAll(), window.api.getSettings()])
        setFilmes(all)
        if (saved) setSettings(s => ({ ...s, ...saved }))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    init()
  }, [])

  const refresh = useCallback(async () => {
    const all = await window.api.getAll()
    setFilmes(all)
  }, [])

  const handleEdit = useCallback((filme) => { setEditFilme(filme); setPage('add') }, [])
  const handleAddNew = useCallback(() => { setEditFilme(null); setPage('add') }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text3)', flexDirection:'column', gap:12 }}>
      <div className="spinner" />
      <span style={{ fontSize: 13 }}>Carregando coleção...</span>
    </div>
  )

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        setPage={(p) => { setPage(p); if (p !== 'add') setEditFilme(null) }}
        count={filmes.length}
        onAddNew={handleAddNew}
      />
      <main className="app-main">
        {page === 'catalog' && (
          <CatalogPage filmes={filmes} onEdit={handleEdit} onDelete={refresh} showToast={showToast} />
        )}
        {page === 'add' && (
          <AddDiscPage
            settings={settings} editFilme={editFilme}
            onSaved={() => { refresh(); setPage('catalog'); setEditFilme(null) }}
            showToast={showToast}
          />
        )}
        {page === 'settings' && (
          <SettingsPage settings={settings} onSave={async (s) => {
            await window.api.saveSettings(s); setSettings(s); showToast('Configurações salvas!')
          }} />
        )}
      </main>
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}
