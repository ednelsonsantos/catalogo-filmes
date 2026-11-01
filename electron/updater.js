// Atualização automática
const { app, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')

// ─── ATUALIZAÇÃO AUTOMÁTICA ───────────────────────────────────────────────────
// Busca novas versões nos releases do GitHub (config "publish" do package.json).
// Fora do app instalado fica desligada, exceto com CATALOGO_UPDATE_FEED (servidor local de teste).

let _autoUpdater = null
let _updateStatus = { state: 'idle' }

// o erro do electron-updater traz stack e cabeçalhos HTTP; pra tela basta a primeira linha
const shortUpdateError = (err) => {
  const msg = String(err?.message || err)
  if (/No published versions/i.test(msg)) return 'nenhuma versão publicada no GitHub ainda.'
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i.test(msg)) return 'sem conexão com o servidor de atualizações.'
  return msg.split('\n')[0].slice(0, 160)
}

function sendUpdateStatus(status) {
  _updateStatus = status
  if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('updater:status', status)
}

function setupAutoUpdater() {
  const devFeed = !app.isPackaged && process.env.CATALOGO_UPDATE_FEED
  if (!app.isPackaged && !devFeed) return
  const { autoUpdater } = require('electron-updater')
  if (devFeed) {
    // o download lê a config do disco (nome da pasta de cache), não só a URL — gera uma na pasta de dados
    const configPath = path.join(app.getPath('userData'), 'dev-app-update.yml')
    fs.writeFileSync(configPath, `provider: generic\nurl: ${JSON.stringify(devFeed)}\nupdaterCacheDirName: catalogo-filmes-updater-test\n`)
    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.updateConfigPath = configPath
  }
  autoUpdater.autoDownload = true
  // com o servidor de teste nunca instala nada ao fechar
  autoUpdater.autoInstallOnAppQuit = !devFeed
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'up-to-date' }))
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => sendUpdateStatus({ ..._updateStatus, state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => sendUpdateStatus({ state: 'error', message: shortUpdateError(err) }))
  _autoUpdater = autoUpdater
}

// espera a janela carregar pra não disputar rede/CPU com a abertura do app
function checkForUpdatesSoon() {
  if (_autoUpdater) setTimeout(() => { _autoUpdater.checkForUpdates().catch(() => {}) }, 5000)
}

ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('updater:getStatus', () => ({ enabled: !!_autoUpdater, ..._updateStatus }))

ipcMain.handle('updater:check', async () => {
  if (!_autoUpdater) return { enabled: false, state: 'idle' }
  if (_updateStatus.state === 'downloading' || _updateStatus.state === 'ready') return { enabled: true, ..._updateStatus }
  try { await _autoUpdater.checkForUpdates() } catch (err) { sendUpdateStatus({ state: 'error', message: shortUpdateError(err) }) }
  return { enabled: true, ..._updateStatus }
})

ipcMain.handle('updater:install', () => {
  if (!_autoUpdater || _updateStatus.state !== 'ready') return false
  // fecha o app, roda o instalador da nova versão e abre de novo
  state.isQuitting = true // senão o "continuar na bandeja" barra o fechamento e a instalação não roda
  setImmediate(() => _autoUpdater.quitAndInstall(false, true))
  return true
})

module.exports = { setupAutoUpdater, checkForUpdatesSoon }
