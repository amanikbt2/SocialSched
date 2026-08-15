const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveMediaFile: (sourcePath) => ipcRenderer.invoke('save-media-file', sourcePath),
  getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),
  clearStorage: () => ipcRenderer.invoke('clear-storage'),
});
