// Janela principal (com a CSP do app instalado) e ícone na bandeja
const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const state = require('./state')
const { themeBackground } = require('./prefs')

// ─── WINDOW ───────────────────────────────────────────────────────────────────

function createWindow() {
  state.mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Meu Catálogo',
    icon: path.join(__dirname, '../icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: themeBackground(),
    show: false,
  })

  // Content Security Policy — só aplicado em produção; dev usa o Vite sem restrições
  if (app.isPackaged) {
    state.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self'",
              "script-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://image.tmdb.org https://img.omdbapi.com https://m.media-amazon.com",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; ')
          ],
        },
      })
    })
  }

  // Block navigation to external URLs
  state.mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsed = new URL(url)
    const isDev = !app.isPackaged
    const allowedOrigins = isDev
      ? ['http://localhost:', 'http://127.0.0.1:']
      : [`file://${path.join(__dirname, '../dist')}`]
    const allowed = allowedOrigins.some(o => url.startsWith(o))
    if (!allowed) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  state.mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const isDev = !app.isPackaged

  if (isDev) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
    const devUrl = process.env.VITE_DEV_URL || 'http://localhost:5173'
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(devUrl)) {
      throw new Error(`Invalid VITE_DEV_URL: ${devUrl}`)
    }
    state.mainWindow.loadURL(devUrl).catch(err => console.error('loadURL error:', err))
  } else {
    state.mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // iniciado com o Windows ("--hidden"): fica só na bandeja até o usuário abrir
  const startHidden = process.argv.includes('--hidden')
  state.mainWindow.once('ready-to-show', () => { if (startHidden) ensureTray(); else state.mainWindow.show() })

  state.mainWindow.on('close', (e) => {
    if (state.prefs.closeToTray && !state.isQuitting) {
      e.preventDefault()
      state.mainWindow.hide()
      ensureTray()
    }
  })
}

let _tray = null
function showMainWindow() {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  if (state.mainWindow.isMinimized()) state.mainWindow.restore()
  state.mainWindow.show()
  state.mainWindow.focus()
}
function ensureTray() {
  if (_tray) return
  const icon = nativeImage.createFromPath(path.join(__dirname, '../icon.png')).resize({ width: 16, height: 16 })
  _tray = new Tray(icon)
  _tray.setToolTip('Meu Catálogo')
  _tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Meu Catálogo', click: showMainWindow },
    { type: 'separator' },
    { label: 'Sair', click: () => { state.isQuitting = true; app.quit() } },
  ]))
  _tray.on('click', showMainWindow)
}
ipcMain.handle('app:show', () => showMainWindow())

module.exports = { showMainWindow, createWindow }
