/**
 * Suíte de segurança — testa os helpers expostos por electron/main.js
 * sem depender do Electron ou SQLite em tempo de execução.
 */

const path = require('path')
const os   = require('os')

// jest.mock factory não pode referenciar variáveis externas — usa literal
const mockUserData = path.join(os.tmpdir(), 'catalogo-test-userdata')

// Mock better-sqlite3 para evitar erro de versão de Node vs Electron
jest.mock('better-sqlite3', () => {
  const mockStmt = { run: jest.fn(), get: jest.fn(), all: jest.fn(() => []) }
  const mockDb   = {
    exec:    jest.fn(),
    prepare: jest.fn(() => mockStmt),
  }
  return jest.fn(() => mockDb)
}, { virtual: true })

jest.mock('electron', () => {
  const os   = require('os')
  const path = require('path')
  return {
    app: {
      getPath: (key) => {
        if (key === 'userData')  return path.join(os.tmpdir(), 'catalogo-test-userdata')
        if (key === 'documents') return os.tmpdir()
        if (key === 'downloads') return os.tmpdir()
        if (key === 'desktop')   return os.tmpdir()
        return os.tmpdir()
      },
      isPackaged: false,
      whenReady: () => Promise.resolve(),
      on: jest.fn(),
      quit: jest.fn(),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
      loadURL:  jest.fn(),
      loadFile: jest.fn(),
      once:     jest.fn(),
      show:     jest.fn(),
      webContents: {
        session: { webRequest: { onHeadersReceived: jest.fn() } },
        on:                 jest.fn(),
        setWindowOpenHandler: jest.fn(),
      },
    })),
    ipcMain:  { handle: jest.fn() },
    dialog:   { showSaveDialog: jest.fn() },
    shell:    { openExternal: jest.fn() },
  }
}, { virtual: true })

// Importa somente os helpers exportados — não inicializa janela nem DB
const {
  isPositiveInt,
  sanitizeExt,
  assertCoversPath,
  ALLOWED_EXTERNAL_ORIGINS,
} = require('../electron/main.js')

// ─── isPositiveInt ────────────────────────────────────────────────────────────

