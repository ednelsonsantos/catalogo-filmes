import React, { useEffect, useMemo, useState } from 'react'
import { computeStats } from '../utils/stats.js'
import './StatsPage.css'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`

function StatCard({ label, value, hint, testId }) {
  return (
    <div className="stat-card" data-testid={testId}>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  )
}

function BarList({ title, items, empty = 'Sem dados ainda.', testId }) {
  const max = Math.max(1, ...items.map(i => i.value))
  return (
    <div className="card stats-section" data-testid={testId}>
      <h2>{title}</h2>
      {items.length === 0
        ? <p className="stats-empty">{empty}</p>
        : items.map(i => (
            <div key={i.label} className="bar-row">
              <span className="bar-label" title={i.label}>{i.label}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} /></div>
              <span className="bar-value">{i.value}</span>
            </div>
          ))}
    </div>
  )
}

export default function StatsPage({ filmes, animeList }) {
  const [episodesByMonth, setEpisodesByMonth] = useState([])
  useEffect(() => { window.api.statsEpisodesByMonth().then(setEpisodesByMonth).catch(() => {}) }, [filmes])

  const s = useMemo(() => computeStats(filmes, animeList, episodesByMonth), [filmes, animeList, episodesByMonth])
  const t = s.totals
  const activityMax = Math.max(1, ...s.activity.map(a => a.titles + a.episodes))

  return (
    <div className="page stats-page">
      <h1 className="page-title">Estatísticas</h1>

      <div className="stat-cards">
        <StatCard testId="stat-titles" label="títulos na coleção" value={t.titles} />
        <StatCard testId="stat-watched" label="assistidos" value={`${t.watched} (${t.watchedPct}%)`} hint={t.watching ? `${t.watching} em andamento` : null} />
        <StatCard testId="stat-hours" label="horas assistidas" value={t.hours}
          hint={t.unknownRuntime ? `sem duração cadastrada em ${t.unknownRuntime} título(s); animes não entram` : 'filmes + episódios de séries; animes não entram'} />
        <StatCard testId="stat-episodes" label="episódios vistos" value={t.episodes} hint={s.seriesCompleted ? `${s.seriesCompleted} série(s) em dia` : null} />
        <StatCard testId="stat-rating" label="minha nota média" value={t.avgRating ?? '—'} hint={t.rated ? `${t.rated} título(s) com nota` : 'nenhum título com nota'} />
      </div>

      <div className="stats-grid">
        <BarList testId="stats-genres" title="Gêneros mais frequentes" items={s.genres} />
        <BarList testId="stats-categories" title="Por categoria" items={s.categories} />
        <BarList testId="stats-formats" title="Por formato (o que você tem)" items={s.formats} />
        <BarList testId="stats-decades" title="Por década de lançamento" items={s.decades} />
        <BarList testId="stats-ratings" title="Minhas notas" items={s.ratingDist.filter(r => r.value > 0)} empty="Dê notas aos títulos no formulário de edição pra ver a distribuição." />

        <div className="card stats-section" data-testid="stats-series">
          <h2>Séries em andamento</h2>
          {s.seriesInProgress.length === 0
            ? <p className="stats-empty">Nenhuma série com episódios pela metade.</p>
            : s.seriesInProgress.slice(0, 10).map(x => (
                <div key={x.id} className="bar-row">
                  <span className="bar-label" title={x.title}>{x.title}</span>
                  <div className="bar-track"><div className="bar-fill bar-fill-progress" style={{ width: `${x.pct}%` }} /></div>
                  <span className="bar-value">{x.watched}/{x.aired}</span>
                </div>
              ))}
        </div>

        {s.anime.total > 0 && (
          <div className="card stats-section" data-testid="stats-anime">
            <h2>Animes (MyAnimeList)</h2>
            <p className="stats-sub">{s.anime.total} na lista · {s.anime.episodes} episódios vistos{s.anime.avgScore != null ? ` · nota média ${s.anime.avgScore}` : ''}</p>
            {s.anime.byStatus.map(i => (
              <div key={i.label} className="bar-row">
                <span className="bar-label">{i.label}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(i.value / s.anime.total) * 100}%` }} /></div>
                <span className="bar-value">{i.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stats-section" data-testid="stats-activity">
        <h2>Atividade nos últimos 12 meses</h2>
        {s.hasActivity ? (
          <>
            <div className="activity-chart">
              {s.activity.map(a => (
                <div key={a.month} className="activity-col" title={`${monthLabel(a.month)}: ${a.titles} título(s), ${a.episodes} episódio(s)`}>
                  <div className="activity-bars">
                    <div className="activity-bar activity-episodes" style={{ height: `${(a.episodes / activityMax) * 100}%` }} />
                    <div className="activity-bar activity-titles" style={{ height: `${(a.titles / activityMax) * 100}%` }} />
                  </div>
                  <span className="activity-label">{monthLabel(a.month)}</span>
                </div>
              ))}
            </div>
            <p className="stats-sub">
              <span className="legend legend-titles" /> títulos marcados como assistidos com data
              <span className="legend legend-episodes" style={{ marginLeft: 12 }} /> episódios registrados
            </p>
          </>
        ) : <p className="stats-empty">Nenhuma atividade com data nos últimos 12 meses.</p>}
        <p className="stats-sub">
          Episódios marcados em lote (ex: "Marcar tudo assistido") contam no mês em que foram marcados.
          {s.undatedWatched > 0 && ` ${s.undatedWatched} título(s) assistido(s) sem data não aparecem aqui — informe a data em "Assistido em" no formulário.`}
        </p>
      </div>
    </div>
  )
}
