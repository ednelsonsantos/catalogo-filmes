import React, { useState, useEffect } from 'react'
import './DiscCard.css'

function getFormats(filme) {
  return (filme.formats || filme.format || '').split(',').map(f => f.trim()).filter(Boolean)
}

export default function DiscCard({ filme, viewMode, onClick, onEdit, onDelete }) {
  const [coverSrc, setCoverSrc] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (filme.cover_path) {
        const data = await window.api.readCover(filme.cover_path)
        if (!cancelled && data) { setCoverSrc(data); return }
      }
      if (!cancelled && filme.poster_url && filme.poster_url !== 'N/A') setCoverSrc(filme.poster_url)
    }
    load()
    return () => { cancelled = true }
  }, [filme.cover_path, filme.poster_url])

  const formats = getFormats(filme)

  if (viewMode === 'list') {
    return (
      <div className="disc-list-item" onClick={onClick}>
        <div className="list-cover">
          {coverSrc ? <img src={coverSrc} alt={filme.title} /> : <DiscPlaceholder />}
        </div>
        <div className="list-info">
          <div className="list-title">{filme.title}</div>
          {filme.original_title && filme.original_title !== filme.title && (
            <div className="list-original">{filme.original_title}</div>
          )}
          <div className="list-meta">
            {filme.year && <span>{filme.year}</span>}
            {filme.director && <><span className="dot">·</span><span>{filme.director}</span></>}
            {filme.genre && <><span className="dot">·</span><span>{filme.genre}</span></>}
            {filme.runtime && <><span className="dot">·</span><span>{filme.runtime}</span></>}
          </div>
        </div>
        <div className="list-right" onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {formats.map(f => <span key={f} className="format-badge">{f}</span>)}
          </div>
          {filme.watched_at && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ assistido</span>}
          {filme.imdb_rating && filme.imdb_rating !== 'N/A' && (
            <span className="rating-badge">★ {filme.imdb_rating}</span>
          )}
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onEdit} title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="btn btn-icon btn-sm btn-ghost btn-danger" onClick={onDelete} title="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="disc-card" onClick={onClick}>
      <div className="disc-cover">
        {coverSrc ? <img src={coverSrc} alt={filme.title} /> : <DiscPlaceholder />}
        <span className="format-badge-overlay">
          {formats.join(' · ') || '—'}
        </span>
        {filme.watched_at && <span className="watched-overlay">✓</span>}
        {filme.imdb_rating && filme.imdb_rating !== 'N/A' && (
          <span className="rating-overlay">★ {filme.imdb_rating}</span>
        )}
      </div>
      <div className="disc-meta-grid">
        <div className="disc-title-grid">{filme.title}</div>
        <div className="disc-year-grid">{filme.year || '—'}</div>
      </div>
    </div>
  )
}

function DiscPlaceholder() {
  return (
    <div className="disc-placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="2" y="2" width="20" height="20" rx="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
    </div>
  )
}
