import { WEEKDAY_INDEX } from '../constants.js'

const STORE_KEY = 'catalogo:notified'
const KEEP_DAYS = 60

// O que merece aviso agora. Cada item tem uma chave estável pra não avisar duas vezes a mesma coisa:
// episódio de hoje = título + data; temporada nova = título + quantidade de episódios lançados
export function pendingNotifications(filmes, animeList = [], now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const out = []
  for (const f of filmes) {
    if (!!f.watching && f.next_episode_air_date === today) {
      out.push({ key: `ep:${f.id}:${today}`, title: '🆕 Novo episódio hoje', body: f.title })
    }
    if (!!f.watched_at && f.episodes_aired != null && (f.episodes_watched_count || 0) < f.episodes_aired) {
      out.push({ key: `season:${f.id}:${f.episodes_aired}`, title: '📺 Nova temporada disponível', body: f.title })
    }
  }
  for (const a of animeList) {
    if (a.list_status?.status === 'watching' && a.node.status === 'currently_airing' &&
        WEEKDAY_INDEX[a.node.broadcast?.day_of_the_week] === now.getDay()) {
      out.push({ key: `anime:${a.node.id}:${today}`, title: '🆕 Novo episódio hoje', body: a.node.title })
    }
  }
  return out
}

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {} } catch { return {} }
}

function writeStore(store) {
  const cutoff = Date.now() - KEEP_DAYS * 86400000
  const pruned = Object.fromEntries(Object.entries(store).filter(([, t]) => t > cutoff))
  try { localStorage.setItem(STORE_KEY, JSON.stringify(pruned)) } catch {}
}

// Dispara só o que ainda não foi avisado; clicar no aviso traz a janela (útil com o app na bandeja)
export function notifyPending(items, onClick) {
  if (typeof Notification === 'undefined' || Notification.permission === 'denied') return []
  const store = readStore()
  const fresh = items.filter(it => !store[it.key])
  for (const it of fresh) {
    try {
      const n = new Notification(it.title, { body: it.body })
      if (onClick) n.onclick = onClick
    } catch {}
    store[it.key] = Date.now()
  }
  if (fresh.length) writeStore(store)
  return fresh
}
