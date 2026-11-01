// Chaves de API (TMDB, OMDb, MAL): ficam só no processo principal, a página só sabe se estão configuradas
const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')

// ─── IPC: SETTINGS ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  if (!fs.existsSync(p)) return { omdbApiKey: '', tmdbApiKey: '' }
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
    // Load keys into main-process memory
    if (raw.omdbApiKey)     state.keys.omdb        = raw.omdbApiKey
    if (raw.tmdbApiKey)     state.keys.tmdb        = raw.tmdbApiKey
    if (raw.malClientId)     state.mal.clientId    = raw.malClientId
    if (raw.malAccessToken)  state.mal.accessToken  = raw.malAccessToken
    if (raw.malRefreshToken) state.mal.refreshToken = raw.malRefreshToken
    if (raw.malTokenExpiry)  state.mal.tokenExpiry  = raw.malTokenExpiry
    return {
      omdbApiKey:       raw.omdbApiKey       ? '••••••••' : '',
      tmdbApiKey:       raw.tmdbApiKey       ? '••••••••' : '',
      omdbConfigured:   !!raw.omdbApiKey,
      tmdbConfigured:   !!raw.tmdbApiKey,
      malConfigured:    !!raw.malClientId,
      malAuthenticated: !!raw.malAccessToken && Date.now() < (raw.malTokenExpiry || 0),
    }
  } catch { return { omdbApiKey: '', tmdbApiKey: '' } }
})

ipcMain.handle('settings:save', (_, data) => {
  const p = path.join(app.getPath('userData'), 'settings.json')
  let existing = {}
  try { if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}

  const omdb = (data.omdbApiKey && !data.omdbApiKey.startsWith('•'))
    ? data.omdbApiKey.trim() : existing.omdbApiKey || ''
  const tmdb = (data.tmdbApiKey && !data.tmdbApiKey.startsWith('•'))
    ? data.tmdbApiKey.trim() : existing.tmdbApiKey || ''
  const malId = (data.malClientId && !data.malClientId.startsWith('•'))
    ? data.malClientId.trim() : existing.malClientId || ''

  state.keys.omdb     = omdb
  state.keys.tmdb     = tmdb
  state.mal.clientId = malId

  fs.writeFileSync(p, JSON.stringify({
    ...existing,
    omdbApiKey:  omdb,
    tmdbApiKey:  tmdb,
    malClientId: malId,
  }, null, 2))
  return true
})
