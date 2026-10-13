import React, { useState, useMemo, useRef, useEffect } from 'react'
import { parseImport, findExisting, FORMAT_LABELS } from '../utils/importList.js'
import { tmdbToFilme, tmdbToFilmeTv } from '../utils/titleMappers.js'

const FORMATS = ['', 'DVD', 'Blu-ray', '4K UHD', 'VHS', 'Digital']
const PREVIEW_ROWS = 50

// Acha o título na TMDB: pelo IMDb quando a lista traz, senão pela busca (título + ano)
async function lookupTmdb(item) {
  if (item.imdb_id) {
    const hit = await window.api.tmdbFindByImdb(item.imdb_id)
    if (hit) return hit
  }
  const searchMovie = () => window.api.tmdbSearch({ query: item.title, year: item.year || undefined })
  const searchTv = () => window.api.tmdbSearchTv({ query: item.title, year: item.year || undefined })
  const order = item.kind === 'tv' ? [['tv', searchTv], ['movie', searchMovie]] : [['movie', searchMovie], ['tv', searchTv]]
  for (const [type, search] of order) {
    const first = (await search())?.results?.[0]
    if (first) return { id: first.id, type }
  }
  return null
}

async function buildFilme(item, { enrich, defaultFormat }) {
  const formats = item.formats || defaultFormat
  let base = {
    title: item.title, year: item.year, formats, format: formats.split(',')[0]?.trim() || '',
    category: item.kind === 'tv' ? 'Série' : 'Filme',
  }
  let matched = false
  if (enrich) {
    const hit = await lookupTmdb(item).catch(() => null)
    if (hit) {
      const data = hit.type === 'tv'
        ? await window.api.tmdbTvDetails({ id: hit.id })
        : await window.api.tmdbDetails({ id: hit.id })
      if (data && data.success !== false) {
        base = hit.type === 'tv' ? tmdbToFilmeTv(data, formats) : tmdbToFilme(data, formats)
        matched = true
      }
    }
  }
  return {
    filme: {
      ...base,
      imdb_id: base.imdb_id || item.imdb_id || '',
      watched_at: item.watched_at || '',
      my_rating: item.my_rating,
    },
    matched,
  }
}

