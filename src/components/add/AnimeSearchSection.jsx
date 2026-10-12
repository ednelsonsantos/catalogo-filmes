import React, { useState } from 'react'
import AnimeAddModal from './AnimeAddModal.jsx'

const STATUS_LABELS_ADD = {
  watching:      'Assistindo',
  completed:     'Completo',
  on_hold:       'Em pausa',
  dropped:       'Abandonado',
  plan_to_watch: 'Planejo assistir',
}

const STATUS_COLORS_ADD = {
  watching:      '#4a9eff',
  completed:     '#4caf7d',
  on_hold:       '#f59e0b',
  dropped:       '#ef4444',
  plan_to_watch: '#8b8b8b',
}

export default function AnimeSearchSection({ settings, showToast, animeList = [], setAnimeList, onCancel }) {
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState([])
  const [searching, setSearching]     = useState(false)
  const [editAnime, setEditAnime]     = useState(null)
  const [dupWarning, setDupWarning]   = useState(null)

  const findDupAnime = (node) => animeList.find(a => a.node.id === node.id) || null

  const handleSearch = async () => {
    setDupWarning(null)
    if (!query.trim()) return
    if (!settings.malConfigured) {
      showToast('Configure o Client ID do MAL nas Configurações.', 'error')
      return
    }
    setSearching(true)
    setResults([])
    try {
      const res = await window.api.malSearch({ query: query.trim(), limit: 20 })
      setResults(res.data || [])
      if (!res.data?.length) showToast('Nenhum resultado encontrado.', 'info')
    } catch (e) {
      showToast('Erro ao buscar: ' + e.message, 'error')
    } finally {
      setSearching(false)
    }
  }

  const handleSaveAnime = async (animeId, patch, node) => {
    try {
      await window.api.malUpdateAnime({ animeId, patch })
      // insere ou atualiza na lista persistida no App
      if (setAnimeList) {
        setAnimeList(prev => {
          const exists = prev.find(a => a.node.id === animeId)
          const newItem = {
            node,
            list_status: { ...patch, num_episodes_watched: patch.num_episodes_watched },
          }
          return exists
            ? prev.map(a => a.node.id === animeId ? newItem : a)
            : [...prev, newItem]
        })
      }
      showToast('Adicionado/atualizado no MyAnimeList!', 'success')
      setEditAnime(null)
    } catch (e) {
      showToast('Erro ao salvar: ' + e.message, 'error')
    }
  }

  if (!settings.malConfigured) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎌</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          Configure o <strong>Client ID do MyAnimeList</strong> nas Configurações para buscar animes.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Barra de busca */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', fontSize: 13 }}
          placeholder="Nome do anime..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Resultados — mesmo estilo de search-results */}
      {results.length > 0 && (
        <div className="search-results">
          {results.map(({ node }) => {
            const poster   = node._cachedPoster || node.main_picture?.large || node.main_picture?.medium
            const malScore = node.mean ? Number(node.mean).toFixed(2) : null
            const year     = node.start_date?.slice(0, 4)
            const type     = node.media_type || ''
            const eps      = node.num_episodes > 0 ? `${node.num_episodes} eps` : null
            const dup      = findDupAnime(node)
            return (
              <div
                key={node.id}
                className="search-result-item"
                onClick={() => {
                  if (searching) return
                  if (dup) { setDupWarning(dup); return }
                  setEditAnime({ node })
                }}
                style={{ cursor: 'pointer', borderColor: dup ? 'rgba(234,179,8,0.5)' : undefined }}
              >
                {poster
                  ? <img src={poster} alt={node.title} />
                  : <div className="result-no-poster">🎌</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.title}
                    </span>
                    <span style={{ fontSize: 10, background: 'rgba(46,81,162,0.25)', color: '#6ea8fe', padding: '2px 6px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>
                      MAL
                    </span>
                  </div>
                  {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {node.alternative_titles.en}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {[year, type, eps, malScore && `⭐ ${malScore}`].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {dup && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 7px', borderRadius: 99, whiteSpace: 'nowrap', alignSelf: 'center', flexShrink: 0 }}>
                    Já na lista
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {dupWarning && (() => {
        const ls   = dupWarning.list_status
        const sc   = ls?.score > 0 ? ls.score : null
        const eps  = ls?.num_episodes_watched > 0 ? ls.num_episodes_watched : null
        const totEps = dupWarning.node?.num_episodes > 0 ? dupWarning.node.num_episodes : null
        const color  = STATUS_COLORS_ADD[ls?.status] || '#8b8b8b'
        const label  = STATUS_LABELS_ADD[ls?.status] || ls?.status || '—'
        return (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', margin: '0 0 4px' }}>
                "{dupWarning.node?.title}" já está na sua lista
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 12, color: 'var(--text2)' }}>
                <span style={{ color, fontWeight: 600 }}>{label}</span>
                {sc   && <span>★ {sc}/10</span>}
                {eps  && <span>{eps}{totEps ? `/${totEps}` : ''} ep vistos</span>}
              </div>
            </div>
            <button className="btn btn-sm" style={{ fontSize: 11, flexShrink: 0 }} onClick={() => setDupWarning(null)}>
              Fechar
            </button>
          </div>
        )
      })()}

      {!searching && results.length === 0 && query && (
        <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>
          Nenhum resultado. Tente um título diferente.
        </div>
      )}

      {editAnime && (
        <AnimeAddModal
          anime={editAnime}
          onSave={(animeId, patch) => handleSaveAnime(animeId, patch, editAnime.node)}
          onClose={() => setEditAnime(null)}
        />
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}
