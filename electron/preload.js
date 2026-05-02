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
})
