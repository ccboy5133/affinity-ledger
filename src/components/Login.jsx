import React, { useState } from 'react';
import { googleOAuth, signInWithGoogleIdToken } from '../firebase';

export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleGoogleSignIn() {
    setError(null);
    setBusy(true);
    try {
      if (!window.ledger?.signInWithGoogle) {
        throw new Error('Electron bridge not available — run via `npm run dev`.');
      }
      const { idToken } = await window.ledger.signInWithGoogle(googleOAuth);
      if (!idToken) throw new Error('No ID token returned from Google.');
      await signInWithGoogleIdToken(idToken);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">Affinity Ledger</div>
        <div className="auth-tag">Track gigs. Track reserves. Track who showed up.</div>

        <button className="btn-google" onClick={handleGoogleSignIn} disabled={busy}>
          <GoogleMark /> {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-foot">
          Need Apple SSO? Requires a paid Apple Developer account — using Google for now.
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.96L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
  );
}
