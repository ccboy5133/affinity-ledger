const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ledger', {
  signInWithGoogle: (creds) => ipcRenderer.invoke('auth:google-signin', creds),
  exportInvoicePdf: (payload) => ipcRenderer.invoke('invoice:export-pdf', payload),
  platform: process.platform,
});
