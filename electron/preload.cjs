const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  getPreferences: () => ipcRenderer.invoke('desktop:preferences:get'),
  updatePreferences: patch => ipcRenderer.invoke('desktop:preferences:update', patch),
  savePdf: request => ipcRenderer.invoke('desktop:pdf:save', request),
  showExportFolder: () => ipcRenderer.invoke('desktop:pdf:folder'),
  setDocumentState: state => ipcRenderer.send('desktop:document:state', state),
  showHelp: topic => ipcRenderer.invoke('desktop:help', topic),
  onHelp: callback => {
    const handler = (_event, topic) => callback(topic);
    ipcRenderer.on('desktop:help:show', handler);
    return () => ipcRenderer.removeListener('desktop:help:show', handler);
  },
}));
