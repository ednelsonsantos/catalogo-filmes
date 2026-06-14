import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createWorker } from 'tesseract.js'
import './AddDiscPage.css'

// ─── Constantes MAL ───────────────────────────────────────────────────────────

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

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'Digital']

const ALL_CATEGORIES = ['', 'Filme', 'Série', 'Mini-série', 'Documentário', 'Animação', 'Anime', 'Show/Stand-up', 'Musical', 'Esporte', 'Outro']

const EMPTY = {
  title: '', original_title: '', year: '', format: 'DVD', formats: '',
  watched_at: '', genre: '', director: '', cast: '', runtime: '',
  imdb_rating: '', synopsis: '', poster_url: '', language: '', country: '', cover_path: null,
  category: '', tmdb_id: '',
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500'

// ─── OMDb helper ─────────────────────────────────────────────────────────────

function omdbTypeToCategory(type) {
  if (type === 'series')  return 'Série'
  if (type === 'episode') return 'Série'
  if (type === 'movie')   return 'Filme'
  return ''
}

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
    category:       omdbTypeToCategory(data.Type),
    tmdb_id:        '',
  }
}

// ─── TMDB helper ─────────────────────────────────────────────────────────────

function tmdbToFilme(data, formats) {
  const year      = data.release_date ? parseInt(data.release_date.split('-')[0]) : null
  const director  = data.credits?.crew?.find(c => c.job === 'Director')?.name || ''
  const cast      = (data.credits?.cast || []).slice(0, 5).map(a => a.name).join(', ')
  const genres    = (data.genres || []).map(g => g.name).join(', ')
  const language  = data.spoken_languages?.[0]?.name || ''
  const country   = data.production_countries?.[0]?.name || ''
  return {
    title:          data.title || data.original_title || '',
    original_title: data.original_title || '',
    year,
    format:         formats.split(',')[0]?.trim() || 'DVD',
    formats,
    genre:          genres,
    director,
    cast,
    runtime:        data.runtime ? `${data.runtime} min` : '',
    imdb_rating:    data.vote_average ? Number(data.vote_average).toFixed(1) : '',
    imdb_id:        data.imdb_id || '',
    synopsis:       data.overview || '',
    poster_url:     data.poster_path ? `${TMDB_IMG}${data.poster_path}` : '',
    language,
    country,
    cover_path:     null,
    watched_at:     '',
    category:       'Filme',
    tmdb_id:        String(data.id || ''),
  }
}

function tmdbTvTypeToCategory(type) {
  if (type === 'Miniseries')   return 'Mini-série'
  if (type === 'Documentary')  return 'Documentário'
  if (type === 'Animation')    return 'Animação'
  if (type === 'Talk Show')    return 'Show/Stand-up'
  return 'Série'
}

