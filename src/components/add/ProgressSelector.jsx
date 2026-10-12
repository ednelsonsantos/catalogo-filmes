import React from 'react'

const selectStyle = { padding: '4px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12 }

// "Próximo a assistir: Temporada X / Ep Y" — ao salvar, marca tudo antes e desmarca o que vier depois
export default function ProgressSelector({ seasons, season, episode, onChange, showHint }) {
  const episodeCount = seasons.find(s => s.season_number === season)?.episode_count || 1
  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Próximo a assistir:</span>
      <select value={season} onChange={e => onChange(Number(e.target.value), 1)} style={selectStyle}>
        {seasons.map(s => (
          <option key={s.season_number} value={s.season_number}>Temporada {s.season_number}</option>
        ))}
      </select>
      <select value={episode} onChange={e => onChange(season, Number(e.target.value))} style={selectStyle}>
        {Array.from({ length: episodeCount }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>Ep {n}</option>
        ))}
      </select>
      {showHint && (
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>ao salvar, marca como visto tudo antes deste e desmarca o que vier depois</span>
      )}
    </div>
  )
}
