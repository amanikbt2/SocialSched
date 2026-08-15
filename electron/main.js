const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');

// Register custom 'app' protocol scheme as privileged (required for relative asset paths, Fetch API, and standard CSP behavior)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
]);

const MEDIA_DIR = path.join(os.homedir(), '.smartflow_media');

// Ensure directory exists
function ensureDirExists() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'SocialSched',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';

  // Always open DevTools for debugging (remove once stable)
  win.webContents.openDevTools({ mode: 'detach' });

  // Log renderer console messages to main process stdout
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    console.log(`[Renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Page failed to load: ${errorDescription} (code ${errorCode}) at ${validatedURL}`);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded successfully.');
  });

  if (isDev) {
    win.loadURL('http://localhost:8085').catch(err => {
      console.error('Failed to load local Expo dev server on port 8085:', err);
    });
  } else {
    // Load window via custom privileged protocol
    console.log('[Electron] Loading app://index.html');
    win.loadURL('app://index.html').catch(err => {
      console.error('Failed to load app://index.html. Did you build the web bundle first?', err);
    });
  }

  win.setMenuBarVisibility(false);
}


// IPC Handlers for Local Storage in Windows .exe
ipcMain.handle('save-media-file', async (event, sourcePath) => {
  if (!sourcePath) return '';
  // Clean sourcePath if it starts with file:// or similar
  let cleanPath = sourcePath;
  if (cleanPath.startsWith('file:///')) {
    cleanPath = cleanPath.substring(8);
  } else if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.substring(7);
  }

  // If it's already in our media dir, return it
  if (cleanPath.includes('.smartflow_media')) {
    return sourcePath;
  }

  try {
    ensureDirExists();
    const ext = path.extname(cleanPath) || '.jpg';
    const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destinationPath = path.join(MEDIA_DIR, filename);

    // Copy file
    fs.copyFileSync(cleanPath, destinationPath);
    console.log(`💾 Saved desktop media file: ${destinationPath}`);
    return `file:///${destinationPath.replace(/\\/g, '/')}`;
  } catch (error) {
    console.warn('Failed to copy desktop media file:', error);
    return sourcePath;
  }
});

ipcMain.handle('get-storage-stats', async () => {
  try {
    ensureDirExists();
    const files = fs.readdirSync(MEDIA_DIR);
    let sizeBytes = 0;
    let fileCount = 0;

    for (const file of files) {
      const filePath = path.join(MEDIA_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        sizeBytes += stat.size;
        fileCount += 1;
      }
    }
    return { sizeBytes, fileCount };
  } catch (error) {
    console.warn('Failed to get storage stats:', error);
    return { sizeBytes: 0, fileCount: 0 };
  }
});

ipcMain.handle('clear-storage', async () => {
  try {
    ensureDirExists();
    const files = fs.readdirSync(MEDIA_DIR);
    for (const file of files) {
      const filePath = path.join(MEDIA_DIR, file);
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.warn('Failed to clear storage:', error);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
