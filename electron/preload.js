const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Filmes
  getAll:            ()       => ipcRenderer.invoke('db:getAll'),
  insert:            (f)      => ipcRenderer.invoke('db:insert', f),
  update:            (f)      => ipcRenderer.invoke('db:update', f),
  delete:            (id)     => ipcRenderer.invoke('db:delete', id),
  search:            (q)      => ipcRenderer.invoke('db:search', q),
  statsEpisodesByMonth: ()    => ipcRenderer.invoke('stats:episodesByMonth'),

  // OMDb — apiKey omitted: kept only in main process
  omdbSearch:        (p)      => ipcRenderer.invoke('omdb:search', p),
  omdbSearchByTitle: (p)      => ipcRenderer.invoke('omdb:searchByTitle', p),

  // TMDB — apiKey omitted: kept only in main process
  tmdbSearch:        (p)      => ipcRenderer.invoke('tmdb:search', p),
  tmdbDetails:       (p)      => ipcRenderer.invoke('tmdb:details', p),
  tmdbSearchTv:      (p)      => ipcRenderer.invoke('tmdb:searchTv', p),
  tmdbTvDetails:     (p)      => ipcRenderer.invoke('tmdb:tvDetails', p),
  tmdbTvSeasonDetails: (p)    => ipcRenderer.invoke('tmdb:tvSeasonDetails', p),
  tmdbWatchProviders:  (p)    => ipcRenderer.invoke('tmdb:watchProviders', p),
  providersRefreshStale: ()   => ipcRenderer.invoke('providers:refreshStale'),

  // Episódios (acompanhamento por temporada/episódio)
  episodesGetWatched:    (filmeId) => ipcRenderer.invoke('episodes:getWatched', filmeId),
  episodesSetWatched:    (p)       => ipcRenderer.invoke('episodes:setWatched', p),
  episodesSetWatchedBulk: (p)      => ipcRenderer.invoke('episodes:setWatchedBulk', p),
  episodesRefresh:       (p)       => ipcRenderer.invoke('episodes:refresh', p),
  episodesMarkProgress:  (p)       => ipcRenderer.invoke('episodes:markProgress', p),
  episodesGetNextUp:     (p)       => ipcRenderer.invoke('episodes:getNextUp', p),

  // Capas
  saveCover:         (p)      => ipcRenderer.invoke('cover:save', p),
  readCover:         (path)   => ipcRenderer.invoke('cover:read', path),

  // Export
  exportCsv:         (opts)   => ipcRenderer.invoke('export:csv', opts),
  importReadFile:    ()       => ipcRenderer.invoke('import:readFile'),
  tmdbFindByImdb:    (id)     => ipcRenderer.invoke('tmdb:findByImdb', id),
  exportXlsx:        (opts)   => ipcRenderer.invoke('export:xlsx', opts),
  exportSiteJson:    (opts)   => ipcRenderer.invoke('export:siteJson', opts),

  // Settings
  getSettings:       ()       => ipcRenderer.invoke('settings:get'),
  saveSettings:      (data)   => ipcRenderer.invoke('settings:save', data),

  // Backup
  backupCreate:      ()       => ipcRenderer.invoke('backup:create'),
  backupRestore:     ()       => ipcRenderer.invoke('backup:restore'),

  // Coleções
  colecoesGetAll:      ()       => ipcRenderer.invoke('colecoes:getAll'),
  colecoesInsert:      (name)   => ipcRenderer.invoke('colecoes:insert', name),
  colecoesRename:      (p)      => ipcRenderer.invoke('colecoes:rename', p),
  colecoesDelete:      (id)     => ipcRenderer.invoke('colecoes:delete', id),
  colecoesGetFilmeIds: (id)     => ipcRenderer.invoke('colecoes:getFilmeIds', id),
  colecoesGetByFilme:  (id)     => ipcRenderer.invoke('colecoes:getByFilme', id),
  colecoesSetForFilme: (p)      => ipcRenderer.invoke('colecoes:setForFilme', p),

  // Tags
  tagsGetAll:          ()       => ipcRenderer.invoke('tags:getAll'),
  tagsInsert:          (name)   => ipcRenderer.invoke('tags:insert', name),
  tagsDelete:          (id)     => ipcRenderer.invoke('tags:delete', id),
  tagsGetFilmeIds:     (id)     => ipcRenderer.invoke('tags:getFilmeIds', id),
  tagsGetByFilme:      (id)     => ipcRenderer.invoke('tags:getByFilme', id),
  tagsSetForFilme:     (p)      => ipcRenderer.invoke('tags:setForFilme', p),

  // Segundo plano (bandeja, iniciar com o Windows) e checagem diária de episódios
  prefsGet:          ()       => ipcRenderer.invoke('prefs:get'),
  prefsSet:          (p)      => ipcRenderer.invoke('prefs:set', p),
  appShow:           ()       => ipcRenderer.invoke('app:show'),
  episodesRefreshStale: ()    => ipcRenderer.invoke('episodes:refreshStale'),

  // Versão e atualização automática
  appGetVersion:     ()       => ipcRenderer.invoke('app:getVersion'),
  updaterGetStatus:  ()       => ipcRenderer.invoke('updater:getStatus'),
  updaterCheck:      ()       => ipcRenderer.invoke('updater:check'),
  updaterInstall:    ()       => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (cb) => {
    const listener = (_e, status) => cb(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },

  // Shell — allowlist enforced in main process
  openExternal:      (url)    => ipcRenderer.invoke('shell:openExternal', url),

  // MAL
  malStartAuth:      ()       => ipcRenderer.invoke('mal:startAuth'),
  malExchangeCode:   (p)      => ipcRenderer.invoke('mal:exchangeCode', p),
  malSearch:         (p)      => ipcRenderer.invoke('mal:search', p),
  malGetAnimeList:   (p)      => ipcRenderer.invoke('mal:getAnimeList', p),
  malUpdateAnime:    (p)      => ipcRenderer.invoke('mal:updateAnime', p),
  malGetStatus:      ()       => ipcRenderer.invoke('mal:getStatus'),
  malSavePoster:     (p)      => ipcRenderer.invoke('mal:savePoster', p),
  malSaveCache:      (list)   => ipcRenderer.invoke('mal:saveCache', list),
  malLoadCache:      ()       => ipcRenderer.invoke('mal:loadCache'),
  malDisconnect:     ()       => ipcRenderer.invoke('mal:disconnect'),
  exportMalJson:     (p)      => ipcRenderer.invoke('export:malJson', p),

  // Listener para o callback OAuth2
  onMalCallback: (cb) => {
    ipcRenderer.on('mal:oauth-callback', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('mal:oauth-callback')
  },
})
