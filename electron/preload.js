const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Filmes
  getAll:            ()       => ipcRenderer.invoke('db:getAll'),
  insert:            (f)      => ipcRenderer.invoke('db:insert', f),
  update:            (f)      => ipcRenderer.invoke('db:update', f),
  delete:            (id)     => ipcRenderer.invoke('db:delete', id),
  search:            (q)      => ipcRenderer.invoke('db:search', q),

  // OMDb — apiKey omitted: kept only in main process
  omdbSearch:        (p)      => ipcRenderer.invoke('omdb:search', p),
  omdbSearchByTitle: (p)      => ipcRenderer.invoke('omdb:searchByTitle', p),

  // TMDB — apiKey omitted: kept only in main process
  tmdbSearch:        (p)      => ipcRenderer.invoke('tmdb:search', p),
  tmdbDetails:       (p)      => ipcRenderer.invoke('tmdb:details', p),
  tmdbSearchTv:      (p)      => ipcRenderer.invoke('tmdb:searchTv', p),
  tmdbTvDetails:     (p)      => ipcRenderer.invoke('tmdb:tvDetails', p),

  // Capas
  saveCover:         (p)      => ipcRenderer.invoke('cover:save', p),
  readCover:         (path)   => ipcRenderer.invoke('cover:read', path),

  // Export
  exportCsv:         (opts)   => ipcRenderer.invoke('export:csv', opts),
  exportXlsx:        (opts)   => ipcRenderer.invoke('export:xlsx', opts),
  exportSiteJson:    (opts)   => ipcRenderer.invoke('export:siteJson', opts),

  // Settings
  getSettings:       ()       => ipcRenderer.invoke('settings:get'),
  saveSettings:      (data)   => ipcRenderer.invoke('settings:save', data),

  // Coleções
  colecoesGetAll:      ()       => ipcRenderer.invoke('colecoes:getAll'),
  colecoesInsert:      (name)   => ipcRenderer.invoke('colecoes:insert', name),
  colecoesRename:      (p)      => ipcRenderer.invoke('colecoes:rename', p),
  colecoesDelete:      (id)     => ipcRenderer.invoke('colecoes:delete', id),
  colecoesGetFilmeIds: (id)     => ipcRenderer.invoke('colecoes:getFilmeIds', id),
  colecoesGetByFilme:  (id)     => ipcRenderer.invoke('colecoes:getByFilme', id),
  colecoesSetForFilme: (p)      => ipcRenderer.invoke('colecoes:setForFilme', p),

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
