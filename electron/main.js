const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'SocialSched',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Check if we are in development mode pointing to local expo server or prod dist files
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL('http://localhost:8085').catch(err => {
      console.error('Failed to load local Expo dev server on port 8085:', err);
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html')).catch(err => {
      console.error('Failed to load dist/index.html. Did you build the web bundle first?', err);
    });
  }

  // Remove menu bar for a cleaner app experience
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
