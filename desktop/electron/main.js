const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, dialog, desktopCapturer } = require('electron');
const path = require('node:path');
const fileWatcher = require('./services/file_watcher');
const clipboardMonitor = require('./services/clipboard_monitor');

let mainWindow;
let tray = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'SnapMind',
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.png'),
    show: false,
    backgroundColor: '#09090b',
  });

  // Start Background Monitors
  // File watcher doesn't need a main window but might emit events
  clipboardMonitor.startClipboardMonitor(mainWindow);

  // In dev mode load from Vite dev server, otherwise load built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle close behavior (minimize to tray)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
  // In a real app we'd catch file not found, but we'll assume it exists if copied
  try {
    tray = new Tray(iconPath);
    tray.setToolTip('SnapMind');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show App', click: () => mainWindow.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }}
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
  } catch(e) {
    console.warn("Tray icon missing, tray disabled.");
  }
}

// ==========================================
// [PROTOCOL] Deep Linking Setup (snapmind://)
// ==========================================
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('snapmind', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('snapmind');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Windows/Linux handler
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
    const url = commandLine.pop();
    if (url && url.startsWith('snapmind://') && mainWindow) {
        mainWindow.webContents.send('deep-link', url);
    }
  });
}

app.on('open-url', (event, url) => {
  // macOS handler
  event.preventDefault();
  app.whenReady().then(() => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('deep-link', url);
    }
  });
});
// ==========================================

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Global Hotkey (F4 + F10 feature requirement)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  // Universal Screen Intelligence (Feature 9)
  globalShortcut.register('CommandOrControl+Alt+S', async () => {
    if (mainWindow) {
      try {
        const sources = await desktopCapturer.getSources({ 
          types: ['screen', 'window'], 
          thumbnailSize: { width: 1920, height: 1080 } 
        });
        if (sources.length > 0) {
          const image = sources[0].thumbnail.toDataURL();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('vision-spotlight', { image });
        }
      } catch (e) {
        console.error('[Vision Shortcut] Error:', e);
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    // Clean up watchers
    fileWatcher.stopAll();
});

// IPC bridging (examples for native integration)
ipcMain.handle('get-version', () => app.getVersion());

// File Watcher IPC
ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SnapMind Backup', extensions: ['json'] }]
    });
    if (result.canceled) return { success: true, data: null };
    return { success: true, data: result.filePaths[0] };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled) return { success: true, data: null };
    return { success: true, data: result.filePaths[0] };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('add-watch-folder', async (event, folderPath) => {
    try {
        fileWatcher.addWatchFolder(folderPath);
        return { success: true, message: `Watching ${folderPath}` };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('remove-watch-folder', async (event, folderPath) => {
    try {
        fileWatcher.removeWatchFolder(folderPath);
        return { success: true, message: `Stopped watching ${folderPath}` };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.on('update-watcher-config', (event, config) => {
    if (config.apiKeys) fileWatcher.setApiKeys(config.apiKeys);
    if (config.backendUrl) fileWatcher.backendUrl = config.backendUrl;
});

// Vision Protocol: Screen Capture
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    if (sources.length > 0) {
      return { success: true, data: sources[0].thumbnail.toDataURL() };
    }
    return { success: false, error: 'No screen sources found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// --- Phase 9: Native Infrastructure & Security (safeStorage) ---
const { safeStorage } = require('electron');
const fs = require('fs');

const SECRETS_PATH = path.join(app.getPath('userData'), 'secrets.enc');

ipcMain.handle('save-secret', async (event, { key, value }) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this platform.');
    }

    let secrets = {};
    if (fs.existsSync(SECRETS_PATH)) {
      const encryptedData = fs.readFileSync(SECRETS_PATH);
      const decryptedData = safeStorage.decryptString(encryptedData);
      secrets = JSON.parse(decryptedData);
    }

    secrets[key] = value;
    const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
    fs.writeFileSync(SECRETS_PATH, encrypted);
    
    return { success: true };
  } catch (e) {
    console.error('[SafeStorage] Save Error:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-secret', async (event, key) => {
  try {
    if (!fs.existsSync(SECRETS_PATH)) return { success: true, value: null };
    if (!safeStorage.isEncryptionAvailable()) {
         return { success: false, error: 'Encryption unavailable' };
    }

    const encryptedData = fs.readFileSync(SECRETS_PATH);
    const decryptedData = safeStorage.decryptString(encryptedData);
    const secrets = JSON.parse(decryptedData);
    
    return { success: true, value: secrets[key] || null };
  } catch (e) {
    console.error('[SafeStorage] Get Error:', e);
    return { success: false, error: e.message };
  }
});
