// Validações e utilitários sem estado próprio (também usados pela suíte de segurança em tests/)
const { app } = require('electron')
const path = require('path')
const state = require('./state')

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0
}

function sanitizeExt(ext) {
  return String(ext || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'jpg'
}

function getFilmeById(id) {
  return state.db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM episodios_assistidos e WHERE e.filme_id = f.id) AS episodes_watched_count
    FROM filmes f WHERE f.id = ?
  `).get(id)
}

function assertCoversPath(filePath) {
  const coversDir = path.resolve(path.join(app.getPath('userData'), 'covers'))
  const resolved  = path.resolve(filePath)
  if (!resolved.startsWith(coversDir + path.sep) && resolved !== coversDir) {
    throw new Error('Path traversal detected')
  }
  return resolved
}

function omdbFetch(url) {
  const https = require('https')
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('Parse error')) } })
    }).on('error', reject)
  })
}

const ALLOWED_EXTERNAL_ORIGINS = [
  'https://www.omdbapi.com',
  'https://www.themoviedb.org',
  'https://myanimelist.net',
]

module.exports = { isPositiveInt, getFilmeById, omdbFetch, sanitizeExt, assertCoversPath, ALLOWED_EXTERNAL_ORIGINS }
