const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');
// Determine the base directory of this script. In environments where __dirname is unavailable (e.g., ES modules bundled by some tools), fallback to the current working directory.
const appDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

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

const SMARTFLOW_ROOT = path.join(os.homedir(), '.smartflow');
const MEDIA_DIR = path.join(SMARTFLOW_ROOT, 'media');
const TEMP_DIR = path.join(SMARTFLOW_ROOT, 'temp');
const EXPORTS_DIR = path.join(SMARTFLOW_ROOT, 'exports');

// Ensure directory exists
function ensureDirExists() {
  const dirs = [SMARTFLOW_ROOT, MEDIA_DIR, TEMP_DIR, EXPORTS_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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
      preload: path.join(appDir, 'preload.js'),
    },
  });

  const isDev = process.env.NODE_ENV === 'development';

  // Listen to IPC toggle-devtools from preload bridge
  ipcMain.on('toggle-devtools', () => {
    if (win.webContents.isDevToolsOpened()) {
      win.webContents.closeDevTools();
    } else {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

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
    // Load window via custom privileged protocol — use localhost as the host
    // so URL parsing treats the path correctly (not as hostname)
    console.log('[Electron] Loading app://localhost/');
    win.loadURL('app://localhost/').catch(err => {
      console.error('Failed to load app://localhost/. Did you build the web bundle first?', err);
    });
  }

  win.setMenuBarVisibility(false);
}


// IPC Handlers for Local Storage in Windows .exe
ipcMain.handle('save-media-file', async (event, sourcePath) => {
  if (!sourcePath) return '';

  // If it's already a virtual URL we created, return it
  if (sourcePath.startsWith('app://') && sourcePath.includes('/__media__/')) {
    return sourcePath;
  }

  // Clean sourcePath if it starts with file:// or similar
  let cleanPath = sourcePath;
  if (cleanPath.startsWith('file:///')) {
    cleanPath = cleanPath.substring(8);
  } else if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.substring(7);
  }

  // If it's already in our media dir, return it
  if (cleanPath.includes('.smartflow') && cleanPath.includes('media')) {
    const filename = path.basename(cleanPath);
    return `app://localhost/__media__/${filename}`;
  }

  try {
    ensureDirExists();
    const ext = path.extname(cleanPath) || '.jpg';
    const filename = `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const destinationPath = path.join(MEDIA_DIR, filename);

    // Copy file
    fs.copyFileSync(cleanPath, destinationPath);
    console.log(`💾 Saved desktop media file: ${destinationPath}`);
    return `app://localhost/__media__/${filename}`;
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

ipcMain.handle('get-folders-breakdown', async () => {
  try {
    ensureDirExists();
    const folders = [
      { name: 'Media Library', path: MEDIA_DIR },
      { name: 'Temporary Cache', path: TEMP_DIR },
      { name: 'Exported Backups', path: EXPORTS_DIR },
    ];
    const breakdown = [];
    for (const folder of folders) {
      if (!fs.existsSync(folder.path)) {
        breakdown.push({ name: folder.name, path: folder.path, sizeBytes: 0, fileCount: 0 });
        continue;
      }
      const files = fs.readdirSync(folder.path);
      let sizeBytes = 0;
      let fileCount = 0;
      for (const file of files) {
        const filePath = path.join(folder.path, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          sizeBytes += stat.size;
          fileCount += 1;
        }
      }
      breakdown.push({ name: folder.name, path: folder.path, sizeBytes, fileCount });
    }
    return breakdown;
  } catch (error) {
    console.warn('Failed to get folders breakdown:', error);
    return [];
  }
});

ipcMain.handle('clear-specific-folder', async (event, folderPath) => {
  try {
    if (!folderPath || !folderPath.includes('.smartflow')) return false;
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        fs.unlinkSync(filePath);
      }
    }
    return true;
  } catch (error) {
    console.warn(`Failed to clear folder ${folderPath}:`, error);
    return false;
  }
});

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

app.whenReady().then(() => {
  // Define custom app:// protocol handler
  protocol.handle('app', (request) => {
    const reqUrl = new URL(request.url);
    let urlPath = decodeURIComponent(reqUrl.pathname);
    
    // Default to index.html if pointing to root
    if (urlPath === '' || urlPath === '/') {
      urlPath = '/index.html';
    }

    // Serve local media requests from ~/.smartflow/media/ folder
    if (urlPath.startsWith('/__media__/')) {
      const filename = urlPath.slice('/__media__/'.length);
      const absolutePath = path.normalize(path.join(MEDIA_DIR, filename));
      
      // Security check: ensure file resolves inside the MEDIA_DIR folder bounds
      if (!absolutePath.startsWith(MEDIA_DIR)) {
        return new Response('Access Denied', { status: 403 });
      }

      if (!fs.existsSync(absolutePath)) {
        return new Response('Not Found', { status: 404 });
      }

      const mimeType = getMimeType(absolutePath);
      return new Response(fs.createReadStream(absolutePath), {
        headers: { 'Content-Type': mimeType }
      });
    }

    // Remove leading slash for path.join
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const absolutePath = path.normalize(path.join(appDir, '../dist', relativePath));
    
    // Security check: ensure file resolves inside the dist folder bounds
    const distPath = path.normalize(path.join(appDir, '../dist'));
    if (!absolutePath.startsWith(distPath)) {
      return new Response('Access Denied', { status: 403 });
    }

    if (!fs.existsSync(absolutePath)) {
      return new Response('Not Found', { status: 404 });
    }

    const mimeType = getMimeType(absolutePath);
    return new Response(fs.createReadStream(absolutePath), {
      headers: { 'Content-Type': mimeType }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
