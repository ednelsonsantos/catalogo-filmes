import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import './AddDiscPage.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'Digital']

const EMPTY = {
  title: '', original_title: '', year: '', format: 'DVD', formats: '',
  watched_at: '', genre: '', director: '', cast: '', runtime: '',
  imdb_rating: '', synopsis: '', poster_url: '', language: '', country: '', cover_path: null,
}

// ─── OMDb helper ─────────────────────────────────────────────────────────────

function omdbToFilme(data, formats) {
  return {
    title:          data.Title !== 'N/A' ? data.Title : '',
    original_title: data.Title !== 'N/A' ? data.Title : '',
    year:           data.Year && data.Year !== 'N/A' ? parseInt(data.Year) : null,
    format:         formats.split(',')[0]?.trim() || 'DVD',
    formats,
    genre:          data.Genre !== 'N/A' ? data.Genre : '',
    director:       data.Director !== 'N/A' ? data.Director : '',
    cast:           data.Actors !== 'N/A' ? data.Actors : '',
    runtime:        data.Runtime !== 'N/A' ? data.Runtime : '',
    imdb_rating:    data.imdbRating !== 'N/A' ? data.imdbRating : '',
    imdb_id:        data.imdbID || '',
    synopsis:       data.Plot !== 'N/A' ? data.Plot : '',
    poster_url:     data.Poster !== 'N/A' ? data.Poster : '',
    language:       data.Language !== 'N/A' ? data.Language : '',
    country:        data.Country !== 'N/A' ? data.Country : '',
    cover_path:     null,
    watched_at:     '',
  }
}

// ─── Tesseract OCR ────────────────────────────────────────────────────────────

