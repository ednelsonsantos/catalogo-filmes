import React from 'react'

export default function FormFields({ filme, setField }) {
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
        <div className="field">
          <label>Minha nota</label>
          <input
            type="number" min="0" max="10" step="1"
            value={filme.my_rating ?? ''}
            onChange={e => setField('my_rating', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0-10"
          />
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
