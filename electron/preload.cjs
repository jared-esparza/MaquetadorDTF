const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  getPreferences: () => ipcRenderer.invoke('desktop:preferences:get'),
  updatePreferences: patch => ipcRenderer.invoke('desktop:preferences:update', patch),
  savePdf: request => ipcRenderer.invoke('desktop:pdf:save', request),
  saveRaster: request => ipcRenderer.invoke('desktop:raster:save', request),
  getUpdateState: () => ipcRenderer.invoke('desktop:updates:get'),
  setUpdateMode: mode => ipcRenderer.invoke('desktop:updates:mode', mode),
  checkUpdates: () => ipcRenderer.invoke('desktop:updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('desktop:updates:download'),
  installUpdate: () => ipcRenderer.invoke('desktop:updates:install'),
  openReleases: () => ipcRenderer.invoke('desktop:updates:releases'),
  onUpdateState: callback => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('desktop:updates:state', handler);
    return () => ipcRenderer.removeListener('desktop:updates:state', handler);
  },
  showExportFolder: () => ipcRenderer.invoke('desktop:pdf:folder'),
  setDocumentState: state => ipcRenderer.send('desktop:document:state', state),
  showHelp: topic => ipcRenderer.invoke('desktop:help', topic),
  onHelp: callback => {
    const handler = (_event, topic) => callback(topic);
    ipcRenderer.on('desktop:help:show', handler);
    return () => ipcRenderer.removeListener('desktop:help:show', handler);
  },
}));
