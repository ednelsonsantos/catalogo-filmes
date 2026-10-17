import React, { useState, useRef, useCallback, useEffect } from 'react'
import { SERIES_CATEGORIES } from '../constants.js'
import EpisodesPanel from '../components/EpisodesPanel.jsx'
import AnimeSearchSection from '../components/add/AnimeSearchSection.jsx'
import FormFields from '../components/add/FormFields.jsx'
import CoverPicker from '../components/add/CoverPicker.jsx'
import ProgressSelector from '../components/add/ProgressSelector.jsx'
import CollectionsPicker from '../components/add/CollectionsPicker.jsx'
import TagsPicker from '../components/add/TagsPicker.jsx'
import TitleSearchPanel from '../components/add/TitleSearchPanel.jsx'
import { omdbToFilme, tmdbToFilme, tmdbToFilmeTv } from '../utils/titleMappers.js'
import { extractTitleFromImage, fileToBase64 } from '../utils/ocr.js'
import './AddDiscPage.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ALL_FORMATS = ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'Digital']

const ALL_CATEGORIES = ['', 'Filme', 'Série', 'Mini-série', 'Documentário', 'Animação', 'Anime', 'Show/Stand-up', 'Musical', 'Esporte', 'Streaming', 'Outro']

const EMPTY = {
  title: '', original_title: '', year: '', format: '', formats: '',
  watched_at: '', watching: false, genre: '', director: '', cast: '', runtime: '',
  imdb_rating: '', imdb_id: '', synopsis: '', poster_url: '', language: '', country: '', cover_path: null,
  category: '', tmdb_id: '', tmdb_media_type: '', my_rating: '',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AddDiscPage({ settings, editFilme, filmes = [], collections = [], tags = [], onCollectionsChange, onTagsChange, onSaved, showToast, animeList = [], setAnimeList }) {
  const [tab, setTab] = useState('titulo')
  // abre na busca: é o caminho mais comum hoje (streaming/digital); a foto da capa é pra disco físico
  const [mode, setMode] = useState('search')
  const [filme, setFilme] = useState(editFilme ? { ...editFilme } : { ...EMPTY })
  const [selectedCollections, setSelectedCollections] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
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
  // true quando o checkbox "Assistido" foi marcado (de desmarcado pra marcado) nesta sessão de edição —
  // dispara a sincronização de episódios no save, independente do estado com que a edição começou
  const [watchedJustChecked, setWatchedJustChecked] = useState(false)
  const lastWatchedDateRef = useRef(null)
  // Seletor rápido "estou na temporada X, episódio Y", usado só ao adicionar (sem id ainda pro painel completo)
  const [tvSeasonsMeta, setTvSeasonsMeta] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(1)
  const [currentEpisode, setCurrentEpisode] = useState(1)
  const [progressTouched, setProgressTouched] = useState(false)
  const [episodesVersion, setEpisodesVersion] = useState(0)
  const isEditing = !!editFilme

  useEffect(() => {
    if (editFilme?.cover_path) {
      window.api.readCover(editFilme.cover_path).then(data => { if (data) setCoverPreview(data) })
    } else if (editFilme?.poster_url && editFilme.poster_url !== 'N/A') {
      setCoverPreview(editFilme.poster_url)
    }
    if (editFilme?.id) {
      window.api.colecoesGetByFilme(editFilme.id).then(ids => setSelectedCollections(ids))
      window.api.tagsGetByFilme(editFilme.id).then(ids => setSelectedTags(ids))
    }
  }, [editFilme])

  // Busca as temporadas (só número + qtd de episódios) pro seletor rápido "estou na temporada X, ep Y"
  useEffect(() => {
    if (!filme.tmdb_id || filme.tmdb_media_type !== 'tv' || !SERIES_CATEGORIES.includes(filme.category)) { setTvSeasonsMeta(null); return }
    let cancelled = false
    window.api.tmdbTvDetails({ id: Number(filme.tmdb_id) })
      .then(data => {
        if (cancelled || data.success === false) return
        setTvSeasonsMeta((data.seasons || []).filter(s => s.season_number >= 1))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [filme.tmdb_id, filme.category])

  // Ao editar um título "Assistindo", sugere o próximo episódio não visto em vez de sempre T1E1
  // Também roda de novo quando o painel de episódios muda a contagem, pra o seletor acompanhar
  useEffect(() => {
    if (!isEditing || !filme.watching || !filme.tmdb_id || filme.tmdb_media_type !== 'tv' || !SERIES_CATEGORIES.includes(filme.category)) return
    let cancelled = false
    window.api.episodesGetNextUp({ filmeId: filme.id, tmdbId: Number(filme.tmdb_id) })
      .then(res => {
        if (cancelled || !res || res === 'caught_up') return
        setCurrentSeason(res.season)
        setCurrentEpisode(res.episode)
        // o painel já gravou no banco; salvar o formulário não deve reaplicar um valor antigo do seletor
        setProgressTouched(false)
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, filme.id, filme.tmdb_id, filme.watching, episodesVersion])

  const setField = useCallback((key, value) => setFilme(f => ({ ...f, [key]: value })), [])

  const toggleWatched = useCallback(() => {
    setFilme(f => {
      const turningOn = !f.watched_at
      if (turningOn) {
        setWatchedJustChecked(true)
        return { ...f, watched_at: lastWatchedDateRef.current || 'watched', watching: false }
      }
      // guarda a data antes de limpar, pra restaurar se marcar de novo nesta sessão
      if (f.watched_at && f.watched_at !== 'watched') lastWatchedDateRef.current = f.watched_at
      setWatchedJustChecked(false)
      return { ...f, watched_at: '' }
    })
  }, [])

  const handleCancel = useCallback(() => {
    setTab('titulo')
    setMode('search')
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
      const formats = filme.formats || filme.format || ''
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
    if (!filme.category) { showToast('Selecione uma categoria.', 'error'); return }
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

      // Sincroniza episódios pra séries/animes com TMDB
      if (filme.tmdb_id && filme.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(filme.category)) {
        const tmdbId = Number(filme.tmdb_id)
        try {
          if (watchedJustChecked && filme.watched_at) {
            // Marcou "Assistido" nesta sessão: marca todos os episódios já lançados
            await window.api.episodesRefresh({ filmeId: saved.id, tmdbId, markAllWatched: true })
          } else if (filme.watching && progressTouched) {
            // Informou "estou na temporada X, ep Y" (adicionando ou editando): marca até ali
            await window.api.episodesMarkProgress({ filmeId: saved.id, tmdbId, season: currentSeason, episode: currentEpisode })
          } else if (!isEditing) {
            // Título novo: já popula quantos episódios existem, sem marcar nada
            await window.api.episodesRefresh({ filmeId: saved.id, tmdbId, markAllWatched: false })
          }
        } catch (e) { console.error('Erro ao sincronizar episódios:', e) }
      }

      showToast(isEditing ? 'Atualizado!' : `"${filme.title}" adicionado!`, 'success')
      onSaved(saved.id, selectedCollections, selectedTags)
    } catch (e) {
      console.error(e); showToast('Erro ao salvar.', 'error')
    } finally { setSaving(false) }
  }, [filme, coverFile, isEditing, editFilme, onSaved, showToast, selectedCollections, selectedTags, watchedJustChecked, progressTouched, currentSeason, currentEpisode])

  return (
    <div className="page add-page">
      <h1 className="page-title">{isEditing ? `Editar: ${editFilme.title}` : 'Adicionar'}</h1>

      {/* Abas principais */}
      {!isEditing && (
        <div className="mode-tabs" style={{ marginBottom: 16 }}>
          <button className={`mode-tab ${tab === 'titulo' ? 'active' : ''}`} onClick={() => setTab('titulo')}>
            🎬 Título
          </button>
          <button className={`mode-tab ${tab === 'anime' ? 'active' : ''}`} onClick={() => setTab('anime')}>
            🎌 Anime (MyAnimeList)
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
            { id: 'search', label: '🔍 Buscar por título' },
            { id: 'photo',  label: '📷 Foto da capa' },
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
          <CoverPicker
            coverPreview={coverPreview} onImageFile={handleImageFile}
            ocrStatus={ocrStatus} ocrMessage={ocrMessage} ocrProgress={ocrProgress}
          />

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
                      setField('format', next[0] || '')
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
              onChange={e => {
                if (e.target.value && !filme.watched_at) setWatchedJustChecked(true)
                setField('watched_at', e.target.value || (filme.watched_at ? 'watched' : ''))
              }}
              style={{ padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontSize: 13, outline: 'none', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label
              className={`format-check ${filme.watched_at ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={toggleWatched}
            >
              ✓ Assistido
            </label>
            {SERIES_CATEGORIES.includes(filme.category) && (
              <label
                className={`format-check ${filme.watching ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setFilme(f => ({
                  ...f,
                  watching: !f.watching,
                  // marcar como assistindo agora desfaz o "assistido"
                  watched_at: f.watching ? f.watched_at : '',
                }))}
              >
                ▶ Assistindo
              </label>
            )}
          </div>

          {!!filme.watching && filme.tmdb_id && filme.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(filme.category) && tvSeasonsMeta?.length > 0 && (
            <ProgressSelector
              seasons={tvSeasonsMeta} season={currentSeason} episode={currentEpisode}
              onChange={(s, e) => { setCurrentSeason(s); setCurrentEpisode(e); setProgressTouched(true) }}
              showHint={isEditing && progressTouched}
            />
          )}

          <CollectionsPicker
            collections={collections} selected={selectedCollections} setSelected={setSelectedCollections}
            onCollectionsChange={onCollectionsChange} showToast={showToast}
          />
          
          <TagsPicker
            tags={tags} selected={selectedTags} setSelected={setSelectedTags}
            onTagsChange={onTagsChange} showToast={showToast}
          />
        </div>

        {/* Direita: modo ativo */}
        <div className="add-right">
          {mode === 'photo' && !isEditing && (
            <div className="photo-instructions card">
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Como funciona</h3>
              <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text2)', lineHeight: 2 }}>
                <li>Clique na capa ou arraste uma foto</li>
                <li>OCR local lê o texto da imagem — sem internet</li>
                <li>O título lido é buscado na TMDB/OMDb para preencher os detalhes</li>
                <li>Revise e salve</li>
              </ol>
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--green)', lineHeight: 1.5 }}>
                  ✓ A leitura da capa roda no seu computador, sem conta e sem internet.
                </p>
              </div>
              {filme.title && <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}><FormFields filme={filme} setField={setField} /></div>}
            </div>
          )}

          {mode === 'search' && !isEditing && (
            <TitleSearchPanel
              query={searchQuery} setQuery={setSearchQuery}
              year={searchYear} setYear={setSearchYear}
              onSearch={handleSearch} searching={searching} results={searchResults}
              findDuplicate={findDuplicate} onSelect={selectResult}
              duplicateWarning={duplicateWarning} onDismissDuplicate={() => setDuplicateWarning(null)}
            >
              {filme.title && <div style={{ marginTop: 16 }}><FormFields filme={filme} setField={setField} /></div>}
            </TitleSearchPanel>
          )}

          {(mode === 'manual' || isEditing) && (
            <FormFields filme={filme} setField={setField} />
          )}

          {isEditing && filme.tmdb_id && filme.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(filme.category) && (
            <EpisodesPanel
              filme={filme}
              showToast={showToast}
              onUpdated={(updated) => {
                setFilme(f => ({
                  ...f,
                  episodes_aired: updated.episodes_aired,
                  next_episode_air_date: updated.next_episode_air_date,
                  last_episode_check: updated.last_episode_check,
                  episodes_watched_count: updated.episodes_watched_count,
                }))
                setEpisodesVersion(v => v + 1)
              }}
            />
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
