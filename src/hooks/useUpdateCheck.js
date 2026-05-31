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

// Pick the right installer asset for this platform + CPU architecture.
// macOS arm64 → the *-arm64.dmg, macOS x64 → the .dmg without "arm64",
// Windows → the .exe installer.
function pickAsset(assets, platform, arch) {
  const list = (assets || []).map((a) => ({ name: a.name, url: a.browser_download_url }));
  if (platform === 'win32') {
    return list.find((a) => /\.exe$/i.test(a.name)) || null;
  }
  // darwin
  const dmgs = list.filter((a) => /\.dmg$/i.test(a.name));
  if (arch === 'arm64') {
    return dmgs.find((a) => /arm64/i.test(a.name)) || null;
  }
  // x64 (Intel) → the dmg that is NOT the arm64 one
  return dmgs.find((a) => !/arm64/i.test(a.name)) || null;
}

// One-shot check. Returns a status object; never throws.
export async function fetchUpdateStatus() {
  try {
    if (!window.ledger?.getVersion) {
      return { state: 'error', message: 'Update check unavailable.' };
    }
    const current = await window.ledger.getVersion();
    const platform = window.ledger.platform;
    const arch = window.ledger.arch;

    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { state: 'error', message: `Could not reach update server (${res.status}).`, current };

    const data = await res.json();
    const latest = (data.tag_name || data.name || '').replace(/^v/i, '');
    if (!latest) return { state: 'error', message: 'No releases found.', current };

    if (cmpVer(latest, current) > 0) {
      const asset = pickAsset(data.assets, platform, arch);
      return {
        state: 'available',
        current,
        latest,
        assetUrl: asset?.url || null,
        releaseUrl: data.html_url || RELEASES_PAGE,
      };
    }
    return { state: 'current', current, latest };
  } catch {
    return { state: 'error', message: 'Offline or update check failed.' };
  }
}

// Auto check on mount — used for the header badge. Returns the status object
// only when a newer version is available, otherwise null.
export function useUpdateCheck() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchUpdateStatus().then((s) => {
      if (!cancelled && s.state === 'available') setUpdate(s);
    });
    return () => { cancelled = true; };
  }, []);

  return update;
}
