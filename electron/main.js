const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { startGoogleOAuth } = require('./auth');

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0d12',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
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

// ── App version (for update checks) ───────────────────────────────────────────
ipcMain.handle('app:get-version', () => app.getVersion());

// ── Google OAuth ──────────────────────────────────────────────────────────────
ipcMain.handle('auth:google-signin', async (_event, { clientId, clientSecret }) => {
  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth client credentials. Set VITE_GOOGLE_OAUTH_CLIENT_ID / _SECRET in .env');
  }
  return startGoogleOAuth({ clientId, clientSecret, parent: mainWindow });
});

// ── Invoice: export filled HTML to PDF ───────────────────────────────────────
ipcMain.handle('invoice:export-pdf', async (_event, { html, defaultName }) => {
  // Ask where to save
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save invoice as PDF',
    defaultPath: `${defaultName || 'invoice'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { saved: false };

  // Render in a hidden window and print to PDF
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'Letter',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  win.close();

  fs.writeFileSync(filePath, pdfBuffer);
  return { saved: true, filePath };
});
