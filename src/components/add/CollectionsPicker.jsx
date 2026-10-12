import React, { useState, useCallback } from 'react'

export default function CollectionsPicker({ collections, selected, setSelected, onCollectionsChange, showToast }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) { setCreating(false); return }
    try {
      const col = await window.api.colecoesInsert(name)
      setSelected(prev => [...prev, col.id])
      setNewName(''); setCreating(false)
      onCollectionsChange?.()
    } catch (e) {
      showToast(e.message || 'Erro ao criar coleção.', 'error')
    }
  }, [newName, setSelected, onCollectionsChange, showToast])

  return (
    <div className="field" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ margin: 0 }}>Coleções</label>
        <button
          type="button"
          className="btn btn-sm"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => { setCreating(true); setNewName('') }}
        >
          + Nova
        </button>
      </div>

      {creating && (
        <input
          autoFocus
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nome da coleção..."
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
          onBlur={handleCreate}
          style={{ marginTop: 6, width: '100%', padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
        />
      )}

      {collections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {collections.map(c => {
            const checked = selected.includes(c.id)
            return (
              <label key={c.id} className={`format-check ${checked ? 'active' : ''}`}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                onClick={() => setSelected(prev =>
                  checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                )}>
                <span>{c.name}</span>
                {checked && <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
