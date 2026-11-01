// Preferências do app (bandeja, iniciar com o Windows, backup automático, tema) gravadas no settings.json
const { app, ipcMain, nativeTheme } = require('electron')
const path = require('path')
const fs = require('fs')
const state = require('./state')

// ─── SEGUNDO PLANO: bandeja, iniciar com o Windows ────────────────────────────

function readSettingsFile() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')) } catch { return {} }
}

// Tema: o nativeTheme decide o prefers-color-scheme da página (o CSS segue) e a cor da barra de título do Windows
const THEMES = ['dark', 'light', 'system']
const themeBackground = () => (nativeTheme.shouldUseDarkColors ? '#0f0f0f' : '#f4f2ee')
function applyTheme() {
  nativeTheme.themeSource = state.prefs.theme
  sendTheme()
}
function sendTheme() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  state.mainWindow.setBackgroundColor(themeBackground())
  state.mainWindow.webContents.send('theme:changed', { dark: nativeTheme.shouldUseDarkColors })
}
// "Seguir o Windows": o Windows trocou de claro/escuro com o app aberto
nativeTheme.on('updated', sendTheme)
ipcMain.handle('theme:get', () => ({ dark: nativeTheme.shouldUseDarkColors }))

function loadPrefs() {
  const s = readSettingsFile()
  state.prefs = {
    closeToTray: !!s.closeToTray,
    openAtLogin: !!s.openAtLogin,
    autoBackup: s.autoBackup !== false, // ligado por padrão
    backupDir: typeof s.backupDir === 'string' && s.backupDir ? s.backupDir : null,
    lastBackupAt: typeof s.lastBackupAt === 'string' ? s.lastBackupAt : null,
    theme: THEMES.includes(s.theme) ? s.theme : 'dark', // escuro continua o padrão de quem já usava
  }
  applyTheme()
}

ipcMain.handle('prefs:get', () => ({ ...state.prefs, canOpenAtLogin: app.isPackaged }))

function savePrefs() {
  const p = path.join(app.getPath('userData'), 'settings.json')
  fs.writeFileSync(p, JSON.stringify({ ...readSettingsFile(), ...state.prefs }, null, 2))
}

ipcMain.handle('prefs:set', (_, patch) => {
  const next = { ...state.prefs }
  for (const key of ['closeToTray', 'openAtLogin', 'autoBackup']) {
    if (key in (patch || {})) next[key] = !!patch[key]
  }
  if (THEMES.includes(patch?.theme)) next.theme = patch.theme
  state.prefs = next
  savePrefs()
  applyTheme()
  // só no app instalado: em dev registraria o electron.exe do projeto pra abrir com o Windows
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: state.prefs.openAtLogin, args: ['--hidden'] })
  return { ...state.prefs, canOpenAtLogin: app.isPackaged }
})

module.exports = { themeBackground, loadPrefs, savePrefs }
