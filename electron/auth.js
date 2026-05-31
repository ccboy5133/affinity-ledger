const { BrowserWindow } = require('electron');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function startGoogleOAuth({ clientId, clientSecret, parent }) {
  // Start loopback server first to grab a free port.
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const state = base64url(crypto.randomBytes(16));
  const { verifier, challenge } = makePkce();

  const codePromise = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        if (url.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#0b0d12;color:#e6e9ef;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>${error ? 'Sign-in failed' : 'Signed in'}</h2><p>You can close this window and return to Affinity Ledger.</p></div></body></html>`);

        if (error) return reject(new Error(error));
        if (returnedState !== state) return reject(new Error('OAuth state mismatch'));
        if (!code) return reject(new Error('No authorization code received'));
        resolve(code);
      } catch (e) {
        reject(e);
      }
    });
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  const authWindow = new BrowserWindow({
    width: 520,
    height: 720,
    parent,
    modal: false,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await authWindow.loadURL(authUrl.toString());

  let code;
  try {
    code = await Promise.race([
      codePromise,
      new Promise((_, reject) =>
        authWindow.on('closed', () => reject(new Error('Sign-in window closed'))),
      ),
    ]);
  } finally {
    server.close();
    if (!authWindow.isDestroyed()) authWindow.close();
  }

  // Exchange code for tokens.
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`);
  }
  const tokens = await tokenRes.json();
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
  };
}

module.exports = { startGoogleOAuth };
