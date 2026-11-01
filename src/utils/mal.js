import { useState, useEffect } from 'react'

// Status de um anime na lista do MyAnimeList
export const STATUS_LABELS = {
  watching:      'Assistindo',
  completed:     'Completo',
  on_hold:       'Em pausa',
  dropped:       'Abandonado',
  plan_to_watch: 'Planejo assistir',
}

// Em hex (não var): as telas somam transparência na cor (`${cor}22`)
export const STATUS_COLORS = {
  watching:      '#4a9eff',
  completed:     '#4caf7d',
  on_hold:       '#f59e0b',
  dropped:       '#ef4444',
  plan_to_watch: '#8b8b8b',
}
export const statusColor = (status) => STATUS_COLORS[status] || '#8b8b8b'
export const statusLabel = (status) => STATUS_LABELS[status] || status || ''

export const SCORE_LABELS = {
  0: 'Sem nota', 1: '(1) Horrível', 2: '(2) Terrível', 3: '(3) Muito ruim',
  4: '(4) Ruim', 5: '(5) Médio', 6: '(6) Bom', 7: '(7) Muito bom',
  8: '(8) Ótimo', 9: '(9) Excelente', 10: '(10) Obra-prima',
}

const WEEKDAY_LABELS = {
  monday: 'segunda', tuesday: 'terça', wednesday: 'quarta', thursday: 'quinta',
  friday: 'sexta', saturday: 'sábado', sunday: 'domingo',
}

export function formatBroadcast(broadcast) {
  if (!broadcast?.day_of_the_week) return null
  const day = WEEKDAY_LABELS[broadcast.day_of_the_week] || broadcast.day_of_the_week
  return broadcast.start_time ? `Toda ${day}, ${broadcast.start_time}` : `Toda ${day}`
}

export const malScore = (node) => (node.mean ? Number(node.mean).toFixed(2) : null)
export const posterUrl = (node) => node.main_picture?.large || node.main_picture?.medium || null

// Pôster guardado no disco (mal-posters/); o que veio da busca ainda não tem, então baixa na primeira vez
export function useMalPoster(node) {
  const [src, setSrc] = useState(node._cachedPoster || null)
  useEffect(() => {
    if (src) return
    const url = posterUrl(node)
    if (!url) return
    let cancelled = false
    window.api.malSavePoster({ malId: node.id, url })
      .then(data => { if (data && !cancelled) setSrc(data) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id])
  return src
}
