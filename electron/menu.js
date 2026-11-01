// Menu da janela
const { app, dialog, shell, Menu } = require('electron')
const state = require('./state')
const { showMainWindow } = require('./window')

// ─── MENU DA JANELA ───────────────────────────────────────────────────────────
// Em português e com as ações do app; o padrão do Electron vinha em inglês, com Reload/DevTools no app instalado
// e um "Help" que levava ao site do Electron. As ações da página vão pelo canal 'menu:action'.

const PROJECT_URL = 'https://github.com/ednelsonsantos/catalogo-filmes'

function sendMenuAction(action) {
  showMainWindow()
  state.mainWindow?.webContents.send('menu:action', action)
}

function buildAppMenu() {
  const act = (id, label, accelerator) => ({ id, label, accelerator, click: () => sendMenuAction(id) })
  const template = [
    {
      label: '&Arquivo',
      submenu: [
        act('add', 'Adicionar título', 'CmdOrCtrl+N'),
        act('import', 'Importar lista…'),
        {
          label: 'Exportar',
          submenu: [act('export:csv', 'CSV'), act('export:xlsx', 'Excel'), act('export:site', 'Site (JSON)')],
        },
        { type: 'separator' },
        act('backup', 'Salvar backup em…'),
        { type: 'separator' },
        act('settings', 'Configurações', 'CmdOrCtrl+,'),
        { type: 'separator' },
        { label: 'Sair', role: 'quit' },
      ],
    },
    {
      label: '&Editar',
      submenu: [
        { label: 'Desfazer', role: 'undo' },
        { label: 'Refazer', role: 'redo' },
        { type: 'separator' },
        { label: 'Recortar', role: 'cut' },
        { label: 'Copiar', role: 'copy' },
        { label: 'Colar', role: 'paste' },
        { label: 'Selecionar tudo', role: 'selectAll' },
      ],
    },
    {
      label: 'E&xibir',
      submenu: [
        act('page:catalog', 'Catálogo', 'CmdOrCtrl+1'),
        act('page:continue', 'Assistindo', 'CmdOrCtrl+2'),
        act('page:stats', 'Estatísticas', 'CmdOrCtrl+3'),
        act('page:animes', 'MyAnimeList', 'CmdOrCtrl+4'),
        { type: 'separator' },
        act('search', 'Buscar no catálogo', 'CmdOrCtrl+F'),
        { type: 'separator' },
        { label: 'Aumentar zoom', role: 'zoomIn' },
        { label: 'Diminuir zoom', role: 'zoomOut' },
        { label: 'Tamanho normal', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tela cheia', role: 'togglefullscreen' },
        // ferramentas de desenvolvimento só fora do app instalado
        ...(app.isPackaged ? [] : [
          { type: 'separator' },
          { label: 'Recarregar', role: 'reload' },
          { label: 'Ferramentas do desenvolvedor', role: 'toggleDevTools' },
        ]),
      ],
    },
    {
      label: 'A&juda',
      submenu: [
        act('check-updates', 'Verificar atualizações'),
        { label: 'Novidades das versões', click: () => shell.openExternal(`${PROJECT_URL}/releases`) },
        { label: 'Página do projeto', click: () => shell.openExternal(PROJECT_URL) },
        { type: 'separator' },
        {
          id: 'about',
          label: 'Sobre o Meu Catálogo',
          click: () => dialog.showMessageBox(state.mainWindow, {
            type: 'info',
            title: 'Sobre o Meu Catálogo',
            message: `Meu Catálogo ${app.getVersion()}`,
            detail: 'Catálogo pessoal de filmes, séries e animes — os dados ficam só no seu computador.\n\nDados de títulos: TMDB e OMDb. Animes: MyAnimeList.',
            buttons: ['OK'],
          }),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

module.exports = { buildAppMenu }