describe('isPositiveInt', () => {
  test('aceita inteiros positivos', () => {
    expect(isPositiveInt(1)).toBe(true)
    expect(isPositiveInt(100)).toBe(true)
    expect(isPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(true)
  })

  test('rejeita zero', () => {
    expect(isPositiveInt(0)).toBe(false)
  })

  test('rejeita negativos', () => {
    expect(isPositiveInt(-1)).toBe(false)
    expect(isPositiveInt(-999)).toBe(false)
  })

  test('rejeita float', () => {
    expect(isPositiveInt(1.5)).toBe(false)
    expect(isPositiveInt(0.1)).toBe(false)
  })

  test('rejeita string numérica', () => {
    expect(isPositiveInt('1')).toBe(false)
    expect(isPositiveInt('42')).toBe(false)
  })

  test('rejeita NaN e Infinity', () => {
    expect(isPositiveInt(NaN)).toBe(false)
    expect(isPositiveInt(Infinity)).toBe(false)
  })

  test('rejeita null, undefined, object', () => {
    expect(isPositiveInt(null)).toBe(false)
    expect(isPositiveInt(undefined)).toBe(false)
    expect(isPositiveInt({})).toBe(false)
    expect(isPositiveInt([])).toBe(false)
  })
})

// ─── sanitizeExt ──────────────────────────────────────────────────────────────

describe('sanitizeExt', () => {
  test('mantém extensões válidas', () => {
    expect(sanitizeExt('jpg')).toBe('jpg')
    expect(sanitizeExt('png')).toBe('png')
    expect(sanitizeExt('webp')).toBe('webp')
    expect(sanitizeExt('JPEG')).toBe('JPEG')
  })

  test('remove caracteres especiais', () => {
    expect(sanitizeExt('../evil')).toBe('evil')
    expect(sanitizeExt('../../etc/passwd')).toBe('etcpasswd')
    expect(sanitizeExt('jpg; rm -rf /')).toBe('jpgrmrf')
  })

  test('trunca em 10 caracteres', () => {
    const long = 'abcdefghijklmnop'
    expect(sanitizeExt(long).length).toBeLessThanOrEqual(10)
  })

  test('usa fallback jpg para vazio ou inválido', () => {
    expect(sanitizeExt('')).toBe('jpg')
    expect(sanitizeExt(null)).toBe('jpg')
    expect(sanitizeExt(undefined)).toBe('jpg')
    expect(sanitizeExt('...')).toBe('jpg')
    expect(sanitizeExt('---')).toBe('jpg')
  })

  test('remove barras e pontos', () => {
    expect(sanitizeExt('.jpg')).toBe('jpg')
    expect(sanitizeExt('/jpg')).toBe('jpg')
    expect(sanitizeExt('\\jpg')).toBe('jpg')
  })
})

// ─── assertCoversPath ─────────────────────────────────────────────────────────

describe('assertCoversPath — path traversal', () => {
  const coversDir = path.join(mockUserData, 'covers')
  const validPath = path.join(coversDir, '1_1234567890.jpg')

  test('aceita path dentro da pasta covers', () => {
    expect(() => assertCoversPath(validPath)).not.toThrow()
  })

  test('retorna path resolvido', () => {
    const result = assertCoversPath(validPath)
    expect(result).toBe(path.resolve(validPath))
  })

  test('bloqueia path traversal com ../', () => {
    const evil = path.join(coversDir, '..', 'settings.json')
    expect(() => assertCoversPath(evil)).toThrow('Path traversal detected')
  })

  test('bloqueia path fora do userData', () => {
    const evil = path.join(os.tmpdir(), 'malicious.exe')
    expect(() => assertCoversPath(evil)).toThrow('Path traversal detected')
  })

  test('bloqueia path raiz do userData (sem /covers/)', () => {
    const evil = mockUserData
    expect(() => assertCoversPath(evil)).toThrow('Path traversal detected')
  })

  test('bloqueia caminhos absolutos arbitrários', () => {
    expect(() => assertCoversPath('C:\\Windows\\System32\\config\\SAM')).toThrow()
    expect(() => assertCoversPath('/etc/passwd')).toThrow()
  })

  test('bloqueia path que só começa com coversDir mas escapa', () => {
    // Ex.: /userData/covers/../settings.json normaliza para fora
    const tricky = path.resolve(coversDir, '..', 'covers_extra', 'file.jpg')
    expect(() => assertCoversPath(tricky)).toThrow('Path traversal detected')
  })
})

// ─── ALLOWED_EXTERNAL_ORIGINS — lógica baseada em URL.origin ─────────────────

function simulateOpenExternal(url) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Invalid URL') }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs allowed')
  const allowed = ALLOWED_EXTERNAL_ORIGINS.includes(parsed.origin)
  if (!allowed) throw new Error(`URL not allowed: ${parsed.origin}`)
  return true
}

describe('ALLOWED_EXTERNAL_ORIGINS — allowlist de URLs externas', () => {
  test('permite URLs de origens da allowlist', () => {
    expect(() => simulateOpenExternal('https://www.omdbapi.com/apikey.aspx')).not.toThrow()
    expect(() => simulateOpenExternal('https://www.themoviedb.org/settings/api')).not.toThrow()
  })

  test.each([
    ['https://evil.com'],
    ['https://www.omdbapi.com.evil.com/steal'],  // subdomain spoofing bloqueado por origin
    ['https://fakewww.omdbapi.com/'],
    ['javascript:alert(1)'],
    ['file:///C:/Windows/System32/config/SAM'],
  ])('bloqueia URL fora da allowlist: %s', (url) => {
    expect(() => simulateOpenExternal(url)).toThrow()
  })

  test('rejeita URLs HTTP (não-HTTPS)', () => {
    expect(() => simulateOpenExternal('http://www.omdbapi.com/apikey.aspx')).toThrow('Only HTTPS URLs allowed')
    expect(() => simulateOpenExternal('ftp://www.omdbapi.com/file')).toThrow('Only HTTPS URLs allowed')
  })

  test('rejeita URL inválida', () => {
    expect(() => simulateOpenExternal('não é uma url')).toThrow('Invalid URL')
    expect(() => simulateOpenExternal('')).toThrow()
  })

  test('allowlist só contém origens HTTPS', () => {
    for (const origin of ALLOWED_EXTERNAL_ORIGINS) {
      expect(origin.startsWith('https://')).toBe(true)
    }
  })

  test('subdomain spoofing é bloqueado por comparação de origin exato', () => {
    // 'https://www.omdbapi.com.evil.com' tem origin diferente de 'https://www.omdbapi.com'
    const spoof = new URL('https://www.omdbapi.com.evil.com/steal')
    expect(spoof.origin).toBe('https://www.omdbapi.com.evil.com')
    expect(ALLOWED_EXTERNAL_ORIGINS.includes(spoof.origin)).toBe(false)
  })
})

