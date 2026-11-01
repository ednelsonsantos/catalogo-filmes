// MyAnimeList: login OAuth2 (PKCE), lista, busca, pôsteres e cache local
const { app, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')
const { isPositiveInt } = require('./helpers')
const { downloadImage } = require('./images')

let _malAuthState      = ''    // PKCE state
let _malCodeVerifier   = ''    // PKCE verifier
let _malCallbackServer = null  // HTTP server for OAuth redirect

// ─── MAL HELPERS ──────────────────────────────────────────────────────────────

function generatePKCE() {
  const crypto = require('crypto')
  const verifier = crypto.randomBytes(48).toString('base64url')
  // MAL uses plain (no S256) for the challenge
  return { verifier, challenge: verifier }
}

function generateState() {
  return require('crypto').randomBytes(16).toString('hex')
}

function malFetch(url, options = {}) {
  const https = require('https')
  const { method = 'GET', headers = {}, body } = options
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = { raw: data } }
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function malRefreshIfNeeded() {
  if (!state.mal.refreshToken) throw new Error('MAL não autenticado')
  if (Date.now() < state.mal.tokenExpiry - 60_000) return  // still valid
  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: state.mal.refreshToken,
    client_id:     state.mal.clientId,
  }).toString()
  const res = await malFetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status !== 200) throw new Error('Falha ao renovar token MAL')
  state.mal.accessToken  = res.body.access_token
  state.mal.refreshToken = res.body.refresh_token
  state.mal.tokenExpiry  = Date.now() + res.body.expires_in * 1000
  _saveMalTokens()
}

function _saveMalTokens() {
  const p = require('path').join(app.getPath('userData'), 'settings.json')
  const fs = require('fs')
  let existing = {}
  try { if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}
  fs.writeFileSync(p, JSON.stringify({
    ...existing,
    malAccessToken:  state.mal.accessToken,
    malRefreshToken: state.mal.refreshToken,
    malTokenExpiry:  state.mal.tokenExpiry,
  }, null, 2))
}

// ─── IPC: MAL ─────────────────────────────────────────────────────────────────

function closeMalCallbackServer() {
  if (!_malCallbackServer) return
  try { _malCallbackServer.close() } catch {}
  _malCallbackServer = null
}

ipcMain.handle('mal:startAuth', () => {
  if (!state.mal.clientId) throw new Error('Client ID do MAL não configurado')
  const { verifier, challenge } = generatePKCE()
  _malCodeVerifier = verifier
  _malAuthState    = generateState()

  // Inicia servidor local para capturar o redirect do MAL
  const http = require('http')
  if (_malCallbackServer) { try { _malCallbackServer.close() } catch {} }
  _malCallbackServer = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost:7813')
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Autorização recebida!</h2><p>Pode fechar esta aba e voltar ao app.</p></body></html>')
      const code  = url.searchParams.get('code')
      const oauthState = url.searchParams.get('state')
      state.mainWindow?.webContents.send('mal:oauth-callback', { code, state: oauthState })
      setTimeout(() => { try { _malCallbackServer?.close() } catch {} _malCallbackServer = null }, 1000)
    } else {
      res.writeHead(404); res.end()
    }
  })
  _malCallbackServer.listen(7813, '127.0.0.1')

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             state.mal.clientId,
    redirect_uri:          'http://localhost:7813',
    state:                 _malAuthState,
    code_challenge:        challenge,
    code_challenge_method: 'plain',
  })
  const authUrl = `https://myanimelist.net/v1/oauth2/authorize?${params}`
  shell.openExternal(authUrl)
  return { ok: true }
})

