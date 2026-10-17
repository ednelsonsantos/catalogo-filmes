import React, { useState, useEffect, useMemo, useCallback } from 'react'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { SERIES_CATEGORIES } from '../constants.js'

function updateStatusText(s) {
  if (!s.enabled) return 'A atualização automática só funciona no app instalado.'
  switch (s.state) {
    case 'checking':    return 'Procurando atualizações...'
    case 'up-to-date':  return 'Você está na versão mais recente.'
    case 'downloading': return `Baixando a versão ${s.version}... ${s.percent || 0}%`
    case 'ready':       return `Versão ${s.version} baixada — reinicie para instalar (ou ela é instalada ao fechar o app).`
    case 'error':       return `Não foi possível verificar: ${s.message}`
    default:            return 'O app procura atualizações sozinho alguns segundos depois de abrir.'
  }
}

const formatDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  : null

const sectionTitle = { fontSize: 15, fontWeight: 600, marginBottom: 6 }
const sectionText = { fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }

export default function SettingsPage({ settings, onSave, showToast, appVersion, updateStatus = { enabled: false, state: 'idle' }, onCheckUpdates, filmes = [], onFilmeUpdated, onEdit }) {
  const [form, setForm] = useState({ omdbApiKey: '', tmdbApiKey: '', malClientId: '' })
  const [showKey, setShowKey] = useState(false)
  const [showTmdbKey, setShowTmdbKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [confirmingRestore, setConfirmingRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [prefs, setPrefs] = useState(null)
  const [autoBackup, setAutoBackup] = useState(null)
  const [bulkRefreshing, setBulkRefreshing] = useState(null) // { done, total } ou null
  const [brokenLinks, setBrokenLinks] = useState(null) // [{ id, title }] ou null

  useEffect(() => {
    window.api.prefsGet().then(setPrefs).catch(() => {})
    window.api.backupAutoStatus().then(setAutoBackup).catch(() => {})
  }, [])

  const togglePref = async (key) => {
    const value = !prefs[key]
    // marca na hora; a gravação no processo principal confirma (ou corrige) em seguida
    setPrefs(p => ({ ...p, [key]: value }))
    try { setPrefs(await window.api.prefsSet({ [key]: value })) }
    catch { setPrefs(await window.api.prefsGet()) }
    if (key === 'autoBackup') window.api.backupAutoStatus().then(setAutoBackup).catch(() => {})
  }

  const handleBackup = async () => {
    setBackingUp(true)
    try {
      const res = await window.api.backupCreate()
      if (res.success) showToast?.('Backup criado com sucesso!', 'success')
    } catch (e) {
      showToast?.(e.message || 'Erro ao criar backup.', 'error')
    } finally {
      setBackingUp(false)
    }
  }

  const handleAutoBackupNow = async () => {
    setBackingUp(true)
    try {
      const res = await window.api.backupAutoNow()
      setAutoBackup(res.status)
      if (res.ran) showToast?.('Backup salvo na pasta dos automáticos.', 'success')
      else if (res.reason === 'empty') showToast?.('O catálogo está vazio — nada pra guardar.', 'info')
    } catch (e) {
      showToast?.(e.message || 'Erro ao criar backup.', 'error')
    } finally {
      setBackingUp(false)
    }
  }

  const handleChooseDir = async () => {
    try { setAutoBackup(await window.api.backupChooseDir()) } catch {}
  }

  const handleRestore = async () => {
    setConfirmingRestore(false)
    setRestoring(true)
    try {
      const res = await window.api.backupRestore()
      // com sucesso a janela é recarregada pelo processo principal logo em seguida
      if (res && res.success === false) setRestoring(false) // usuário cancelou o diálogo de arquivo
    } catch (e) {
      showToast?.(e.message || 'Erro ao restaurar backup.', 'error')
      setRestoring(false)
    }
  }

  const trackableFilmes = useMemo(
    () => filmes.filter(f => f.tmdb_id && f.tmdb_media_type === 'tv' && SERIES_CATEGORIES.includes(f.category)),
    [filmes]
  )

  // Os episódios já se atualizam sozinhos 1x por dia; isto força todas as séries agora e lista vínculos quebrados
  const handleBulkRefreshEpisodes = useCallback(async () => {
    const targets = trackableFilmes
    if (targets.length === 0) return
    setBulkRefreshing({ done: 0, total: targets.length })
    setBrokenLinks(null)
    let okCount = 0
    const failed = []
    for (let i = 0; i < targets.length; i++) {
      const f = targets[i]
      try {
        // Marca tudo como visto automaticamente só no catch-up único de título "Assistido" legado
        // (nunca teve nenhum episódio registrado ainda). Se já tem episódios marcados, não mexe —
        // senão uma temporada nova lançada depois seria marcada como vista sem o usuário ter assistido
        const isLegacyWatched = !!f.watched_at && (f.episodes_watched_count || 0) === 0
        const updated = await window.api.episodesRefresh({ filmeId: f.id, tmdbId: f.tmdb_id, markAllWatched: isLegacyWatched })
        onFilmeUpdated?.(updated)
        okCount++
      } catch {
        failed.push({ id: f.id, title: f.title })
      }
      setBulkRefreshing({ done: i + 1, total: targets.length })
    }
    setBulkRefreshing(null)
    setBrokenLinks(failed)
    if (failed.length === 0) showToast?.(`${okCount} séries/animes atualizados!`, 'success')
  }, [trackableFilmes, onFilmeUpdated, showToast])

  const openExternal = (url) => {
    if (window.api?.openExternal) window.api.openExternal(url)
  }

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <h1 className="page-title">Configurações</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Avisos e segundo plano */}
        <div className="card">
          <h2 style={sectionTitle}>Avisos de episódios</h2>
          <p style={sectionText}>
            Com o app aberto, ele confere a cada 30 minutos (e quando você volta pra janela) se saiu episódio de algo que você está assistindo
            ou temporada nova de uma série que já terminou — e avisa uma vez só. Os episódios das séries são atualizados sozinhos uma vez por dia.
          </p>
          {prefs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="pref-check">
                <input type="checkbox" data-testid="pref-close-to-tray" checked={prefs.closeToTray} onChange={() => togglePref('closeToTray')} />
                Ao fechar a janela, continuar rodando na bandeja (perto do relógio) pra seguir avisando
              </label>
              <label className="pref-check" style={{ opacity: prefs.canOpenAtLogin ? 1 : 0.5 }}>
                <input type="checkbox" data-testid="pref-open-at-login" checked={prefs.openAtLogin} disabled={!prefs.canOpenAtLogin} onChange={() => togglePref('openAtLogin')} />
                Iniciar com o Windows, já minimizado na bandeja{!prefs.canOpenAtLogin && ' (só no app instalado)'}
              </label>
            </div>
          )}
        </div>

        {/* Backup */}
        <div className="card">
          <h2 style={sectionTitle}>Backup</h2>
          <p style={sectionText}>
            Tudo fica só no seu computador — sem isso, um disco com defeito leva sua coleção toda junto.
            O backup inclui o banco de dados, capas, chaves de API e cache dos animes num único arquivo .zip.
          </p>

          {prefs && autoBackup && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <label className="pref-check">
                <input type="checkbox" data-testid="pref-auto-backup" checked={prefs.autoBackup} onChange={() => togglePref('autoBackup')} />
                Fazer backup automático toda semana (guarda os 5 últimos)
              </label>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7, paddingLeft: 24 }}>
                <div>
                  Pasta: <code data-testid="auto-backup-dir" style={{ background: 'var(--bg4)', padding: '1px 5px', borderRadius: 4, fontSize: 11, wordBreak: 'break-all' }}>{autoBackup.dir}</code>
                </div>
                <div data-testid="auto-backup-last">
                  {autoBackup.lastAt
                    ? <>Último: <strong style={{ color: 'var(--text)' }}>{formatDate(autoBackup.lastAt)}</strong>{prefs.autoBackup && <> · próximo a partir de {formatDate(autoBackup.nextAt)}</>}</>
                    : 'Nenhum backup automático ainda.'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Dica: escolha uma pasta do OneDrive/Google Drive ou um pendrive pra ter uma cópia fora deste disco.</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm" onClick={handleChooseDir}>Trocar pasta…</button>
                  <button className="btn btn-sm" onClick={() => window.api.backupOpenDir()}>Abrir pasta</button>
                  <button className="btn btn-sm" onClick={handleAutoBackupNow} disabled={backingUp}>Fazer agora</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleBackup} disabled={backingUp}>
              {backingUp ? 'Gerando...' : '💾 Salvar backup em…'}
            </button>
            <button className="btn btn-danger" onClick={() => setConfirmingRestore(true)} disabled={restoring}>
              {restoring ? 'Restaurando...' : '📂 Restaurar backup'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10, lineHeight: 1.6 }}>
            Restaurar <strong style={{ color: 'var(--text)' }}>substitui tudo</strong> que está no app agora pelo conteúdo do arquivo escolhido, e recarrega o app.
          </p>
        </div>

        {/* Dados */}
        {trackableFilmes.length > 0 && (
          <div className="card">
            <h2 style={sectionTitle}>Episódios das séries</h2>
            <p style={sectionText}>
              Já acontece sozinho uma vez por dia. Use para forçar agora todas as séries/animes ligados à TMDB — não marca nada como assistido.
            </p>
            <button className="btn" onClick={handleBulkRefreshEpisodes} disabled={!!bulkRefreshing}>
              {bulkRefreshing ? `Atualizando ${bulkRefreshing.done}/${bulkRefreshing.total}…` : `↻ Atualizar episódios agora (${trackableFilmes.length})`}
            </button>
            {brokenLinks?.length > 0 && (
              <div data-testid="broken-links" style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.6, marginBottom: 8 }}>
                  ⚠ A TMDB não reconhece mais o ID salvo destes títulos (pode ter sido mesclado/removido numa limpeza deles).
                  Edite e busque o título de novo para corrigir o vínculo.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {brokenLinks.map(b => {
                    const full = filmes.find(f => f.id === b.id)
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                        {full && onEdit && <button className="btn btn-sm" onClick={() => onEdit(full)}>Editar</button>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Atualizações */}
        <div className="card">
          <h2 style={sectionTitle}>Atualizações</h2>
          <p style={sectionText}>
            Versão instalada: <strong data-testid="app-version" style={{ color: 'var(--text)' }}>{appVersion}</strong>
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn"
              onClick={onCheckUpdates}
              disabled={!updateStatus.enabled || ['checking', 'downloading', 'ready'].includes(updateStatus.state)}
            >
              ⟳ Verificar atualizações
            </button>
            {updateStatus.state === 'ready' && (
              <button className="btn btn-primary" onClick={() => window.api.updaterInstall()}>Reiniciar e atualizar</button>
            )}
          </div>
          <p data-testid="update-status" style={{ fontSize: 12, color: updateStatus.state === 'error' ? 'var(--red)' : 'var(--text2)', marginTop: 10 }}>
            {updateStatusText(updateStatus)}
          </p>
        </div>

        {/* Chaves de API */}
        <div className="card">
          <h2 style={sectionTitle}>Chaves de API</h2>
          <p style={sectionText}>
            Configuradas uma vez só. As chaves ficam salvas localmente no seu computador.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* TMDB */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>TMDB <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>· principal</span></h3>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Títulos e sinopse em português, pôster, episódios das séries e onde assistir. Gratuita e sem limite diário.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openExternal('https://www.themoviedb.org/settings/api')} style={{ fontSize: 12, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                  Obter chave grátis ↗
                </button>
              </div>
              <div className="field">
                <label>Chave de API (v3)</label>
                {settings.tmdbConfigured && <p style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Chave configurada</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={showTmdbKey ? 'text' : 'password'}
                    value={form.tmdbApiKey}
                    onChange={e => setForm(f => ({ ...f, tmdbApiKey: e.target.value }))}
                    placeholder={settings.tmdbConfigured ? 'Deixe em branco para manter a atual' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                    style={{ flex: 1 }}
                  />
                  {form.tmdbApiKey && (
                    <button className="btn btn-sm" onClick={() => setShowTmdbKey(v => !v)}>{showTmdbKey ? 'Ocultar' : 'Mostrar'}</button>
                  )}
                </div>
              </div>
            </div>

            {/* OMDb */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>OMDb <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>· opcional</span></h3>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Acrescenta a nota do IMDb. Com a TMDB junto, a busca usa as duas e combina os resultados. Plano grátis: 1.000 buscas/dia.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openExternal('https://www.omdbapi.com/apikey.aspx')} style={{ fontSize: 12, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                  Obter chave grátis ↗
                </button>
              </div>
              <div className="field">
                <label>Chave de API</label>
                {settings.omdbConfigured && <p style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Chave configurada</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={form.omdbApiKey}
                    onChange={e => setForm(f => ({ ...f, omdbApiKey: e.target.value }))}
                    placeholder={settings.omdbConfigured ? 'Deixe em branco para manter a atual' : 'xxxxxxxx'}
                    style={{ flex: 1 }}
                  />
                  {form.omdbApiKey && (
                    <button className="btn btn-sm" onClick={() => setShowKey(v => !v)}>{showKey ? 'Ocultar' : 'Mostrar'}</button>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
                Em omdbapi.com/apikey.aspx escolha o plano Free, informe seu e-mail e confirme — a chave vem no e-mail de confirmação.
              </p>
            </div>

            {/* MAL */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>MyAnimeList <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>· opcional</span></h3>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                    Traz sua lista de animes do MAL. Depois de salvar, aparece no menu o item <strong style={{ color: 'var(--text2)' }}>MyAnimeList</strong> pra conectar a conta.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openExternal('https://myanimelist.net/apiconfig')} style={{ fontSize: 12, color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                  Criar aplicativo ↗
                </button>
              </div>
              <div className="field">
                <label>Client ID</label>
                {settings.malConfigured && <p style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Configurado</p>}
                <input
                  type="text"
                  value={form.malClientId}
                  onChange={e => setForm(f => ({ ...f, malClientId: e.target.value }))}
                  placeholder={settings.malConfigured ? 'Deixe em branco para manter' : 'Cole o Client ID aqui'}
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
                No cadastro do aplicativo no MAL, use o tipo <strong style={{ color: 'var(--text2)' }}>other</strong> e{' '}
                <code style={{ background: 'var(--bg4)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>http://localhost:7813</code>
                {' '}como App Redirect URL. Esse tipo não gera Client Secret — só o Client ID é necessário.
              </p>
            </div>

            <button className="btn btn-primary" style={{ width: 'fit-content', transition: 'background 0.2s' }} onClick={handleSave} disabled={saved}>
              {saved ? '✓ Salvo' : 'Salvar chaves'}
            </button>
          </div>
        </div>
      </div>

      {confirmingRestore && (
        <ConfirmModal
          title="Restaurar backup"
          message="Isso vai substituir TUDO que está no app agora (coleção, animes, configurações) pelo conteúdo do arquivo de backup escolhido, e recarregar o app. Essa ação não pode ser desfeita."
          confirmLabel="Restaurar"
          onConfirm={handleRestore}
          onCancel={() => setConfirmingRestore(false)}
        />
      )}
    </div>
  )
}
