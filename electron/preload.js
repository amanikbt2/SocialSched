const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),
  isElectron: true,
  saveMediaFile: (sourcePath) => ipcRenderer.invoke('save-media-file', sourcePath),
  getStorageStats: () => ipcRenderer.invoke('get-storage-stats'),
  clearStorage: () => ipcRenderer.invoke('clear-storage'),
  getFoldersBreakdown: () => ipcRenderer.invoke('get-folders-breakdown'),
  clearSpecificFolder: (folderPath) => ipcRenderer.invoke('clear-specific-folder', folderPath),
});