ipcMain.handle('mal:exchangeCode', async (_, { code, state: oauthState }) => {
  if (oauthState !== _malAuthState) throw new Error('State inválido — possível CSRF')
  if (!code) throw new Error('Código de autorização ausente')
  const body = new URLSearchParams({
    client_id:     state.mal.clientId,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  'http://localhost:7813',
    code_verifier: _malCodeVerifier,
  }).toString()
  const res = await malFetch('https://myanimelist.net/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.status !== 200) throw new Error(`MAL token error: ${JSON.stringify(res.body)}`)
  state.mal.accessToken  = res.body.access_token
  state.mal.refreshToken = res.body.refresh_token
  state.mal.tokenExpiry  = Date.now() + res.body.expires_in * 1000
  _malAuthState    = ''
  _malCodeVerifier = ''
  _saveMalTokens()
  return { ok: true }
})

ipcMain.handle('mal:search', async (_, { query, limit = 20 }) => {
  await malRefreshIfNeeded()
  if (!query || String(query).trim().length === 0) throw new Error('Query vazia')
  const q = encodeURIComponent(String(query).trim().slice(0, 100))
  const fields = 'id,title,alternative_titles,main_picture,num_episodes,mean,start_date,genres,media_type,broadcast,status'
  const res = await malFetch(`https://api.myanimelist.net/v2/anime?q=${q}&limit=${limit}&fields=${fields}`, {
    headers: { Authorization: `Bearer ${state.mal.accessToken}` },
  })
  if (res.status === 401) throw new Error('Token MAL expirado — re-autentique')
  if (res.status !== 200) throw new Error(`MAL API error: ${res.status}`)
  return res.body
})

ipcMain.handle('mal:getAnimeList', async (_, { status = 'completed', limit = 1000 } = {}) => {
  await malRefreshIfNeeded()
  const fields = 'id,title,alternative_titles,main_picture,num_episodes,mean,start_date,genres,media_type,my_list_status,broadcast,status'
  const url = `https://api.myanimelist.net/v2/users/@me/animelist?fields=${fields}&status=${status}&limit=${limit}&nsfw=true`
  const res = await malFetch(url, {
    headers: { Authorization: `Bearer ${state.mal.accessToken}` },
  })
  if (res.status === 401) throw new Error('Token MAL expirado — re-autentique')
  if (res.status !== 200) throw new Error(`MAL API error: ${res.status}`)
  return res.body
})

const MAL_POSTER_HOSTS = ['cdn.myanimelist.net', 'api-cdn.myanimelist.net']

ipcMain.handle('mal:savePoster', async (_, { malId, url } = {}) => {
  // malId e URL vêm da página: sem estas checagens, "../settings" + ".json" devolvia o settings.json
  // (chaves de API) e uma URL qualquer era baixada e gravada fora da pasta de pôsteres
  if (!isPositiveInt(malId)) return null
  let parsed
  try { parsed = new URL(String(url)) } catch { return null }
  if (parsed.protocol !== 'https:' || !MAL_POSTER_HOSTS.includes(parsed.hostname)) return null
  const ext = (parsed.pathname.split('.').pop() || '').toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return null
  const malPostersDir = path.join(app.getPath('userData'), 'mal-posters')
  if (!fs.existsSync(malPostersDir)) fs.mkdirSync(malPostersDir, { recursive: true })
  const filePath = path.join(malPostersDir, `${malId}.${ext}`)
  // se já existe no disco, retorna direto
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath)
    return `data:image/${ext};base64,${data.toString('base64')}`
  }
  const buf = await downloadImage(parsed)
  if (!buf) return null
  try { fs.writeFileSync(filePath, buf) } catch {}
  return `data:image/${ext};base64,${buf.toString('base64')}`
})

ipcMain.handle('mal:saveCache', (_, animes) => {
  const p = path.join(app.getPath('userData'), 'mal-cache.json')
  fs.writeFileSync(p, JSON.stringify(animes), 'utf8')
  return true
})

ipcMain.handle('mal:loadCache', () => {
  const p = path.join(app.getPath('userData'), 'mal-cache.json')
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return [] }
})

ipcMain.handle('mal:getStatus', () => ({
  configured: !!state.mal.clientId,
  authenticated: !!state.mal.accessToken && Date.now() < state.mal.tokenExpiry,
}))

ipcMain.handle('mal:updateAnime', async (_, { animeId, patch }) => {
  await malRefreshIfNeeded()
  if (!Number.isInteger(animeId) || animeId <= 0) throw new Error('Invalid anime ID')
  const params = new URLSearchParams()
  if (patch.status != null)               params.append('status', patch.status)
  if (patch.score != null)                params.append('score', String(Number(patch.score)))
  if (patch.num_episodes_watched != null) params.append('num_watched_episodes', String(Number(patch.num_episodes_watched)))
  const res = await fetch(`https://api.myanimelist.net/v2/anime/${animeId}/my_list_status`, {
    method: 'PATCH',
    headers: {
      Authorization:  `Bearer ${state.mal.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`MAL update error: ${JSON.stringify(json)}`)
  return json
})

ipcMain.handle('mal:disconnect', () => {
  state.mal.accessToken  = ''
  state.mal.refreshToken = ''
  state.mal.tokenExpiry  = 0
  _saveMalTokens()
  return true
})

ipcMain.handle('export:malJson', async (_e, { animes }) => {
  if (!Array.isArray(animes)) throw new Error('Lista inválida')
  const data = animes.map(({ node, list_status }) => {
    const totalEps   = node.num_episodes || 0
    const watchedEps = list_status?.num_episodes_watched || 0
    // anime em andamento sem total definido: usa episódios assistidos como referência
    const episodes   = totalEps > 0 ? totalEps : (watchedEps > 0 ? watchedEps : null)
    const ongoing    = totalEps === 0 && watchedEps > 0
    return {
      mal_id:      node.id,
      title:       node.title,
      title_en:    node.alternative_titles?.en || '',
      title_ja:    node.alternative_titles?.ja || '',
      poster_url:  node.main_picture?.large || node.main_picture?.medium || '',
      episodes,
      ongoing,
      score:       node.mean || null,
      my_score:    list_status?.score || null,
      status:      list_status?.status || '',
      watched_eps: watchedEps,
      start_date:  node.start_date || '',
      genres:      (node.genres || []).map(g => g.name),
      media_type:  node.media_type || '',
    }
  })
  const { filePath, canceled } = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Exportar lista de animes',
    defaultPath: require('path').join(app.getPath('documents'), 'meus-animes.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!filePath || canceled) return { success: false }
  require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  return { success: true }
})

module.exports = { closeMalCallbackServer }
