import React, { useState, useEffect } from 'react';
import { saveInvoiceInfo, updateCompanyName, saveCompanyFlags } from '../hooks/useCompany';
import { fetchUpdateStatus } from '../hooks/useUpdateCheck';

export default function Settings({ company, onClose }) {
  const [tab, setTab] = useState('invoice');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            {[
              { id: 'invoice', label: 'Invoice info' },
              { id: 'features', label: 'Features' },
              { id: 'company', label: 'Company' },
              { id: 'about', label: 'About' },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`settings-tab ${tab === id ? 'settings-tab-on' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="settings-body">
            {tab === 'invoice'  && <InvoiceTab  company={company} />}
            {tab === 'features' && <FeaturesTab company={company} />}
            {tab === 'company'  && <CompanyTab  company={company} />}
            {tab === 'about'    && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── About tab ────────────────────────────────────────────────────────────────

function AboutTab() {
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState({ state: 'idle' });

  useEffect(() => {
    window.ledger?.getVersion?.().then(setVersion).catch(() => {});
  }, []);

  async function check() {
    setStatus({ state: 'checking' });
    const result = await fetchUpdateStatus();
    setStatus(result);
  }

  return (
    <div>
      <div className="settings-section-title">About</div>
      <div className="settings-hint">
        Affinity Ledger{version ? ` — version ${version}` : ''}
        {window.ledger?.arch ? ` (${window.ledger.arch})` : ''}
      </div>

      <div className="feature-row" style={{ alignItems: 'center' }}>
        <div className="feature-row-text">
          <div className="feature-row-title">Software updates</div>
          <div className="feature-row-desc">
            {status.state === 'idle' && 'Check whether a newer version is available for your Mac.'}
            {status.state === 'checking' && 'Checking for updates…'}
            {status.state === 'current' && `You're up to date (version ${status.current}).`}
            {status.state === 'available' && `Version ${status.latest} is available — you have ${status.current}.`}
            {status.state === 'error' && status.message}
          </div>
        </div>
        {status.state === 'available' && (status.assetUrl || status.releaseUrl) ? (
          <a
            className="btn-primary"
            href={status.assetUrl || status.releaseUrl}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            Download {status.latest}
          </a>
        ) : (
          <button className="btn-secondary" onClick={check} disabled={status.state === 'checking'}>
            {status.state === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Features tab ─────────────────────────────────────────────────────────────

function FeaturesTab({ company }) {
  const [tabsEnabled, setTabsEnabled] = useState(!!company.tabsEnabled);
  const [error, setError] = useState(null);

  async function toggleTabs() {
    const next = !tabsEnabled;
    setTabsEnabled(next);
    setError(null);
    try {
      await saveCompanyFlags(company.id, { tabsEnabled: next });
    } catch (err) {
      setError(err.message);
      setTabsEnabled(!next);
    }
  }

  return (
    <div>
      <div className="settings-section-title">Features</div>
      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="feature-row">
        <div className="feature-row-text">
          <div className="feature-row-title">Tabs</div>
          <div className="feature-row-desc">
            Track shared group expenses (e.g. a trip). Each person owes their own items.
            Close a tab to start tracking repayments until everyone has paid back.
          </div>
        </div>
        <span
          className={`perm-toggle ${tabsEnabled ? 'perm-toggle-on' : ''}`}
          onClick={toggleTabs}
          role="switch"
          aria-checked={tabsEnabled}
        >
          <span className="perm-toggle-thumb" />
        </span>
      </div>
    </div>
  );
}

// ─── Invoice tab ──────────────────────────────────────────────────────────────

function InvoiceTab({ company }) {
  const [invInfo, setInvInfo] = useState({
    address: company.invoiceInfo?.address || '',
    phone:   company.invoiceInfo?.phone   || '',
    email:   company.invoiceInfo?.email   || '',
    terms:   company.invoiceInfo?.terms   || '',
  });
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveInvoiceInfo(company.id, invInfo);
      setSuccess('Saved.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="settings-section-title">Invoice header info</div>
      <div className="settings-hint">Appears under your company name on every invoice.</div>
      {error   && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="settings-success">{success}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label className="field">
          <span>Address</span>
          <input type="text" value={invInfo.address} onChange={(e) => setInvInfo({ ...invInfo, address: e.target.value })} placeholder="123 Main St, City, State" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Phone</span>
            <input type="text" value={invInfo.phone} onChange={(e) => setInvInfo({ ...invInfo, phone: e.target.value })} placeholder="(555) 000-0000" />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={invInfo.email} onChange={(e) => setInvInfo({ ...invInfo, email: e.target.value })} placeholder="billing@example.com" />
          </label>
        </div>
        <label className="field">
          <span>Payment terms</span>
          <input type="text" value={invInfo.terms} onChange={(e) => setInvInfo({ ...invInfo, terms: e.target.value })} placeholder="e.g. Due upon receipt, Venmo @..." />
        </label>
      </div>
      <div style={{ marginTop: 16 }}>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

// ─── Company tab ──────────────────────────────────────────────────────────────

function CompanyTab({ company }) {
  const [name, setName]       = useState(company.name);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateCompanyName(company.id, name);
      setSuccess('Saved.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="settings-section-title">Company details</div>
      {error   && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="settings-success">{success}</div>}
      <label className="field">
        <span>Company name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div style={{ marginTop: 12 }}>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
