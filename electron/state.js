// Estado compartilhado entre os módulos do processo principal.
// São valores que mais de um módulo lê e troca (ex: o backup restaurado reabre o banco e zera as chaves),
// por isso ficam num objeto só em vez de variáveis soltas em cada arquivo.
module.exports = {
  mainWindow: null,
  db: null,
  isQuitting: false,
  prefs: { closeToTray: false, openAtLogin: false, autoBackup: true, theme: 'dark' },
  // chaves de API: só no processo principal, nunca atravessam o IPC
  keys: { omdb: '', tmdb: '' },
  // login do MyAnimeList (epoch ms na expiração)
  mal: { clientId: '', accessToken: '', refreshToken: '', tokenExpiry: 0 },
}
