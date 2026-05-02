import React, { useState, useRef, useEffect } from 'react'
import './Sidebar.css'

const IconFilm = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="2" width="20" height="20" rx="2.18"/>
    <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
    <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/>
    <line x1="17" y1="7" x2="22" y2="7"/>
  </svg>
)
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconCollection = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10"/>
  </svg>
)
const IconPencil = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

export default function Sidebar({ page, setPage, count, onAddNew, collections, selectedCollection, onSelectCollection, onCollectionsChange, showToast }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const createInputRef = useRef()
  const renameInputRef = useRef()

  useEffect(() => { if (creating) createInputRef.current?.focus() }, [creating])
  useEffect(() => { if (renamingId) renameInputRef.current?.focus() }, [renamingId])

  const handleCreate = async () => {
    if (!newName.trim()) { setCreating(false); return }
    await window.api.colecoesInsert(newName.trim())
    setNewName(''); setCreating(false)
    onCollectionsChange()
  }

  const handleRename = async (id) => {
    if (!renameValue.trim()) { setRenamingId(null); return }
    await window.api.colecoesRename({ id, name: renameValue.trim() })
    if (selectedCollection?.id === id) onSelectCollection({ ...selectedCollection, name: renameValue.trim() })
    setRenamingId(null)
    onCollectionsChange()
  }

  const handleDelete = async (col) => {
    if (!confirm(`Excluir a coleção "${col.name}"? Os filmes não serão removidos.`)) return
    await window.api.colecoesDelete(col.id)
    if (selectedCollection?.id === col.id) onSelectCollection(null)
    onCollectionsChange()
    showToast(`Coleção "${col.name}" excluída.`, 'info')
  }

  const startRename = (col, e) => {
    e.stopPropagation()
    setRenamingId(col.id)
    setRenameValue(col.name)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon"><IconFilm /></span>
        <span className="logo-text">Meu Catálogo</span>
      </div>

      <button className="btn btn-primary add-btn" onClick={onAddNew}>
        <IconPlus /> Adicionar Título
      </button>

      <nav className="sidebar-nav">
        <div className="section-label">Biblioteca</div>
        <button
          className={`nav-item ${page === 'catalog' && !selectedCollection ? 'active' : ''}`}
          onClick={() => { setPage('catalog'); onSelectCollection(null) }}
        >
          <IconFilm /><span>Minha Coleção</span>
          <span className="nav-count">{count}</span>
        </button>

        {/* Coleções */}
        <div className="section-label" style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Coleções</span>
          <button className="col-add-btn" title="Nova coleção" onClick={() => { setCreating(true); setNewName('') }}>
            <IconPlus />
          </button>
        </div>

        {creating && (
          <div className="col-create-row">
            <input
              ref={createInputRef}
              className="col-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome da coleção..."
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              onBlur={handleCreate}
            />
          </div>
        )}

        {collections.map(col => (
          <div key={col.id} className="col-item-wrap">
            {renamingId === col.id ? (
              <div className="col-create-row">
                <input
                  ref={renameInputRef}
                  className="col-input"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(col.id); if (e.key === 'Escape') setRenamingId(null) }}
                  onBlur={() => handleRename(col.id)}
                />
              </div>
            ) : (
              <button
                className={`nav-item col-nav-item ${selectedCollection?.id === col.id ? 'active' : ''}`}
                onClick={() => { setPage('catalog'); onSelectCollection(col) }}
              >
                <IconCollection />
                <span className="col-name">{col.name}</span>
                <span className="nav-count">{col.count}</span>
                <span className="col-actions" onClick={e => e.stopPropagation()}>
                  <button className="col-action-btn" title="Renomear" onClick={e => startRename(col, e)}><IconPencil /></button>
                  <button className="col-action-btn col-action-del" title="Excluir" onClick={() => handleDelete(col)}><IconTrash /></button>
                </span>
              </button>
            )}
          </div>
        ))}

        {collections.length === 0 && !creating && (
          <div className="col-empty">Nenhuma coleção ainda</div>
        )}
      </nav>

      <div className="sidebar-bottom">
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          <IconSettings /><span>Configurações</span>
        </button>
      </div>
    </aside>
  )
}
