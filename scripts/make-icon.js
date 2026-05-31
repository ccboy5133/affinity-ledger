// Renders a branded 1024×1024 app icon PNG using the installed Electron,
// then writes build/icon.png. No external deps.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;

// On-palette: charcoal bg, slate inner, muted gold mark.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b232a"/>
      <stop offset="1" stop-color="#121212"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8bd7a"/>
      <stop offset="1" stop-color="#C6A75E"/>
    </linearGradient>
  </defs>
  <rect x="64" y="64" width="896" height="896" rx="208" fill="url(#bg)" stroke="#2E3A45" stroke-width="6"/>
  <text x="512" y="600" font-family="-apple-system, Helvetica, Arial, sans-serif"
        font-size="560" font-weight="700" fill="url(#gold)"
        text-anchor="middle" letter-spacing="-20">A</text>
  <rect x="320" y="690" width="384" height="26" rx="13" fill="url(#gold)" opacity="0.9"/>
  <rect x="360" y="744" width="304" height="20" rx="10" fill="#2E3A45"/>
</svg>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}</style></head>
<body>${svg}</body></html>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE, height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.capturePage();
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'icon.png'), img.toPNG());
  console.log('Wrote build/icon.png');
  app.quit();
});
