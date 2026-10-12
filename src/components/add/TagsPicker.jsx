import React, { useState, useCallback } from 'react'
import ConfirmModal from '../ConfirmModal.jsx'

export default function TagsPicker({ tags, selected, setSelected, onTagsChange, showToast }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleting, setDeleting] = useState(null)

  const handleCreate = useCallback(async () => {
    const name = newName.trim()
    if (!name) { setCreating(false); return }
    try {
      const tag = await window.api.tagsInsert(name)
      setSelected(prev => prev.includes(tag.id) ? prev : [...prev, tag.id])
      setNewName(''); setCreating(false)
      onTagsChange?.()
    } catch (e) {
      showToast(e.message || 'Erro ao criar tag.', 'error')
    }
  }, [newName, setSelected, onTagsChange, showToast])

  const confirmDelete = useCallback(async () => {
    const tag = deleting
    setDeleting(null)
    try {
      await window.api.tagsDelete(tag.id)
      setSelected(prev => prev.filter(id => id !== tag.id))
      onTagsChange?.()
      showToast(`Tag "${tag.name}" removida.`, 'info')
    } catch (e) {
      showToast(e.message || 'Erro ao remover tag.', 'error')
    }
  }, [deleting, setSelected, onTagsChange, showToast])

  return (
    <div className="field" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ margin: 0 }}>Tags</label>
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
          placeholder="Nome da tag..."
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
          onBlur={handleCreate}
          style={{ marginTop: 6, width: '100%', padding: '6px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none' }}
        />
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {tags.map(t => {
            const checked = selected.includes(t.id)
            return (
              <label key={t.id} className={`format-check ${checked ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(prev =>
                  checked ? prev.filter(id => id !== t.id) : [...prev, t.id]
                )}>
                {t.name}
                <span
                  role="button"
                  title="Remover esta tag de todos os títulos"
                  onClick={e => { e.stopPropagation(); setDeleting(t) }}
                  style={{ marginLeft: 6, opacity: 0.6, fontSize: 11, lineHeight: 1 }}
                >
                  ✕
                </span>
              </label>
            )
          })}
        </div>
      )}

      {deleting && (
        <ConfirmModal
          title="Remover tag"
          message={`Remover a tag "${deleting.name}"? Ela sai de ${deleting.count || 0} título(s) que a usam. Os títulos continuam na coleção.`}
          confirmLabel="Remover tag"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
