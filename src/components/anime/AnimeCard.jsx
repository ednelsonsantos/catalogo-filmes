import React, { useState } from 'react'
import { statusColor, statusLabel, malScore, useMalPoster } from '../../utils/mal.js'
import './anime.css'

function Poster({ node }) {
  const src = useMalPoster(node)
  const [error, setError] = useState(false)
  return src && !error
    ? <img className="anime-poster" src={src} alt={node.title} onError={() => setError(true)} />
    : <div className="anime-poster-empty">🎌</div>
}

const missingEps = (node, listStatus) => (node.num_episodes > 0 ? node.num_episodes - (listStatus?.num_episodes_watched || 0) : 0)
const myScore = (listStatus) => (listStatus?.score > 0 ? listStatus.score : null)

// Grade
export function AnimeCard({ node, listStatus, onClick }) {
  const missing = missingEps(node, listStatus)
  const mine = myScore(listStatus)
  const score = malScore(node)
  return (
    <div className="anime-card" data-testid="anime-card" onClick={onClick}>
      <div className="anime-card-cover">
        <Poster node={node} />
        {missing > 0 && <div className="anime-card-missing">faltam {missing}</div>}
        <div className="anime-card-status" style={{ background: `${statusColor(listStatus?.status)}ee` }}>{statusLabel(listStatus?.status)}</div>
        {mine && <div className="anime-card-myscore">★ {mine}</div>}
      </div>
      <div className="anime-card-info">
        <p className="anime-card-title" data-testid="anime-title">{node.title}</p>
        <div className="anime-card-meta">
          {node.num_episodes > 0
            ? <span>{node.num_episodes} eps</span>
            : listStatus?.num_episodes_watched > 0 && <span>{listStatus.num_episodes_watched} vistos</span>}
          {score && <span>⭐ {score}</span>}
        </div>
      </div>
    </div>
  )
}

// Lista
export function AnimeListRow({ node, listStatus, onClick }) {
  const missing = missingEps(node, listStatus)
  const mine = myScore(listStatus)
  const score = malScore(node)
  const color = statusColor(listStatus?.status)
  const epsLabel = node.num_episodes > 0
    ? `${node.num_episodes} ep`
    : listStatus?.num_episodes_watched > 0 ? `${listStatus.num_episodes_watched} vistos` : null
  return (
    <div className="anime-row" data-testid="anime-row" onClick={onClick}>
      <div className="anime-row-thumb"><Poster node={node} /></div>
      <div className="anime-row-titles">
        <p className="anime-row-title" data-testid="anime-title">{node.title}</p>
        {node.alternative_titles?.en && node.alternative_titles.en !== node.title && (
          <p className="anime-row-alt">{node.alternative_titles.en}</p>
        )}
      </div>
      {epsLabel && <span className="anime-row-eps">{epsLabel}</span>}
      {missing > 0 && <span className="anime-row-missing">faltam {missing}</span>}
      {score && <span className="anime-row-score anime-row-score--mal">⭐ {score}</span>}
      {mine && <span className="anime-row-score anime-row-score--mine">★ {mine}</span>}
      <span className="anime-status-pill" style={{ background: `${color}22`, color }}>{statusLabel(listStatus?.status)}</span>
    </div>
  )
}
