import React, { useState } from 'react'

export default function SettingsPage({ settings, onSave }) {
  // Nunca pré-preenche com o placeholder mascarado — campo vazio = manter chave atual
  const [form, setForm] = useState({ omdbApiKey: '', tmdbApiKey: '' })
  const [showKey, setShowKey] = useState(false)
  const [showTmdbKey, setShowTmdbKey] = useState(false)

  const openExternal = (url) => {
    if (window.api?.openExternal) window.api.openExternal(url)
  }

  return (
    <div className="page" style={{ maxWidth: 620 }}>
      <h1 className="page-title">Configurações</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* OCR info */}
        <div className="card" style={{ border: '1px solid rgba(76,175,125,0.3)', background: 'rgba(76,175,125,0.05)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>✓</span>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 6 }}>
                OCR local ativo — nenhuma configuração necessária
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                O reconhecimento de texto das capas usa o <strong style={{ color: 'var(--text)' }}>Tesseract.js</strong>,
                que roda 100% no seu computador. Sem conta, sem chave, sem internet.
              </p>
            </div>
          </div>
        </div>

        {/* OMDb */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>OMDb API</h2>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Busca sinopse, elenco, nota IMDb, poster, duração...
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openExternal('https://www.omdbapi.com/apikey.aspx')}
              style={{ fontSize: 12, color: 'var(--blue)', whiteSpace: 'nowrap' }}
            >
              Obter chave grátis ↗
            </button>
          </div>
          <div className="field">
            <label>Chave de API</label>
            {settings.omdbConfigured && (
              <p style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Chave configurada</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={form.omdbApiKey}
                onChange={e => setForm(f => ({ ...f, omdbApiKey: e.target.value }))}
                placeholder={settings.omdbConfigured ? 'Deixe em branco para manter a atual' : 'xxxxxxxx'}
                style={{ flex: 1 }}
              />
              {form.omdbApiKey && (
                <button className="btn btn-sm" onClick={() => setShowKey(v => !v)}>
                  {showKey ? 'Ocultar' : 'Mostrar'}
                </button>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.15)', borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              Plano gratuito: <strong style={{ color: 'var(--text)' }}>1.000 buscas/dia</strong> — mais que suficiente para uso pessoal.
              A chave fica salva localmente no seu computador.
            </p>
          </div>
        </div>

        {/* TMDB */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600 }}>TMDB API</h2>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                Títulos em português, sinopse traduzida, elenco e pôster de alta qualidade.
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openExternal('https://www.themoviedb.org/settings/api')}
              style={{ fontSize: 12, color: 'var(--blue)', whiteSpace: 'nowrap' }}
            >
              Obter chave grátis ↗
            </button>
          </div>
          <div className="field">
            <label>Chave de API (v3)</label>
            {settings.tmdbConfigured && (
              <p style={{ fontSize: 11, color: 'var(--green)', marginBottom: 4 }}>✓ Chave configurada</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showTmdbKey ? 'text' : 'password'}
                value={form.tmdbApiKey}
                onChange={e => setForm(f => ({ ...f, tmdbApiKey: e.target.value }))}
                placeholder={settings.tmdbConfigured ? 'Deixe em branco para manter a atual' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                style={{ flex: 1 }}
              />
              {form.tmdbApiKey && (
                <button className="btn btn-sm" onClick={() => setShowTmdbKey(v => !v)}>
                  {showTmdbKey ? 'Ocultar' : 'Mostrar'}
                </button>
              )}
            </div>
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(1,180,228,0.06)', border: '1px solid rgba(1,180,228,0.2)', borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
              Completamente gratuito e sem limite diário. Quando configurado junto com OMDb,
              a busca usa <strong style={{ color: 'var(--text)' }}>ambas as APIs em paralelo</strong> e
              combina os resultados — títulos em PT‑BR do TMDB e notas IMDb do OMDb.
            </p>
          </div>
        </div>

        {/* Passos */}
        <div className="card" style={{ background: 'transparent' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Como obter a chave OMDb</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Acesse omdbapi.com/apikey.aspx e escolha o plano Free',
              'Preencha seu e-mail e clique em "Submit"',
              'Confirme o e-mail recebido — a chave vem junto',
              'Cole a chave no campo acima e clique em Salvar',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: 'fit-content' }} onClick={() => onSave(form)}>
          Salvar configurações
        </button>
      </div>
    </div>
  )
}
