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
  removeWatchFolder: (path) => ipcRenderer.invoke('remove-watch-folder', path),
  updateWatcherConfig: (config) => ipcRenderer.send('update-watcher-config', config),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  saveSecret: (key, value) => ipcRenderer.invoke('save-secret', { key, value }),
  getSecret: (key) => ipcRenderer.invoke('get-secret', key),
  onDeepLink: (callback) => {
    const subscription = (event, url) => callback(url);
    ipcRenderer.on('deep-link', subscription);
    return () => ipcRenderer.removeListener('deep-link', subscription);
  },
  onVisionSpotlight: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('vision-spotlight', subscription);
    return () => ipcRenderer.removeListener('vision-spotlight', subscription);
  }
});
