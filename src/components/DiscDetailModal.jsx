import React, { useState, useEffect } from 'react'
import EpisodesPanel from './EpisodesPanel.jsx'
import { SERIES_CATEGORIES } from '../constants.js'

export default function DiscDetailModal({ filme, onClose, onEdit, onDelete, onUpdated, showToast }) {
  const [coverSrc, setCoverSrc] = useState(null)
  const [liveFilme, setLiveFilme] = useState(filme)

  useEffect(() => { setLiveFilme(filme) }, [filme])

  useEffect(() => {
    const load = async () => {
      if (liveFilme.cover_path) {
        const data = await window.api.readCover(liveFilme.cover_path)
        if (data) { setCoverSrc(data); return }
      }
      if (liveFilme.poster_url && liveFilme.poster_url !== 'N/A') setCoverSrc(liveFilme.poster_url)
    }
    load()
  }, [liveFilme])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleEpisodesUpdated = (updated) => {
    setLiveFilme(updated)
    onUpdated?.(updated)
  }

  const formats = (liveFilme.formats || liveFilme.format || '').split(',').map(f => f.trim()).filter(Boolean)
  const hasEpisodes = !!liveFilme.tmdb_id && SERIES_CATEGORIES.includes(liveFilme.category)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, display: 'flex', gap: 24, padding: 0, overflow: 'hidden' }}>
        {/* Capa */}
        <div style={{ width: 180, flexShrink: 0, background: 'var(--bg3)' }}>
          {coverSrc
            ? <img src={coverSrc} alt={liveFilme.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ height: '100%', minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                  <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
              </div>
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, padding: '24px 24px 24px 0', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={onClose} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>

          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{liveFilme.title}</h2>
            {liveFilme.original_title && liveFilme.original_title !== liveFilme.title && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{liveFilme.original_title}</p>
            )}
          </div>

          {/* Badges: categoria + ano + formatos + duração + nota */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {liveFilme.category && <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(140,100,255,0.15)', color: '#a78bfa', padding: '2px 8px', borderRadius: 4 }}>{liveFilme.category}</span>}
            {liveFilme.year && <span style={{ fontSize: 12, background: 'var(--bg4)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 4 }}>{liveFilme.year}</span>}
            {formats.map(f => (
              <span key={f} style={{ fontSize: 11, fontWeight: 600, background: 'rgba(74,158,255,0.12)', color: '#4a9eff', padding: '2px 8px', borderRadius: 4 }}>{f}</span>
            ))}
            {liveFilme.runtime && liveFilme.runtime !== 'N/A' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>⏱ {liveFilme.runtime}</span>}
            {liveFilme.imdb_rating && liveFilme.imdb_rating !== 'N/A' && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>★ {liveFilme.imdb_rating} IMDb</span>}
          </div>

          {/* Assistindo */}
          {!!liveFilme.watching && (
            <div style={{ fontSize: 12, color: '#4a9eff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>▶</span>
              <span>Assistindo</span>
            </div>
          )}

          {/* Assistido em */}
          {liveFilme.watched_at && (
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>✓</span>
              <span>
                {liveFilme.watched_at === 'watched'
                  ? 'Assistido'
                  : `Assistido em ${new Date(liveFilme.watched_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`
                }
              </span>
            </div>
          )}

          {liveFilme.genre && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{liveFilme.genre}</p>}

          {liveFilme.synopsis && (
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {liveFilme.synopsis}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
            {liveFilme.director && <InfoRow label="Diretor" value={liveFilme.director} />}
            {liveFilme.cast && <InfoRow label="Elenco" value={liveFilme.cast} full />}
            {liveFilme.country && <InfoRow label="País" value={liveFilme.country} />}
            {liveFilme.language && <InfoRow label="Idioma" value={liveFilme.language} />}
          </div>

          {hasEpisodes && (
            <EpisodesPanel filme={liveFilme} onUpdated={handleEpisodesUpdated} showToast={showToast} />
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-sm" onClick={onEdit}>Editar</button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>Remover</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <div style={{ color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}
