import React, { useState, useEffect, useId } from 'react'
import { STATUS_LABELS, SCORE_LABELS, statusColor, formatBroadcast, malScore, posterUrl } from '../../utils/mal.js'
import './anime.css'

// Status, episódios e nota de um anime na lista do MAL.
// mode "edit" (página do MyAnimeList) parte do que já está na lista; "add" (Adicionar → Anime) parte de "Planejo assistir"
export default function AnimeStatusModal({ anime, mode = 'edit', onSave, onClose }) {
  const { node, list_status } = anime
  const [form, setForm] = useState(() => (mode === 'edit'
    ? { status: list_status?.status || 'plan_to_watch', score: list_status?.score ?? 0, num_episodes_watched: list_status?.num_episodes_watched ?? 0 }
    : { status: 'plan_to_watch', score: 0, num_episodes_watched: 0 }))
  const [saving, setSaving] = useState(false)
  const id = useId()
  const poster = node._cachedPoster || posterUrl(node)
  const score = malScore(node)
  const totalEps = node.num_episodes || 0
  const missing = totalEps - form.num_episodes_watched
  const broadcast = node.status === 'currently_airing' ? formatBroadcast(node.broadcast) : null
  const color = statusColor(form.status)

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

  const setStatus = (status) => {
    // completo já preenche todos os episódios
    setForm(f => ({ ...f, status, ...(status === 'completed' && totalEps > 0 ? { num_episodes_watched: totalEps } : {}) }))
  }

  return (
    <div className="anime-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="anime-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="anime-modal-top">
          {poster && (
            <div className="anime-modal-poster"><img className="anime-poster" src={poster} alt={node.title} /></div>
          )}
          <div className="anime-modal-info">
            <h2 id={`${id}-title`}>{node.title}</h2>
            {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
              <p className="anime-modal-alt">{node.alternative_titles.en}</p>
            )}
            <div className="anime-modal-scores">
              {score && <div className="anime-modal-score"><strong style={{ color: 'var(--amber)' }}>⭐ {score}</strong><span>Score MAL</span></div>}
              {form.score > 0 && <div className="anime-modal-score"><strong style={{ color: 'var(--blue)' }}>★ {form.score}</strong><span>Minha nota</span></div>}
            </div>
            <div className="anime-modal-meta">
              {node.media_type && <span className="anime-media-type">{node.media_type}</span>}
              {totalEps > 0 && <span>{totalEps} episódios</span>}
              {node.start_date && <span>{node.start_date.slice(0, 4)}</span>}
              {broadcast && <span className="anime-broadcast">📅 {broadcast}</span>}
              {(node.genres || []).slice(0, 3).map(g => <span key={g.id} className="anime-genre">{g.name}</span>)}
            </div>
          </div>
        </div>

        <div className="anime-modal-form">
          <div className="field">
            <label htmlFor={`${id}-status`}>Status na lista</label>
            <select id={`${id}-status`} className="anime-status-select" value={form.status} onChange={e => setStatus(e.target.value)}
              style={{ background: `${color}22`, borderColor: color, color }}>
              {Object.entries(STATUS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="anime-label-row" htmlFor={`${id}-eps`}>
              <span>Episódios assistidos</span>
              {totalEps > 0 && (
                <span className="anime-label-aside">de {totalEps}{missing > 0 && <strong> · faltam {missing}</strong>}</span>
              )}
            </label>
            <div className="anime-eps-input">
              <input id={`${id}-eps`} type="number" min={0} max={totalEps || 9999} value={form.num_episodes_watched}
                onChange={e => setForm(f => ({ ...f, num_episodes_watched: Math.max(0, Number(e.target.value)) }))} />
              {totalEps > 0 && (
                <button className="btn btn-sm" onClick={() => setForm(f => ({ ...f, num_episodes_watched: totalEps }))}>Completo</button>
              )}
            </div>
            {totalEps > 0 && (
              <div className="anime-progress">
                <div style={{ background: color, width: `${Math.min(100, (form.num_episodes_watched / totalEps) * 100)}%` }} />
              </div>
            )}
          </div>

          <div className="field">
            <label className="anime-label-row" htmlFor={`${id}-score`}>
              <span>Minha nota</span>
              <span className={`anime-label-aside ${form.score > 0 ? 'has-score' : ''}`}>{SCORE_LABELS[form.score]}</span>
            </label>
            <input id={`${id}-score`} type="range" min={0} max={10} step={1} value={form.score}
              onChange={e => setForm(f => ({ ...f, score: Number(e.target.value) }))} />
            <div className="anime-range-ends"><span>Sem nota</span><span>10</span></div>
          </div>
        </div>

        <div className="anime-modal-footer">
          <button className="btn btn-sm" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : mode === 'add' ? 'Adicionar ao MAL' : 'Salvar no MAL'}
          </button>
        </div>
      </div>
    </div>
  )
}
