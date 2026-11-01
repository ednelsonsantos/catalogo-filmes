// Processo principal: inicialização do app. Cada assunto fica no seu módulo (ver os requires abaixo)
const { app, ipcMain, shell } = require('electron')
const path = require('path')

// Testes automatizados rodam com uma pasta de dados descartável, nunca com o catálogo real
if (!app.isPackaged && process.env.CATALOGO_USER_DATA) {
  app.setPath('userData', process.env.CATALOGO_USER_DATA)
} else if (!app.isPackaged) {
  // npm run dev usa o catálogo real (mesma pasta do app instalado), mas o cache/sessão do Chromium fica à parte:
  // com o app instalado aberto na bandeja, os dois disputavam a pasta de cache ("Unable to create cache", "Acesso negado")
  app.setPath('sessionData', path.join(app.getPath('userData'), 'dev-session'))
}

// os módulos abaixo já leem a pasta de dados definida acima
const state = require('./state')
const { isPositiveInt, sanitizeExt, assertCoversPath, ALLOWED_EXTERNAL_ORIGINS } = require('./helpers')
const { closeMalCallbackServer } = require('./mal')
const { createDatabase } = require('./database')
const { createWindow, showMainWindow } = require('./window')
const { loadPrefs } = require('./prefs')
const { buildAppMenu } = require('./menu')
const { setupAutoUpdater, checkForUpdatesSoon } = require('./updater')
// módulos que só registram canais IPC
require('./catalogo')
require('./tmdb')
require('./images')
require('./export')
require('./backup')
require('./settings')

app.commandLine.appendSwitch('disable-features', 'Autofill')
// Sem isso o Windows não exibe as notificações do app (precisa bater com o appId do atalho do instalador).
// Fora do app instalado usa outro id: com o mesmo, o Electron do npm run dev criou um "Electron.lnk" no Menu Iniciar
// com o id do app instalado, e a barra de tarefas/avisos do app instalado passaram a mostrar o ícone do Electron
if (process.platform === 'win32') app.setAppUserModelId(app.isPackaged ? 'com.ednelson.meu-catalogo' : 'com.ednelson.meu-catalogo.dev')

// App instalado: abrir de novo (atalho, menu Iniciar) traz a janela existente em vez de abrir outra cópia —
// importante com o app escondido na bandeja. Em dev não, pra poder rodar junto do app instalado.
if (app.isPackaged && !app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', () => showMainWindow())

app.whenReady().then(() => {
  loadPrefs()
  createDatabase()
  buildAppMenu()
  createWindow()
  setupAutoUpdater()
  checkForUpdatesSoon()
}).catch(err => console.error('Falha na inicialização:', err))

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  state.isQuitting = true
  closeMalCallbackServer()
  if (state.db) {
    try { state.db.close() } catch {}
  }
})

// ─── IPC: SHELL ───────────────────────────────────────────────────────────────

ipcMain.handle('shell:openExternal', (_, url) => {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Invalid URL') }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs allowed')
  const allowed = ALLOWED_EXTERNAL_ORIGINS.includes(parsed.origin)
  if (!allowed) throw new Error(`URL not allowed: ${parsed.origin}`)
  return shell.openExternal(url)
})

// Exported for testing
module.exports = { isPositiveInt, sanitizeExt, assertCoversPath, ALLOWED_EXTERNAL_ORIGINS }
