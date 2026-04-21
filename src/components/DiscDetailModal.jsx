import React, { useState, useEffect } from 'react'

export default function DiscDetailModal({ filme, onClose, onEdit, onDelete }) {
  const [coverSrc, setCoverSrc] = useState(null)

  useEffect(() => {
    const load = async () => {
      if (filme.cover_path) {
        const data = await window.api.readCover(filme.cover_path)
        if (data) { setCoverSrc(data); return }
      }
      if (filme.poster_url && filme.poster_url !== 'N/A') setCoverSrc(filme.poster_url)
    }
    load()
  }, [filme])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const formats = (filme.formats || filme.format || '').split(',').map(f => f.trim()).filter(Boolean)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680, display: 'flex', gap: 24, padding: 0, overflow: 'hidden' }}>
        {/* Capa */}
        <div style={{ width: 180, flexShrink: 0, background: 'var(--bg3)' }}>
          {coverSrc
            ? <img src={coverSrc} alt={filme.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{filme.title}</h2>
            {filme.original_title && filme.original_title !== filme.title && (
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{filme.original_title}</p>
            )}
          </div>

          {/* Badges: ano + formatos + duração + nota */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {filme.year && <span style={{ fontSize: 12, background: 'var(--bg4)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 4 }}>{filme.year}</span>}
            {formats.map(f => (
              <span key={f} style={{ fontSize: 11, fontWeight: 600, background: 'rgba(74,158,255,0.12)', color: '#4a9eff', padding: '2px 8px', borderRadius: 4 }}>{f}</span>
            ))}
            {filme.runtime && filme.runtime !== 'N/A' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>⏱ {filme.runtime}</span>}
            {filme.imdb_rating && filme.imdb_rating !== 'N/A' && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>★ {filme.imdb_rating} IMDb</span>}
          </div>

          {/* Assistido em */}
          {filme.watched_at && (
            <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>✓</span>
              <span>Assistido em {new Date(filme.watched_at + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          )}

          {filme.genre && <p style={{ fontSize: 12, color: 'var(--text3)' }}>{filme.genre}</p>}

          {filme.synopsis && (
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              {filme.synopsis}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
            {filme.director && <InfoRow label="Diretor" value={filme.director} />}
            {filme.cast && <InfoRow label="Elenco" value={filme.cast} full />}
            {filme.country && <InfoRow label="País" value={filme.country} />}
            {filme.language && <InfoRow label="Idioma" value={filme.language} />}
          </div>

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