// ─── Validação de VITE_DEV_URL ────────────────────────────────────────────────

describe('Validação do VITE_DEV_URL', () => {
  const devUrlRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/

  test('aceita localhost com porta', () => {
    expect(devUrlRegex.test('http://localhost:5173')).toBe(true)
    expect(devUrlRegex.test('http://localhost:5174/')).toBe(true)
    expect(devUrlRegex.test('http://127.0.0.1:3000')).toBe(true)
  })

  test('aceita localhost sem porta', () => {
    expect(devUrlRegex.test('http://localhost')).toBe(true)
    expect(devUrlRegex.test('http://localhost/')).toBe(true)
  })

  test('rejeita hosts externos', () => {
    expect(devUrlRegex.test('http://evil.com')).toBe(false)
    expect(devUrlRegex.test('http://evil.com:5173')).toBe(false)
    expect(devUrlRegex.test('https://attacker.com')).toBe(false)
  })

  test('rejeita injeção de path', () => {
    expect(devUrlRegex.test('http://localhost:5173/../../etc')).toBe(false)
    expect(devUrlRegex.test('http://localhost:5173?evil=1')).toBe(false)
  })

  test('rejeita protocolos inseguros não-http', () => {
    expect(devUrlRegex.test('ftp://localhost:5173')).toBe(false)
    expect(devUrlRegex.test('file://localhost')).toBe(false)
    expect(devUrlRegex.test('javascript:localhost')).toBe(false)
  })
})

// ─── Lógica de settings:save — keys mascaradas não substituem reais ───────────

describe('Lógica de mascaramento de API keys', () => {
  function simulateSave(incoming, existing) {
    const omdb = (incoming.omdbApiKey && !incoming.omdbApiKey.startsWith('•'))
      ? incoming.omdbApiKey.trim()
      : existing.omdbApiKey || ''
    const tmdb = (incoming.tmdbApiKey && !incoming.tmdbApiKey.startsWith('•'))
      ? incoming.tmdbApiKey.trim()
      : existing.tmdbApiKey || ''
    return { omdbApiKey: omdb, tmdbApiKey: tmdb }
  }

  test('substitui quando chave nova é fornecida', () => {
    const result = simulateSave({ omdbApiKey: 'nova123', tmdbApiKey: 'tmdb456' }, {})
    expect(result.omdbApiKey).toBe('nova123')
    expect(result.tmdbApiKey).toBe('tmdb456')
  })

  test('preserva chave existente quando masked (••••••••) é enviado', () => {
    const result = simulateSave(
      { omdbApiKey: '••••••••', tmdbApiKey: '••••••••' },
      { omdbApiKey: 'real-key-abc', tmdbApiKey: 'real-tmdb-xyz' }
    )
    expect(result.omdbApiKey).toBe('real-key-abc')
    expect(result.tmdbApiKey).toBe('real-tmdb-xyz')
  })

  test('string vazia preserva chave existente (comportamento por design — não é possível limpar via UI mascarada)', () => {
    // Por design: a UI nunca envia string vazia quando há chave — só envia '••••••••'
    // Para limpar uma chave, o usuário deve digitar um espaço e salvar (será trimado para '')
    // Este teste documenta o comportamento atual
    const result = simulateSave(
      { omdbApiKey: '', tmdbApiKey: '' },
      { omdbApiKey: 'old-key', tmdbApiKey: 'old-tmdb' }
    )
    // Falsy empty string cai no branch de preservação
    expect(result.omdbApiKey).toBe('old-key')
    expect(result.tmdbApiKey).toBe('old-tmdb')
  })

  test('faz trim da chave antes de salvar', () => {
    const result = simulateSave({ omdbApiKey: '  abc123  ', tmdbApiKey: '  xyz  ' }, {})
    expect(result.omdbApiKey).toBe('abc123')
    expect(result.tmdbApiKey).toBe('xyz')
  })
})

// ─── Validação de collection name ─────────────────────────────────────────────

