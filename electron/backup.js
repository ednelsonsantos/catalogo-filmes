// Backup (.zip) manual e automático, e restauração
const { app, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')
const { createDatabase } = require('./database')
const { loadPrefs, savePrefs } = require('./prefs')

// ─── IPC: BACKUP ──────────────────────────────────────────────────────────────

ipcMain.handle('backup:create', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(state.mainWindow, {
    title: 'Fazer backup completo',
    defaultPath: path.join(app.getPath('documents'), `meu-catalogo-backup-${new Date().toISOString().slice(0, 10)}.zip`),
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
  })
  if (!filePath || canceled) return { success: false }
  writeBackupZip(filePath)
  return { success: true, filePath }
})

function writeBackupZip(filePath) {
  const AdmZip = require('adm-zip')
  const userDataPath = app.getPath('userData')
  // SQLite roda em modo WAL — escritas recentes podem estar só no .db-wal, não no .db principal ainda.
  // TRUNCATE força tudo de volta pro arquivo principal e zera o WAL, garantindo um snapshot completo e consistente.
  if (state.db) { try { state.db.pragma('wal_checkpoint(TRUNCATE)') } catch {} }

  const zip = new AdmZip()
  const dbPath = path.join(userDataPath, 'catalogo.db')
  if (fs.existsSync(dbPath)) zip.addLocalFile(dbPath)
  const coversDir = path.join(userDataPath, 'covers')
  if (fs.existsSync(coversDir)) zip.addLocalFolder(coversDir, 'covers')
  const malPostersDir = path.join(userDataPath, 'mal-posters')
  if (fs.existsSync(malPostersDir)) zip.addLocalFolder(malPostersDir, 'mal-posters')
  const savedPostersDir = path.join(userDataPath, 'posters')
  if (fs.existsSync(savedPostersDir)) zip.addLocalFolder(savedPostersDir, 'posters')
  const cachePath = path.join(userDataPath, 'mal-cache.json')
  if (fs.existsSync(cachePath)) zip.addLocalFile(cachePath)
  const settingsPath = path.join(userDataPath, 'settings.json')
  if (fs.existsSync(settingsPath)) zip.addLocalFile(settingsPath)

  zip.writeZip(filePath)
}

// ─── Backup automático: 1x por semana, guarda os 5 últimos ────────────────────
const AUTO_BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000
const AUTO_BACKUP_KEEP = 5
const AUTO_BACKUP_RE = /^meu-catalogo-auto-\d{4}-\d{2}-\d{2}\.zip$/

// Fora do app instalado (dev/testes) o padrão fica dentro da pasta de dados — nunca nos Documentos reais
function autoBackupDir() {
  if (state.prefs.backupDir) return state.prefs.backupDir
  return app.isPackaged
    ? path.join(app.getPath('documents'), 'Meu Catálogo', 'Backups')
    : path.join(app.getPath('userData'), 'backups')
}

function autoBackupStatus() {
  const last = state.prefs.lastBackupAt ? Date.parse(state.prefs.lastBackupAt) : NaN
  return {
    enabled: state.prefs.autoBackup,
    dir: autoBackupDir(),
    lastAt: state.prefs.lastBackupAt,
    nextAt: Number.isFinite(last) ? new Date(last + AUTO_BACKUP_EVERY_MS).toISOString() : null,
  }
}

function runAutoBackup({ force = false } = {}) {
  if (!state.prefs.autoBackup && !force) return { ran: false, reason: 'disabled' }
  const last = state.prefs.lastBackupAt ? Date.parse(state.prefs.lastBackupAt) : NaN
  if (!force && Number.isFinite(last) && Date.now() - last < AUTO_BACKUP_EVERY_MS) return { ran: false, reason: 'not-due' }
  // catálogo vazio (ou banco zerado por acidente) não pode empurrar os backups bons pra fora da rotação
  const count = state.db ? state.db.prepare('SELECT COUNT(*) AS n FROM filmes').get().n : 0
  if (count === 0) return { ran: false, reason: 'empty' }

  const dir = autoBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `meu-catalogo-auto-${new Date().toISOString().slice(0, 10)}.zip`)
  writeBackupZip(file)
  state.prefs.lastBackupAt = new Date().toISOString()
  savePrefs()

  // rotação: só mexe nos arquivos do próprio backup automático
  const autos = fs.readdirSync(dir).filter(n => AUTO_BACKUP_RE.test(n)).sort().reverse()
  for (const old of autos.slice(AUTO_BACKUP_KEEP)) {
    try { fs.rmSync(path.join(dir, old), { force: true }) } catch {}
  }
  return { ran: true, file }
}

ipcMain.handle('backup:autoStatus', () => autoBackupStatus())

ipcMain.handle('backup:autoCheck', () => {
  try { return runAutoBackup() } catch (e) { return { ran: false, reason: 'error', message: e.message } }
})

ipcMain.handle('backup:autoNow', () => ({ ...runAutoBackup({ force: true }), status: autoBackupStatus() }))

// a pasta só muda pelo diálogo do sistema — a página nunca passa um caminho
ipcMain.handle('backup:chooseDir', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(state.mainWindow, {
    title: 'Pasta dos backups automáticos',
    defaultPath: autoBackupDir(),
    properties: ['openDirectory', 'createDirectory'],
  })
  if (!canceled && filePaths[0]) { state.prefs.backupDir = filePaths[0]; savePrefs() }
  return autoBackupStatus()
})

ipcMain.handle('backup:openDir', () => {
  const dir = autoBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  return shell.openPath(dir)
})

ipcMain.handle('backup:restore', async () => {
  const AdmZip = require('adm-zip')
  const { filePaths, canceled } = await dialog.showOpenDialog(state.mainWindow, {
    title: 'Restaurar backup',
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return { success: false }

  const zip = new AdmZip(filePaths[0])
  const entryNames = zip.getEntries().map(e => e.entryName)
  if (!entryNames.includes('catalogo.db')) {
    throw new Error('Arquivo inválido: catalogo.db não encontrado dentro do backup')
  }

  const userDataPath = app.getPath('userData')
  if (state.db) { try { state.db.close() } catch {}; state.db = null }
  // WAL/SHM antigos não podem ser aplicados por cima do banco restaurado
  for (const ext of ['-wal', '-shm']) {
    try { fs.rmSync(path.join(userDataPath, 'catalogo.db' + ext), { force: true }) } catch {}
  }
  zip.extractAllTo(userDataPath, true)

  // Recarrega dentro do mesmo processo: app.relaunch() no modo dev derruba o Vite junto (tela escura)
  state.keys.omdb = ''; state.keys.tmdb = ''
  state.mal.clientId = ''; state.mal.accessToken = ''; state.mal.refreshToken = ''; state.mal.tokenExpiry = 0
  createDatabase()
  loadPrefs() // o settings.json do backup traz as preferências dele
  setTimeout(() => state.mainWindow?.webContents.reload(), 100)
  return { success: true }
})
