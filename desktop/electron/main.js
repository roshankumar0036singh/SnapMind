const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, dialog } = require('electron');
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
