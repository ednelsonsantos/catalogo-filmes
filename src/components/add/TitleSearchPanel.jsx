import React, { useMemo } from 'react'
import { TMDB_IMG, normalizeTitle } from '../../utils/titleMappers.js'

const inputStyle = { padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', fontSize: 13 }

// Normaliza um resultado do OMDb ou da TMDB (filme/série) pra exibição
function describeResult(r) {
  const isTmdb = r._source === 'tmdb'
  const isTv = isTmdb && r._tmdbType === 'tv'
  return {
    key: isTmdb ? `${r._tmdbType}-${r.id}` : r.imdbID,
    isTmdb,
    poster: isTmdb
      ? (r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null)
      : (r.Poster && r.Poster !== 'N/A' ? r.Poster : null),
    title: isTmdb ? (isTv ? r.name : r.title) : r.Title,
    origTitle: isTmdb ? (isTv ? r.original_name : r.original_title) : null,
    year: isTmdb ? (isTv ? r.first_air_date?.slice(0, 4) : r.release_date?.slice(0, 4)) : r.Year,
    rating: isTmdb
      ? (r.vote_average ? `★ ${Number(r.vote_average).toFixed(1)}` : null)
      : (r.imdbRating && r.imdbRating !== 'N/A' ? `★ ${r.imdbRating} IMDb` : null),
    typeLabel: isTmdb ? (isTv ? 'Série' : 'Filme') : (r.Type === 'movie' ? 'Filme' : r.Type === 'series' ? 'Série' : r.Type),
  }
}

export default function TitleSearchPanel({
  query, setQuery, year, setYear, onSearch, searching, results,
  findDuplicate, onSelect, duplicateWarning, onDismissDuplicate, children,
}) {
  // Resultados com título muito parecido — alerta pra conferir o ano antes de escolher
  // (achado real: um ID errado foi salvo pra uma série por engano numa busca ambígua)
  const hasAmbiguousResults = useMemo(() => {
    const names = results.map(r => normalizeTitle(r._source === 'tmdb' ? (r.name || r.title) : r.Title))
    return names.some((n, i) => n && names.indexOf(n) !== i)
  }, [results])

  return (
    <div className="search-section">
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Nome do filme ou série..."
          value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
        />
        <input
          type="number"
          style={{ ...inputStyle, width: 80, padding: '9px 10px' }}
          placeholder="Ano"
          value={year} onChange={e => setYear(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}
          min="1888" max="2099"
        />
        <button className="btn btn-primary" onClick={onSearch} disabled={searching}>
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {hasAmbiguousResults && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8, fontSize: 12, color: '#f59e0b' }}>
          ⚠ Vários resultados com nome parecido — confira o ano e o pôster antes de escolher.
        </div>
      )}
      {results.length > 0 && (
        <div className="search-results">
          {results.map(r => {
            const d = describeResult(r)
            const dupFound = findDuplicate(r)
            return (
              <div key={d.key} className="search-result-item"
                onClick={() => !searching && onSelect(r)}
                style={{ opacity: searching ? 0.5 : 1, cursor: searching ? 'wait' : 'pointer', position: 'relative', borderColor: dupFound ? 'rgba(234,179,8,0.5)' : undefined }}>
                {d.poster
                  ? <img src={d.poster} alt={d.title} />
                  : <div className="result-no-poster">?</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                    {d.isTmdb
                      ? <span style={{ fontSize: 10, background: 'rgba(1,180,228,0.15)', color: '#01b4e4', padding: '2px 6px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>TMDB</span>
                      : r._exact && <span style={{ fontSize: 10, background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>OMDb</span>
                    }
                  </div>
                  {d.origTitle && d.origTitle !== d.title && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{d.origTitle}</div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {d.year} · {d.typeLabel}{d.rating && <> · {d.rating}</>}
                  </div>
                </div>
                {dupFound && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', alignSelf: 'center', flexShrink: 0 }}>
                    Já na coleção
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!searching && results.length === 0 && query && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
          Nenhum resultado. Tente um título diferente ou adicione o ano.
        </div>
      )}

      {duplicateWarning && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', margin: '0 0 4px' }}>
              "{duplicateWarning.title}" já está na sua coleção
            </p>
            <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0 }}>
              Adicionado em {duplicateWarning.created_at?.slice(0, 10) || '—'}
              {duplicateWarning.formats ? ` · ${duplicateWarning.formats}` : ''}
              {duplicateWarning.watched_at ? ' · Assistido' : ''}
              {duplicateWarning.watching ? ' · Assistindo' : ''}
            </p>
          </div>
          <button className="btn btn-sm" style={{ fontSize: 11, flexShrink: 0 }} onClick={onDismissDuplicate}>
            Fechar
          </button>
        </div>
      )}
      {children}
    </div>
  )
}
