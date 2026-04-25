const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getAll:            ()       => ipcRenderer.invoke('db:getAll'),
  insert:            (f)      => ipcRenderer.invoke('db:insert', f),
  update:            (f)      => ipcRenderer.invoke('db:update', f),
  delete:            (id)     => ipcRenderer.invoke('db:delete', id),
  search:            (q)      => ipcRenderer.invoke('db:search', q),
  omdbSearch:        (p)      => ipcRenderer.invoke('omdb:search', p),
  omdbSearchByTitle: (p)      => ipcRenderer.invoke('omdb:searchByTitle', p),
  saveCover:         (p)      => ipcRenderer.invoke('cover:save', p),
  readCover:         (path)   => ipcRenderer.invoke('cover:read', path),
  tmdbSearch:        (p)      => ipcRenderer.invoke('tmdb:search', p),
  tmdbDetails:       (p)      => ipcRenderer.invoke('tmdb:details', p),
  tmdbSearchTv:      (p)      => ipcRenderer.invoke('tmdb:searchTv', p),
  tmdbTvDetails:     (p)      => ipcRenderer.invoke('tmdb:tvDetails', p),
  exportCsv:         ()       => ipcRenderer.invoke('export:csv'),
  exportXlsx:        ()       => ipcRenderer.invoke('export:xlsx'),
  exportSiteJson:    ()       => ipcRenderer.invoke('export:siteJson'),
  getSettings:       ()       => ipcRenderer.invoke('settings:get'),
  saveSettings:      (data)   => ipcRenderer.invoke('settings:save', data),
})