describe('Validação de nome de coleção', () => {
  function validateCollectionName(name) {
    const n = String(name || '').trim()
    if (!n || n.length > 100) throw new Error('Nome de coleção inválido')
    return n
  }

  test('aceita nomes válidos', () => {
    expect(() => validateCollectionName('Filmes de Ação')).not.toThrow()
    expect(() => validateCollectionName('A')).not.toThrow()
    expect(() => validateCollectionName('x'.repeat(100))).not.toThrow()
  })

  test('rejeita nome vazio', () => {
    expect(() => validateCollectionName('')).toThrow('Nome de coleção inválido')
    expect(() => validateCollectionName('   ')).toThrow('Nome de coleção inválido')
  })

  test('rejeita nome null ou undefined', () => {
    expect(() => validateCollectionName(null)).toThrow()
    expect(() => validateCollectionName(undefined)).toThrow()
  })

  test('rejeita nome maior que 100 caracteres', () => {
    expect(() => validateCollectionName('x'.repeat(101))).toThrow('Nome de coleção inválido')
  })

  test('faz trim antes de validar', () => {
    expect(validateCollectionName('  Coleção  ')).toBe('Coleção')
  })
})

// ─── Validação de base64 de capa ──────────────────────────────────────────────

describe('Validação de payload base64 para cover:save', () => {
  const MAX_B64 = 20 * 1024 * 1024

  function validateCoverPayload({ id, base64, ext }) {
    if (!isPositiveInt(id)) throw new Error('Invalid ID')
    if (typeof base64 !== 'string' || base64.length === 0) throw new Error('Invalid base64')
    if (base64.length > MAX_B64) throw new Error('Image too large (max 20 MB)')
    if (!sanitizeExt(ext)) throw new Error('Invalid ext')
    return true
  }

  test('aceita payload válido', () => {
    expect(() => validateCoverPayload({ id: 1, base64: 'abc123', ext: 'jpg' })).not.toThrow()
  })

  test('rejeita ID inválido', () => {
    expect(() => validateCoverPayload({ id: 0, base64: 'abc', ext: 'jpg' })).toThrow('Invalid ID')
    expect(() => validateCoverPayload({ id: -1, base64: 'abc', ext: 'jpg' })).toThrow('Invalid ID')
    expect(() => validateCoverPayload({ id: 'a', base64: 'abc', ext: 'jpg' })).toThrow('Invalid ID')
  })

  test('rejeita base64 vazio ou não-string', () => {
    expect(() => validateCoverPayload({ id: 1, base64: '', ext: 'jpg' })).toThrow('Invalid base64')
    expect(() => validateCoverPayload({ id: 1, base64: null, ext: 'jpg' })).toThrow('Invalid base64')
    expect(() => validateCoverPayload({ id: 1, base64: 123, ext: 'jpg' })).toThrow('Invalid base64')
  })

  test('rejeita base64 maior que 20 MB', () => {
    const tooBig = 'a'.repeat(MAX_B64 + 1)
    expect(() => validateCoverPayload({ id: 1, base64: tooBig, ext: 'jpg' })).toThrow('Image too large')
  })

  test('aceita exatamente no limite de 20 MB', () => {
    const exact = 'a'.repeat(MAX_B64)
    expect(() => validateCoverPayload({ id: 1, base64: exact, ext: 'jpg' })).not.toThrow()
  })
})

// ─── Validação da query de busca ──────────────────────────────────────────────

describe('Validação da query db:search', () => {
  function validateSearchQuery(query) {
    const q = String(query || '').trim()
    if (q.length === 0) return null
    if (q.length > 200) throw new Error('Query too long')
    return q
  }

  test('retorna null para query vazia', () => {
    expect(validateSearchQuery('')).toBeNull()
    expect(validateSearchQuery('   ')).toBeNull()
    expect(validateSearchQuery(null)).toBeNull()
  })

  test('aceita query válida', () => {
    expect(validateSearchQuery('Batman')).toBe('Batman')
    expect(validateSearchQuery('  Batman  ')).toBe('Batman')
  })

  test('rejeita query com mais de 200 chars', () => {
    expect(() => validateSearchQuery('a'.repeat(201))).toThrow('Query too long')
  })

  test('aceita exatamente 200 chars', () => {
    expect(() => validateSearchQuery('a'.repeat(200))).not.toThrow()
  })
})
