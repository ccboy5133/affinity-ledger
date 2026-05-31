const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledger', {
  signInWithGoogle: (creds) => ipcRenderer.invoke('auth:google-signin', creds),
  exportInvoicePdf: (payload) => ipcRenderer.invoke('invoice:export-pdf', payload),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  platform: process.platform,
  arch: process.arch,
});