function tmdbToFilmeTv(data, formats) {
  const year     = data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : null
  const director = data.created_by?.[0]?.name || data.credits?.crew?.find(c => c.job === 'Director')?.name || ''
  const cast     = (data.credits?.cast || []).slice(0, 5).map(a => a.name).join(', ')
  const genres   = (data.genres || []).map(g => g.name).join(', ')
  const language = data.spoken_languages?.[0]?.name || ''
  const country  = data.production_countries?.[0]?.name || ''
  const runtime  = data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min/ep` : ''
  return {
    title:          data.name || data.original_name || '',
    original_title: data.original_name || '',
    year,
    format:         formats.split(',')[0]?.trim() || 'DVD',
    formats,
    genre:          genres,
    director,
    cast,
    runtime,
    imdb_rating:    data.vote_average ? Number(data.vote_average).toFixed(1) : '',
    imdb_id:        '',
    synopsis:       data.overview || '',
    poster_url:     data.poster_path ? `${TMDB_IMG}${data.poster_path}` : '',
    language,
    country,
    cover_path:     null,
    watched_at:     '',
    category:       tmdbTvTypeToCategory(data.type),
    tmdb_id:        String(data.id || ''),
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

export default function AddDiscPage({ settings, editFilme, filmes = [], collections = [], onSaved, showToast, animeList = [], setAnimeList }) {
  const [tab, setTab] = useState('titulo')
  const [mode, setMode] = useState('photo')
  const [filme, setFilme] = useState(editFilme ? { ...editFilme } : { ...EMPTY })
  const [selectedCollections, setSelectedCollections] = useState([])
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [ocrStatus, setOcrStatus] = useState(null)
  const [ocrMessage, setOcrMessage] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
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
    if (editFilme?.id) {
      window.api.colecoesGetByFilme(editFilme.id).then(ids => setSelectedCollections(ids))
    }
  }, [editFilme])

  const setField = useCallback((key, value) => setFilme(f => ({ ...f, [key]: value })), [])

  const handleCancel = useCallback(() => {
    setTab('titulo')
    setMode('photo')
    setFilme({ ...EMPTY })
    setSearchQuery('')
    setSearchYear('')
    setSearchResults([])
    setDuplicateWarning(null)
    setCoverPreview(null)
    setCoverFile(null)
    setOcrStatus(null)
    onSaved()
  }, [onSaved])

  // ── Busca OMDb (usada pelo OCR e pela busca manual) ──────────────────────────

  const doSearch = useCallback(async (query, year = searchYear) => {
    if (!query?.trim()) return
    const { omdbConfigured, tmdbConfigured } = settings
    if (!omdbConfigured && !tmdbConfigured) { showToast('Configure ao menos uma chave de API nas configurações.', 'error'); return }
    setSearching(true); setSearchResults([])

    async function fetchCombined(q, y) {
      // Busca paralela: OMDb (?t= + ?s=) e TMDB ao mesmo tempo — apiKey gerenciada pelo main process
      const [omdbResults, tmdbResults] = await Promise.all([
        omdbConfigured ? (async () => {
          const [exactRes, listRes] = await Promise.all([
            window.api.omdbSearch({ title: q, year: y }),
            window.api.omdbSearchByTitle({ title: q, year: y }),
          ])
          const exact = exactRes?.Response === 'True' ? exactRes : null
          const list  = listRes?.Search || []
          const seen  = new Set(exact ? [exact.imdbID] : [])
          return [
            ...(exact ? [{ ...exact, _exact: true, _source: 'omdb' }] : []),
            ...list.filter(r => !seen.has(r.imdbID)).map(r => ({ ...r, _source: 'omdb' })),
          ]
        })().catch(() => []) : [],

        tmdbConfigured ? Promise.all([
          window.api.tmdbSearch({ query: q, year: y })
            .then(res => (res.results || []).slice(0, 5).map(r => ({ ...r, _source: 'tmdb', _tmdbType: 'movie' }))),
          window.api.tmdbSearchTv({ query: q, year: y })
            .then(res => (res.results || []).slice(0, 3).map(r => ({ ...r, _source: 'tmdb', _tmdbType: 'tv' }))),
        ]).then(([movies, tvs]) => [...movies, ...tvs]).catch(() => []) : [],
      ])

      // TMDB primeiro; remove OMDb que sejam duplicatas por título original + ano
      const tmdbKeys = new Set(
        tmdbResults.map(r => {
          const orig = r._tmdbType === 'tv' ? r.original_name : r.original_title
          const year = r._tmdbType === 'tv' ? r.first_air_date?.slice(0, 4) : r.release_date?.slice(0, 4)
          return `${(orig || '').toLowerCase()}_${year}`
        })
      )
      const dedupedOmdb = omdbResults.filter(r => {
        const key = `${(r.Title || '').toLowerCase()}_${(r.Year || '').slice(0, 4)}`
        return !tmdbKeys.has(key)
      })
      return [...tmdbResults, ...dedupedOmdb]
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

  const handleSearch = useCallback(() => { setDuplicateWarning(null); doSearch(searchQuery, searchYear) }, [doSearch, searchQuery, searchYear])

  const findDuplicate = useCallback((item) => {
    const isTmdb  = item._source === 'tmdb'
    const tmdbId  = isTmdb ? String(item.id) : null
    const imdbId  = !isTmdb ? item.imdbID : null
    const title   = isTmdb ? (item.name || item.title || '') : (item.Title || '')
    const year    = isTmdb
      ? parseInt(item.first_air_date || item.release_date || '0')
      : parseInt(item.Year || '0')
    return filmes.find(f => {
      if (tmdbId && f.tmdb_id && f.tmdb_id === tmdbId) return true
      if (imdbId && f.imdb_id && f.imdb_id === imdbId) return true
      // fallback: título normalizado + ano
      const sameTitle = (f.title || '').toLowerCase() === title.toLowerCase() ||
                        (f.original_title || '').toLowerCase() === title.toLowerCase()
      const sameYear  = year && f.year && Number(f.year) === year
      return sameTitle && sameYear
    }) || null
  }, [filmes])

  const selectResult = useCallback(async (item) => {
    setDuplicateWarning(null)
    const existing = findDuplicate(item)
    if (existing) {
      setDuplicateWarning(existing)
      return
    }
    setSearching(true)
    try {
      const formats = filme.formats || filme.format || 'DVD'
      let filled

      if (item._source === 'tmdb' && settings.tmdbConfigured) {
        if (item._tmdbType === 'tv') {
          const data = await window.api.tmdbTvDetails({ id: item.id })
          filled = tmdbToFilmeTv(data, formats)
        } else {
          const data = await window.api.tmdbDetails({ id: item.id })
          filled = tmdbToFilme(data, formats)
        }
      } else if (settings.omdbConfigured) {
        const data = await window.api.omdbSearch({ imdbId: item.imdbID })
        if (data.Response !== 'True') throw new Error('not found')
        filled = omdbToFilme(data, formats)
      } else return

      setFilme(f => ({ ...f, ...filled, cover_path: f.cover_path, watched_at: f.watched_at }))
      if (filled.poster_url) setCoverPreview(filled.poster_url)
      setSearchResults([]); setMode('manual')
      showToast(`"${filled.title}" carregado!`, 'success')
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

      if (!settings.omdbConfigured && !settings.tmdbConfigured) {
        setOcrStatus('done')
        setField('title', best)
        setOcrMessage(`Título extraído: "${best}". Configure uma chave de API para buscar detalhes.`)
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
      onSaved(saved.id, selectedCollections)
    } catch (e) {
      console.error(e); showToast('Erro ao salvar.', 'error')
    } finally { setSaving(false) }
  }, [filme, coverFile, isEditing, editFilme, onSaved, showToast, selectedCollections])

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  const onDrop = useCallback(e => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageFile(file)
  }, [handleImageFile])

  return (
    <div className="page add-page">
      <h1 className="page-title">{isEditing ? `Editar: ${editFilme.title}` : 'Adicionar'}</h1>

      {/* Abas principais */}
      {!isEditing && (
        <div className="mode-tabs" style={{ marginBottom: 16 }}>
          <button className={`mode-tab ${tab === 'titulo' ? 'active' : ''}`} onClick={() => setTab('titulo')}>
            🎬 Adicionar Título
          </button>
          <button className={`mode-tab ${tab === 'anime' ? 'active' : ''}`} onClick={() => setTab('anime')}>
            🎌 Adicionar Anime
          </button>
        </div>
      )}

      {/* Aba Anime */}
      {tab === 'anime' && !isEditing && (
        <AnimeSearchSection settings={settings} showToast={showToast} animeList={animeList} setAnimeList={setAnimeList} onCancel={handleCancel} />
      )}

      {/* Aba Título */}
      {(tab === 'titulo' || isEditing) && <>
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

          {/* Categoria */}
          <div className="field" style={{ marginTop: 8 }}>
            <label>Categoria</label>
            <select value={filme.category || ''} onChange={e => setField('category', e.target.value)}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: filme.category ? 'var(--text)' : 'var(--text3)', fontSize: 13, outline: 'none', width: '100%' }}>
              <option value="">— Selecionar —</option>
              {ALL_CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Data assistido */}
          <div className="field" style={{ marginTop: 8 }}>
            <label>Assistido em</label>
            <input
              type="date"
              value={filme.watched_at && filme.watched_at !== 'watched' ? filme.watched_at : ''}
              onChange={e => setField('watched_at', e.target.value || (filme.watched_at ? 'watched' : ''))}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <label
              className={`format-check ${filme.watched_at ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setField('watched_at', filme.watched_at ? '' : 'watched')}
            >
              ✓ Assistido
            </label>
          </div>

          {/* Coleções */}
          {collections.length > 0 && (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Coleções</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {collections.map(c => {
                  const checked = selectedCollections.includes(c.id)
                  return (
                    <label key={c.id} className={`format-check ${checked ? 'active' : ''}`}
                      style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                      onClick={() => setSelectedCollections(prev =>
                        checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )}>
                      <span>{c.name}</span>
                      {checked && <span style={{ fontSize: 10, opacity: 0.7 }}>✓</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}
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
                  {searchResults.map(r => {
                    const isTmdb   = r._source === 'tmdb'
                    const isTv     = isTmdb && r._tmdbType === 'tv'
                    const poster   = isTmdb
                      ? (r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null)
                      : (r.Poster && r.Poster !== 'N/A' ? r.Poster : null)
                    const title    = isTmdb ? (isTv ? r.name    : r.title)          : r.Title
                    const origTitle = isTmdb ? (isTv ? r.original_name : r.original_title) : null
                    const year     = isTmdb ? (isTv ? r.first_air_date?.slice(0, 4) : r.release_date?.slice(0, 4)) : r.Year
                    const rating   = isTmdb
                      ? (r.vote_average ? `★ ${Number(r.vote_average).toFixed(1)}` : null)
                      : (r.imdbRating && r.imdbRating !== 'N/A' ? `★ ${r.imdbRating} IMDb` : null)
                    const typeLabel = isTmdb ? (isTv ? 'Série' : 'Filme') : (r.Type === 'movie' ? 'Filme' : r.Type === 'series' ? 'Série' : r.Type)
                    const dupFound = !isEditing && findDuplicate(r)
                    return (
                      <div key={isTmdb ? `${r._tmdbType}-${r.id}` : r.imdbID} className="search-result-item"
                        onClick={() => !searching && selectResult(r)}
                        style={{ opacity: searching ? 0.5 : 1, cursor: searching ? 'wait' : 'pointer', position: 'relative', borderColor: dupFound ? 'rgba(234,179,8,0.5)' : undefined }}>
                        {poster
                          ? <img src={poster} alt={title} />
                          : <div className="result-no-poster">?</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                            {isTmdb
                              ? <span style={{ fontSize: 10, background: 'rgba(1,180,228,0.15)', color: '#01b4e4', padding: '2px 6px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>TMDB</span>
                              : r._exact && <span style={{ fontSize: 10, background: 'rgba(74,158,255,0.15)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 3, fontWeight: 600, flexShrink: 0 }}>OMDb</span>
                            }
                          </div>
                          {origTitle && origTitle !== title && (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{origTitle}</div>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                            {year} · {typeLabel}{rating && <> · {rating}</>}
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
              {!searching && searchResults.length === 0 && searchQuery && (
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
                    </p>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 11, flexShrink: 0 }}
                    onClick={() => setDuplicateWarning(null)}
                  >
                    Fechar
                  </button>
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
            <button className="btn" onClick={handleCancel}>Cancelar</button>
          </div>
        </div>
      </div>
      </>}
    </div>
  )
}

// ─── AnimeSearchSection ───────────────────────────────────────────────────────

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

function AnimeSearchSection({ settings, showToast, animeList = [], setAnimeList, onCancel }) {
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

// ─── Modal de adicionar anime ─────────────────────────────────────────────────

function AnimeAddModal({ anime, onSave, onClose }) {
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
