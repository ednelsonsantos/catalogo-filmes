import React, { useState, useEffect } from 'react'

const MAL_STATUS_LABELS = {
  watching:      'Assistindo',
  completed:     'Completo',
  on_hold:       'Em pausa',
  dropped:       'Abandonado',
  plan_to_watch: 'Planejo assistir',
}

const MAL_STATUS_COLORS = {
  watching:      '#4a9eff',
  completed:     '#4caf7d',
  on_hold:       '#f59e0b',
  dropped:       '#ef4444',
  plan_to_watch: '#8b8b8b',
}

const MAL_SCORE_LABELS = {
  0: 'Sem nota', 1: '(1) Horrível', 2: '(2) Terrível', 3: '(3) Muito ruim',
  4: '(4) Ruim', 5: '(5) Médio', 6: '(6) Bom', 7: '(7) Muito bom',
  8: '(8) Ótimo', 9: '(9) Excelente', 10: '(10) Obra-prima',
}

export default function AnimeAddModal({ anime, onSave, onClose }) {
  const { node } = anime
  const [form, setForm] = useState({ status: 'plan_to_watch', score: 0, num_episodes_watched: 0 })
  const [saving, setSaving] = useState(false)
  const poster   = node._cachedPoster || node.main_picture?.large || node.main_picture?.medium
  const malScore = node.mean ? Number(node.mean).toFixed(2) : null
  const totalEps = node.num_episodes || 0

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = async () => {
    setSaving(true)
    await onSave(node.id, {
      status:               form.status,
      score:                Number(form.score),
      num_episodes_watched: Number(form.num_episodes_watched),
    })
    setSaving(false)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}
    >
      <div style={{ background: 'var(--bg2)', borderRadius: 12, width: '100%', maxWidth: 520, border: '1px solid var(--border2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Topo */}
        <div style={{ display: 'flex', background: 'var(--bg3)' }}>
          {poster && (
            <div style={{ width: 90, flexShrink: 0, overflow: 'hidden' }}>
              <img src={poster} alt={node.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>{node.title}</h2>
            {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
              <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>{node.alternative_titles.en}</p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
              {malScore && <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>⭐ {malScore} MAL</span>}
              {totalEps > 0 && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{totalEps} eps</span>}
              {node.start_date && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{node.start_date.slice(0, 4)}</span>}
            </div>
            {(node.genres || []).slice(0, 4).map(g => (
              <span key={g.id} style={{ fontSize: 10, color: 'var(--text2)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 99, display: 'inline-block', marginRight: 4 }}>{g.name}</span>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Status</label>
            <select
              value={form.status}
              onChange={e => {
                const s = e.target.value
                const updates = { status: s }
                if (s === 'completed' && totalEps > 0) updates.num_episodes_watched = totalEps
                setForm(f => ({ ...f, ...updates }))
              }}
              style={{ background: `${MAL_STATUS_COLORS[form.status]}22`, borderColor: MAL_STATUS_COLORS[form.status], fontWeight: 600, color: MAL_STATUS_COLORS[form.status] }}
            >
              {Object.entries(MAL_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val} style={{ background: 'var(--bg3)', color: 'var(--text)' }}>{label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Episódios assistidos</span>
              {totalEps > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400 }}>de {totalEps}</span>}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min={0} max={totalEps || 9999} value={form.num_episodes_watched}
                onChange={e => setForm(f => ({ ...f, num_episodes_watched: Math.max(0, Number(e.target.value)) }))}
                style={{ flex: 1 }} />
              {totalEps > 0 && (
                <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, num_episodes_watched: totalEps }))}>
                  Completo
                </button>
              )}
            </div>
            {totalEps > 0 && (
              <div style={{ height: 4, background: 'var(--bg4)', borderRadius: 99, marginTop: 4 }}>
                <div style={{ height: '100%', borderRadius: 99, background: MAL_STATUS_COLORS[form.status], width: `${Math.min(100, (form.num_episodes_watched / totalEps) * 100)}%`, transition: 'width 0.2s' }} />
              </div>
            )}
          </div>

          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Minha nota</span>
              <span style={{ color: form.score > 0 ? '#4a9eff' : 'var(--text3)', fontWeight: form.score > 0 ? 600 : 400 }}>
                {MAL_SCORE_LABELS[form.score]}
              </span>
            </label>
            <input type="range" min={0} max={10} step={1} value={form.score}
              onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#4a9eff' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
              <span>Sem nota</span><span>10</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar ao MAL'}
          </button>
        </div>
      </div>
    </div>
  )
}
