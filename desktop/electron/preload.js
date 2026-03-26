const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  onClipboardUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('clipboard-update', subscription);
    return () => ipcRenderer.removeListener('clipboard-update', subscription);
  },
  addWatchFolder: (path) => ipcRenderer.invoke('add-watch-folder', path),
  removeWatchFolder: (path) => ipcRenderer.invoke('remove-watch-folder', path)
});
