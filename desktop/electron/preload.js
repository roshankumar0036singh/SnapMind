const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  addWatchFolder: (path) => ipcRenderer.invoke('add-watch-folder', path),
  removeWatchFolder: (path) => ipcRenderer.invoke('remove-watch-folder', path)
});