// Palavras comuns em capas de disco que não fazem parte do título
const DISC_NOISE = /\b(blu[\s-]?ray|dvd|4k[\s-]?uhd|uhd|vhs|digital|dolby|atmos|dts|imax|3d|hdr|remaster(ed)?|edition|collection|uncut|extended|theatrical|director['s]*\s*cut|special\s*features?|bonus|disc|disk|widescreen|fullscreen|aspect\s*ratio|region|ntsc|pal)\b/gi

async function extractTitleFromImage(file, onProgress) {
  const worker = await createWorker(['por', 'eng'], 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100)) },
  })
  const { data } = await worker.recognize(file)
  await worker.terminate()

  const candidates = data.lines
    .filter(l => l.text.trim().length > 1 && l.text.trim().length < 80)
    .map(l => {
      const cleaned = l.text.trim().replace(DISC_NOISE, '').replace(/\s+/g, ' ').trim()
      return {
        text: cleaned,
        score: l.words.reduce((s, w) => s + w.confidence, 0) / (l.words.length || 1),
        wordCount: cleaned.split(/\s+/).filter(Boolean).length,
      }
    })
    .filter(l => l.text.length > 1 && l.score > 40 && !/^[\d\s\W]+$/.test(l.text))
    .sort((a, b) => {
      const aFit = a.wordCount >= 1 && a.wordCount <= 6 ? 1 : 0
      const bFit = b.wordCount >= 1 && b.wordCount <= 6 ? 1 : 0
      return (bFit - aFit) || (b.score - a.score)
    })

  // Retorna os 3 melhores candidatos para tentativas progressivas
  return candidates.slice(0, 3).map(c => c.text)
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AddDiscPage({ settings, editFilme, onSaved, showToast }) {
  const [mode, setMode] = useState('photo')
  const [filme, setFilme] = useState(editFilme ? { ...editFilme } : { ...EMPTY })
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [ocrStatus, setOcrStatus] = useState(null)
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef()
  const isEditing = !!editFilme

  useEffect(() => {
    if (editFilme?.cover_path) {
      window.api.readCover(editFilme.cover_path).then(data => { if (data) setCoverPreview(data) })
    } else if (editFilme?.poster_url && editFilme.poster_url !== 'N/A') {
      setCoverPreview(editFilme.poster_url)
    }
  }, [editFilme])

  const setField = useCallback((key, value) => setFilme(f => ({ ...f, [key]: value })), [])

  // ── Busca OMDb (usada pelo OCR e pela busca manual) ──────────────────────────

  const doSearch = useCallback(async (query, year = searchYear) => {
    if (!query?.trim()) return
    if (!settings.omdbApiKey) { showToast('Configure a chave OMDb nas configurações.', 'error'); return }
    setSearching(true); setSearchResults([])

    const apiKey = settings.omdbApiKey

    async function fetchCombined(q, y) {
      // Busca paralela: ?t= (melhor resultado exato) + ?s= (lista)
      const [exactRes, listRes] = await Promise.all([
        window.api.omdbSearch({ title: q, year: y, apiKey }),
        window.api.omdbSearchByTitle({ title: q, year: y, apiKey }),
      ])
      const exact = exactRes?.Response === 'True' ? exactRes : null
      const list  = listRes?.Search || []
      const seen  = new Set(exact ? [exact.imdbID] : [])
      return [
        ...(exact ? [{ ...exact, _exact: true }] : []),
        ...list.filter(r => !seen.has(r.imdbID)),
      ]
    }

    try {
      let results = await fetchCombined(query.trim(), year)

      // Fallback: remove última palavra (1 nível, só se query > 3 palavras)
      if (!results.length) {
        const words = query.trim().split(/\s+/)
        if (words.length > 3) {
          results = await fetchCombined(words.slice(0, -1).join(' '), year)
        }
      }

      setSearchResults(results)
      if (!results.length) showToast('Nenhum resultado. Tente termos diferentes.', 'info')
    } catch { showToast('Erro ao buscar.', 'error') }
    finally { setSearching(false) }
  }, [settings, showToast, searchYear])

  const handleSearch = useCallback(() => doSearch(searchQuery, searchYear), [doSearch, searchQuery, searchYear])

  const selectResult = useCallback(async (item) => {
    if (!settings.omdbApiKey) return
    setSearching(true)
    try {
      // Usa imdbID para busca precisa — evita pegar filme errado com mesmo título
      const data = await window.api.omdbSearch({ imdbId: item.imdbID, apiKey: settings.omdbApiKey })
      if (data.Response === 'True') {
        const filled = omdbToFilme(data, filme.formats || filme.format || 'DVD')
        setFilme(f => ({ ...f, ...filled, cover_path: f.cover_path, watched_at: f.watched_at }))
        if (filled.poster_url) setCoverPreview(filled.poster_url)
        setSearchResults([]); setMode('manual')
        showToast(`"${data.Title}" carregado!`, 'success')
      }
    } catch { showToast('Erro ao carregar dados.', 'error') }
    finally { setSearching(false) }
  }, [settings, filme.formats, filme.format, showToast])

  // ── OCR ──────────────────────────────────────────────────────────────────────

  const handleImageFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setCoverFile(file)
    const reader = new FileReader()
    reader.onload = e => setCoverPreview(e.target.result)
    reader.readAsDataURL(file)

    setOcrStatus('loading'); setOcrProgress(0)
    setOcrMessage('Lendo texto da capa (OCR local)...')

    try {
      const candidates = await extractTitleFromImage(file, pct => {
        setOcrProgress(pct)
        setOcrMessage(`Lendo texto da capa... ${pct}%`)
      })

      if (!candidates.length) {
        setOcrStatus('error')
        setOcrMessage('Não foi possível extrair texto. Use a busca manual.')
        return
      }

      const best = candidates[0].replace(/[|\\/<>{}[\]]/g, '').replace(/\s+/g, ' ').trim()

      if (!settings.omdbApiKey) {
        setOcrStatus('done')
        setField('title', best)
        setOcrMessage(`Título extraído: "${best}". Configure a chave OMDb para buscar detalhes.`)
        return
      }

      setOcrStatus('done')
      setOcrMessage(`Texto detectado: "${best}" — escolha o filme correto na lista →`)

      // Passa para aba de busca com o título detectado preenchido e busca automática
      setSearchQuery(best)
      setMode('search')
      await doSearch(best)

      // Se não achou com o melhor candidato, tenta os outros
      // (doSearch já encurta progressivamente, mas candidatos alternativos podem ajudar)
    } catch (err) {
      console.error(err)
      setOcrStatus('error')
      setOcrMessage('Erro ao processar imagem. Tente foto com melhor iluminação.')
    }
  }, [settings, setField, doSearch])

  // ── Salvar ───────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!filme.title.trim()) { showToast('Informe o título.', 'error'); return }
    setSaving(true)
    try {
      let saved = isEditing
        ? await window.api.update({ ...filme, id: editFilme.id })
        : await window.api.insert({ ...filme })

      if (coverFile) {
        const ext = coverFile.name.split('.').pop() || 'jpg'
        const base64 = await fileToBase64(coverFile)
        const savedPath = await window.api.saveCover({ id: saved.id, base64, ext })
        await window.api.update({ ...saved, cover_path: savedPath })
      }

      showToast(isEditing ? 'Atualizado!' : `"${filme.title}" adicionado!`, 'success')
      onSaved()
    } catch (e) {
      console.error(e); showToast('Erro ao salvar.', 'error')
    } finally { setSaving(false) }
  }, [filme, coverFile, isEditing, editFilme, onSaved, showToast])

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  const onDrop = useCallback(e => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageFile(file)
  }, [handleImageFile])

  return (
    <div className="page add-page">
      <h1 className="page-title">{isEditing ? `Editar: ${editFilme.title}` : 'Adicionar Filme'}</h1>

      {!isEditing && (
        <div className="mode-tabs">
          {[
            { id: 'photo',  label: '📷 Foto da capa' },
            { id: 'search', label: '🔍 Buscar por título' },
            { id: 'manual', label: '✏️ Preencher manualmente' },
          ].map(m => (
            <button key={m.id} className={`mode-tab ${mode === m.id ? 'active' : ''}`} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="add-layout">
        {/* Esquerda: capa + formatos + data */}
        <div className="add-left">
          <div
            className={`cover-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            {coverPreview
              ? <img src={coverPreview} alt="capa" className="cover-img" />
              : <div className="cover-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>Capa do filme</span>
                </div>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => handleImageFile(e.target.files?.[0])} />
          </div>

          {ocrStatus && (
            <div className={`ai-status ${ocrStatus}`}>
              {ocrStatus === 'loading' && <span className="ai-spin"/>}
              {ocrStatus === 'done'    && <span>✓</span>}
              {ocrStatus === 'error'   && <span>⚠</span>}
              <div style={{ flex: 1 }}>
                <span>{ocrMessage}</span>
                {ocrStatus === 'loading' && ocrProgress > 0 && (
                  <div style={{ marginTop: 6, height: 3, background: 'rgba(74,158,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ocrProgress}%`, background: 'var(--blue)', transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formatos — múltipla seleção */}
          <div className="field" style={{ marginTop: 12 }}>
            <label>Tenho em</label>
            <div className="format-checkboxes">
              {ALL_FORMATS.map(f => {
                const selected = (filme.formats || filme.format || '').split(',').map(x => x.trim()).filter(Boolean)
                const checked = selected.includes(f)
                return (
                  <label key={f} className={`format-check ${checked ? 'active' : ''}`}>
                    <input type="checkbox" checked={checked} style={{ display: 'none' }} onChange={() => {
                      const next = checked ? selected.filter(x => x !== f) : [...selected, f]
                      setField('formats', next.join(', '))
                      setField('format', next[0] || f)
                    }} />
                    {f}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Data assistido */}
          <div className="field" style={{ marginTop: 8 }}>
            <label>Assistido em</label>
            <input type="date" value={filme.watched_at || ''} onChange={e => setField('watched_at', e.target.value)}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
          </div>
        </div>

        {/* Direita: modo ativo */}
        <div className="add-right">
          {mode === 'photo' && !isEditing && (
            <div className="photo-instructions card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Como funciona</h3>
              <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 2 }}>
                <li>Clique na capa ou arraste uma foto</li>
                <li>OCR local lê o texto da imagem — sem internet</li>
                <li>O título é buscado no OMDb para preencher os detalhes</li>
                <li>Revise e salve</li>
              </ol>
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--green)', lineHeight: 1.5 }}>
                  ✓ OCR gratuito e local — só a chave OMDb é necessária.
                </p>
              </div>
              {filme.title && <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}><FormFields filme={filme} setField={setField} /></div>}
            </div>
          )}

          {mode === 'search' && !isEditing && (
            <div className="search-section">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', fontSize: 13 }}
                  placeholder="Nome do filme ou série..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <input
                  type="number"
                  style={{ width: 80, padding: '9px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', outline: 'none', fontSize: 13 }}
                  placeholder="Ano"
                  value={searchYear} onChange={e => setSearchYear(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  min="1888" max="2099"
                />
                <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
                  {searching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(r => (
                    <div key={r.imdbID} className="search-result-item" onClick={() => !searching && selectResult(r)}
                      style={{ opacity: searching ? 0.5 : 1, cursor: searching ? 'wait' : 'pointer' }}>
                      {r.Poster && r.Poster !== 'N/A'
                        ? <img src={r.Poster} alt={r.Title} />
                        : <div className="result-no-poster">?</div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {r.Title}
                          {r._exact && <span style={{ fontSize: 10, background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>Melhor resultado</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                          {r.Year} · {r.Type === 'movie' ? 'Filme' : r.Type === 'series' ? 'Série' : r.Type}
                          {r.imdbRating && r.imdbRating !== 'N/A' && <> · ★ {r.imdbRating}</>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!searching && searchResults.length === 0 && searchQuery && (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
                  Nenhum resultado. Tente um título diferente ou adicione o ano.
                </div>
              )}
              {filme.title && <div style={{ marginTop: 16 }}><FormFields filme={filme} setField={setField} /></div>}
            </div>
          )}

          {(mode === 'manual' || isEditing) && (
            <FormFields filme={filme} setField={setField} />
          )}

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Adicionar à coleção'}
            </button>
            <button className="btn" onClick={onSaved}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FormFields ───────────────────────────────────────────────────────────────

function FormFields({ filme, setField }) {
  return (
    <div className="form-fields">
      <div className="form-row">
        <div className="field">
          <label>Título *</label>
          <input value={filme.title} onChange={e => setField('title', e.target.value)} placeholder="Título em português" />
        </div>
        <div className="field">
          <label>Título original</label>
          <input value={filme.original_title || ''} onChange={e => setField('original_title', e.target.value)} placeholder="Original title" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Ano</label>
          <input type="number" value={filme.year || ''} onChange={e => setField('year', e.target.value)} placeholder="2024" />
        </div>
        <div className="field">
          <label>Duração</label>
          <input value={filme.runtime || ''} onChange={e => setField('runtime', e.target.value)} placeholder="120 min" />
        </div>
        <div className="field">
          <label>Nota IMDb</label>
          <input value={filme.imdb_rating || ''} onChange={e => setField('imdb_rating', e.target.value)} placeholder="8.5" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Gênero</label>
          <input value={filme.genre || ''} onChange={e => setField('genre', e.target.value)} placeholder="Ação, Drama, ..." />
        </div>
        <div className="field">
          <label>Diretor</label>
          <input value={filme.director || ''} onChange={e => setField('director', e.target.value)} placeholder="Nome do diretor" />
        </div>
      </div>
      <div className="field">
        <label>Elenco</label>
        <input value={filme.cast || ''} onChange={e => setField('cast', e.target.value)} placeholder="Ator 1, Ator 2, ..." />
      </div>
      <div className="form-row">
        <div className="field">
          <label>País</label>
          <input value={filme.country || ''} onChange={e => setField('country', e.target.value)} placeholder="Brasil, USA, ..." />
        </div>
        <div className="field">
          <label>Idioma</label>
          <input value={filme.language || ''} onChange={e => setField('language', e.target.value)} placeholder="Português, English, ..." />
        </div>
      </div>
      <div className="field">
        <label>Sinopse</label>
        <textarea value={filme.synopsis || ''} onChange={e => setField('synopsis', e.target.value)} placeholder="Breve descrição..." rows={3} />
      </div>
    </div>
  )
}
