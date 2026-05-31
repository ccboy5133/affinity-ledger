import { useEffect, useState } from 'react';

const RELEASES_API = 'https://api.github.com/repos/ccboy5133/affinity-ledger-downloads/releases/latest';
const RELEASES_PAGE = 'https://github.com/ccboy5133/affinity-ledger-downloads/releases/latest';

function parseVer(v) {
  return String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
}

// Returns 1 if a > b, -1 if a < b, 0 if equal
function cmpVer(a, b) {
  const pa = parseVer(a), pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

// Checks the downloads repo's latest release once on mount. Fails silently
// (e.g. offline) — never blocks or errors the app.
export function useUpdateCheck() {
  const [update, setUpdate] = useState(null); // { version, url } when newer

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (!window.ledger?.getVersion) return;
        const current = await window.ledger.getVersion();
        const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) return;
        const data = await res.json();
        const latest = data.tag_name || data.name;
        if (!cancelled && latest && cmpVer(latest, current) > 0) {
          setUpdate({ version: latest.replace(/^v/i, ''), url: data.html_url || RELEASES_PAGE });
        }
      } catch {
        /* offline or rate-limited — ignore */
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return update;
}