export default function ImportModal({ filmes, tmdbConfigured, onClose, onImported, showToast }) {
  const [file, setFile] = useState(null) // { fileName, format, items }
  const [enrich, setEnrich] = useState(!!tmdbConfigured)
  const [defaultFormat, setDefaultFormat] = useState('')
  const [progress, setProgress] = useState(null) // { done, total }
  const [result, setResult] = useState(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !progress) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, progress])

  const rows = useMemo(() => (file?.items || []).map(it => ({ ...it, existing: findExisting(it, filmes) })), [file, filmes])
  const toImport = rows.filter(r => !r.existing)

  const pickFile = async () => {
    try {
      const res = await window.api.importReadFile()
      if (res.canceled) return
      const parsed = parseImport(res.rows, res.fileName)
      if (!parsed.format) { showToast('Não reconheci o arquivo: falta uma coluna de título (ex: "Título", "Title", "Name").', 'error'); return }
      if (!parsed.items.length) { showToast('O arquivo não tem nenhum título.', 'error'); return }
      setFile({ fileName: res.fileName, ...parsed })
      setResult(null)
    } catch (e) {
      showToast(e.message || 'Erro ao ler o arquivo.', 'error')
    }
  }

  const runImport = async () => {
    cancelRef.current = false
    const summary = { imported: 0, matched: 0, unmatched: [], failed: [] }
    setProgress({ done: 0, total: toImport.length })
    for (let i = 0; i < toImport.length; i++) {
      if (cancelRef.current) break
      const item = toImport[i]
      try {
        const { filme, matched } = await buildFilme(item, { enrich, defaultFormat })
        const saved = await window.api.insert(filme)
        // série assistida vinda da TMDB: já marca os episódios lançados, igual ao botão "Assistido"
        if (matched && saved.tmdb_media_type === 'tv' && saved.watched_at) {
          await window.api.episodesRefresh({ filmeId: saved.id, tmdbId: Number(saved.tmdb_id), markAllWatched: true }).catch(() => {})
        }
        summary.imported++
        if (matched) summary.matched++
        else if (enrich) summary.unmatched.push(item.title)
      } catch {
        summary.failed.push(item.title)
      }
      setProgress({ done: i + 1, total: toImport.length })
    }
    summary.canceled = cancelRef.current
    setProgress(null)
    setResult(summary)
    onImported()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !progress && onClose()}>
      <div className="modal import-modal" role="dialog" aria-label="Importar lista">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Importar lista</h2>
          {!progress && <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>}
        </div>

        {!file && !result && (
          <>
            <p className="import-text">
              Aceita a exportação do <strong>Letterboxd</strong> (watched, diary, ratings, watchlist), do <strong>IMDb</strong> (ratings, watchlist),
              o CSV/Excel exportado por este app ou qualquer planilha com uma coluna <strong>Título</strong> (ou Title/Name) e, se quiser, Ano, Nota, Formato e Assistido.
            </p>
            <button className="btn btn-primary" onClick={pickFile}>📂 Escolher arquivo (.csv, .xlsx)</button>
          </>
        )}

        {file && !result && (
          <>
            <p className="import-text" data-testid="import-summary">
              <strong>{file.fileName}</strong> · {FORMAT_LABELS[file.format]} · {rows.length} título(s):{' '}
              <strong>{toImport.length} novo(s)</strong>{rows.length - toImport.length > 0 && `, ${rows.length - toImport.length} já na coleção (serão pulados)`}
            </p>

            <div className="import-options">
              <label className="import-check">
                <input type="checkbox" checked={enrich} disabled={!tmdbConfigured || !!progress} onChange={e => setEnrich(e.target.checked)} />
                Completar com dados da TMDB (pôster, gênero, elenco...){!tmdbConfigured && ' — configure a chave da TMDB'}
              </label>
              <label className="import-check">
                Formato pra quem não tiver:
                <select value={defaultFormat} disabled={!!progress} onChange={e => setDefaultFormat(e.target.value)}>
                  {FORMATS.map(f => <option key={f} value={f}>{f || 'nenhum'}</option>)}
                </select>
              </label>
            </div>

            <div className="import-table-wrap">
              <table className="import-table">
                <thead><tr><th>Título</th><th>Ano</th><th>Nota</th><th>Assistido</th><th></th></tr></thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                    <tr key={i} className={r.existing ? 'import-row-existing' : ''}>
                      <td>{r.title}</td>
                      <td>{r.year || '—'}</td>
                      <td>{r.my_rating ?? '—'}</td>
                      <td>{r.watched_at ? (r.watched_at === 'watched' ? '✓' : r.watched_at) : '—'}</td>
                      <td>{r.existing ? 'já na coleção' : 'novo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > PREVIEW_ROWS && <p className="import-text" style={{ marginTop: 6 }}>… e mais {rows.length - PREVIEW_ROWS}.</p>}
            </div>

            {progress ? (
              <div className="import-progress">
                <div className="import-bar"><div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
                <span>Importando {progress.done}/{progress.total}…</span>
                <button className="btn btn-sm" onClick={() => { cancelRef.current = true }}>Parar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                <button className="btn" onClick={pickFile}>Outro arquivo</button>
                <button className="btn btn-primary" onClick={runImport} disabled={toImport.length === 0}>
                  Importar {toImport.length} título(s)
                </button>
              </div>
            )}
          </>
        )}

        {result && (
          <div data-testid="import-result">
            <p className="import-text">
              ✓ <strong>{result.imported}</strong> título(s) importado(s){result.canceled && ' (parado antes do fim)'}.
              {enrich && ` ${result.matched} encontrado(s) na TMDB.`}
            </p>
            {result.unmatched.length > 0 && (
              <p className="import-text">Sem correspondência na TMDB (importados só com o nome): {result.unmatched.slice(0, 10).join(', ')}{result.unmatched.length > 10 && ` e mais ${result.unmatched.length - 10}`}.</p>
            )}
            {result.failed.length > 0 && (
              <p className="import-text" style={{ color: 'var(--red)' }}>Falharam: {result.failed.join(', ')}.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-primary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
