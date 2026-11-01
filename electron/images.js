// Capas (fotos do usuário) e pôsteres guardados no disco
const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')
const { isPositiveInt, sanitizeExt, assertCoversPath } = require('./helpers')

// ─── IPC: CAPA ────────────────────────────────────────────────────────────────

ipcMain.handle('cover:save', async (_, { id, base64, ext }) => {
  if (!isPositiveInt(id)) throw new Error('Invalid ID')
  if (typeof base64 !== 'string' || base64.length === 0) throw new Error('Invalid base64')
  // Limit to 20 MB (base64 overhead ~33%, so ~15 MB raw)
  if (base64.length > 20 * 1024 * 1024) throw new Error('Image too large (max 20 MB)')
  const safeExt = sanitizeExt(ext)
  const dir = path.join(app.getPath('userData'), 'covers')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `${id}_${Date.now()}.${safeExt}`)
  // assertCoversPath as a final guard
  assertCoversPath(filePath)
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

ipcMain.handle('cover:read', (_, filePath) => {
  if (!filePath) return null
  let resolved
  try { resolved = assertCoversPath(filePath) } catch { return null }
  if (!fs.existsSync(resolved)) return null
  try {
    const data = fs.readFileSync(resolved)
    const ext = path.extname(resolved).slice(1)
    const safeExt = sanitizeExt(ext)
    return `data:image/${safeExt};base64,${data.toString('base64')}`
  } catch { return null }
})

// ─── Pôsteres guardados no disco ──────────────────────────────────────────────
// O pôster da TMDB/OMDb é só um link: sem internet (ou se o link mudar) a imagem some e o backup não a leva.
// Cada pôster é baixado uma vez pra posters/<id>-<hash da URL>.<ext> — trocar o pôster muda o nome do arquivo.
const POSTER_HOSTS = ['image.tmdb.org', 'img.omdbapi.com', 'm.media-amazon.com'] // os mesmos do img-src da CSP
const POSTER_EXTS = ['jpg', 'jpeg', 'png', 'webp']
const POSTER_MAX_BYTES = 10 * 1024 * 1024
const POSTER_FILE_RE = /^(\d+)-([0-9a-f]{12})\.(jpg|jpeg|png|webp)$/

function postersDir() { return path.join(app.getPath('userData'), 'posters') }

// Servidor local de teste (só fora do app instalado), como o CATALOGO_UPDATE_FEED
function posterTestOrigin() {
  return !app.isPackaged && process.env.CATALOGO_POSTER_ORIGIN ? process.env.CATALOGO_POSTER_ORIGIN : null
}

function parsePosterUrl(url) {
  let parsed
  try { parsed = new URL(String(url)) } catch { return null }
  const allowed = (parsed.protocol === 'https:' && POSTER_HOSTS.includes(parsed.hostname))
    || parsed.origin === posterTestOrigin()
  return allowed ? parsed : null
}

function posterFileFor(id, url) {
  const parsed = parsePosterUrl(url)
  if (!isPositiveInt(id) || !parsed) return null
  const ext = (parsed.pathname.split('.').pop() || '').toLowerCase()
  const hash = require('crypto').createHash('sha1').update(parsed.href).digest('hex').slice(0, 12)
  return { parsed, file: path.join(postersDir(), `${id}-${hash}.${POSTER_EXTS.includes(ext) ? ext : 'jpg'}`) }
}

function downloadImage(parsed, maxBytes = POSTER_MAX_BYTES) {
  const client = parsed.protocol === 'http:' ? require('http') : require('https')
  return new Promise((resolve) => {
    const req = client.get(parsed, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200 || !/^image\//.test(res.headers['content-type'] || '')) { res.resume(); resolve(null); return }
      const chunks = []
      let size = 0
      res.on('data', c => {
        size += c.length
        if (size > maxBytes) { res.destroy(); resolve(null); return }
        chunks.push(c)
      })
      res.on('end', () => { if (size <= maxBytes) resolve(Buffer.concat(chunks)) })
      res.on('error', () => resolve(null))
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })
}

function readImageDataUrl(file) {
  try {
    const ext = path.extname(file).slice(1).replace('jpg', 'jpeg')
    return `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`
  } catch { return null }
}

ipcMain.handle('poster:read', (_, { id, url } = {}) => {
  const target = posterFileFor(id, url)
  return target && fs.existsSync(target.file) ? readImageDataUrl(target.file) : null
})

// Baixa os que faltam e apaga os que não servem mais (título removido ou pôster trocado).
// Um de cada vez: são poucos KB cada e roda em segundo plano
let _posterSync = null
let _posterSyncAgain = false
function syncPosters() {
  // pedida no meio de outra (título acabou de ser salvo): roda de novo no fim, pra não perder o novo
  if (_posterSync) { _posterSyncAgain = true; return _posterSync }
  _posterSync = (async () => {
    const result = { downloaded: 0, failed: 0, removed: 0 }
    const myDb = state.db
    if (!myDb) return result
    const dir = postersDir()
    fs.mkdirSync(dir, { recursive: true })
    const wanted = new Set()
    for (const f of myDb.prepare("SELECT id, poster_url FROM filmes WHERE poster_url IS NOT NULL AND poster_url <> ''").all()) {
      const target = posterFileFor(f.id, f.poster_url)
      if (!target) continue
      wanted.add(path.basename(target.file))
      if (fs.existsSync(target.file)) continue
      const buf = await downloadImage(target.parsed)
      if (!buf) { result.failed++; continue }
      try { fs.writeFileSync(target.file, buf); result.downloaded++ } catch { result.failed++ }
    }
    if (state.db !== myDb) return result // backup restaurado no meio: a lista acima é do banco antigo
    for (const name of fs.readdirSync(dir)) {
      if (!POSTER_FILE_RE.test(name) || wanted.has(name)) continue
      try { fs.rmSync(path.join(dir, name), { force: true }); result.removed++ } catch {}
    }
    return result
  })().finally(() => {
    _posterSync = null
    if (_posterSyncAgain) { _posterSyncAgain = false; syncPosters() }
  })
  return _posterSync
}

// depois de salvar: espera um pouco pra juntar uma importação inteira numa só passada
let _posterSyncTimer = null
function schedulePosterSync() {
  clearTimeout(_posterSyncTimer)
  _posterSyncTimer = setTimeout(() => { syncPosters().catch(() => {}) }, 2000)
}

ipcMain.handle('poster:sync', () => syncPosters())

module.exports = { downloadImage, schedulePosterSync }
