import React, { useState } from 'react';
import { signOut } from '../firebase';
import { acceptInvitation, declineInvitation } from '../hooks/useMembership';
import { createCompany } from '../hooks/useCompany';
import { normalizeEmployee } from '../hooks/useMembership';

export default function CompanySelector({ user, memberships, pendingInvites, onSelect, onInviteAccepted }) {
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [busy, setBusy] = useState(null);  // companyId or 'create' when loading
  const [error, setError] = useState(null);

  // ── Create company inline ─────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [employees, setEmployees] = useState([]);

  function addEmp(e) {
    e?.preventDefault();
    const name = empName.trim();
    if (!name || employees.find((e) => e.name === name)) return;
    setEmployees([...employees, { name, email: empEmail.trim().toLowerCase(), uid: null }]);
    setEmpName(''); setEmpEmail('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const companyId = await createCompany(user.uid, { name: companyName, employees });
      onSelect(companyId);
    } catch (err) {
      setError(err.message || 'Could not create company.');
      setBusy(null);
    }
  }

  async function handleAccept(invite) {
    setBusy(invite.companyId);
    setError(null);
    try {
      await acceptInvitation(user.uid, invite, user.email);
      onInviteAccepted();
      onSelect(invite.companyId);
    } catch (err) {
      setError(err.message || 'Could not accept invite.');
      setBusy(null);
    }
  }

  async function handleDecline(invite) {
    setBusy(invite.companyId + '-decline');
    try {
      await declineInvitation(user.email, invite.companyId);
      onInviteAccepted(); // refreshes invite list
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const hasContent = memberships.length > 0 || pendingInvites.length > 0;

  return (
    <div className="selector-screen">
      <button className="splash-signout" onClick={() => signOut()}>Sign out</button>

      <div className="selector-card">
        <div className="selector-brand">Affinity Ledger</div>
        <div className="selector-sub">{user.email}</div>

        {view === 'list' && (
          <>
            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <div className="selector-section">
                <div className="selector-section-title">Pending invites</div>
                {pendingInvites.map((inv) => (
                  <div key={inv.companyId} className="selector-invite">
                    <div className="selector-item-info">
                      <div className="selector-item-name">{inv.companyName}</div>
                      <div className="selector-item-role">invited as {inv.name}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-ghost"
                        onClick={() => handleDecline(inv)}
                        disabled={!!busy}
                      >
                        Decline
                      </button>
                      <button
                        className="btn-primary"
                        onClick={() => handleAccept(inv)}
                        disabled={!!busy}
                      >
                        {busy === inv.companyId ? 'Joining…' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Existing companies */}
            {memberships.length > 0 && (
              <div className="selector-section">
                <div className="selector-section-title">Your companies</div>
                {memberships.map((m) => (
                  <button
                    key={m.companyId}
                    className="selector-item"
                    onClick={() => onSelect(m.companyId)}
                    disabled={!!busy}
                  >
                    <div className="selector-item-avatar">
                      {(m.companyName || '?')[0].toUpperCase()}
                    </div>
                    <div className="selector-item-info">
                      <div className="selector-item-name">{m.companyName}</div>
                      <div className="selector-item-role">{m.role}</div>
                    </div>
                    <div className="selector-item-arrow">›</div>
                  </button>
                ))}
              </div>
            )}

            {!hasContent && (
              <div className="selector-empty">
                You're not part of any company yet. Create one to get started, or wait for an invite from your employer.
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="btn-primary selector-create-btn" onClick={() => setView('create')}>
              + Create new company
            </button>
          </>
        )}

        {view === 'create' && (
          <form onSubmit={handleCreate}>
            <div className="selector-section-title" style={{ marginBottom: 16 }}>New company</div>

            <label className="field" style={{ marginBottom: 12 }}>
              <span>Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Ellampally Encore"
                autoFocus
              />
            </label>

            <div className="field" style={{ marginBottom: 12 }}>
              <span>Add employees (optional)</span>
              <div className="emp-grid" style={{ marginTop: 6 }}>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmp(); } }}
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmp(); } }}
                  placeholder="Email (for invite)"
                />
                <button type="button" className="btn-secondary" onClick={addEmp}>Add</button>
              </div>
              {employees.length > 0 && (
                <div className="emp-list" style={{ marginTop: 8 }}>
                  {employees.map((emp) => (
                    <div key={emp.name} className="emp-item">
                      <div className="emp-item-info">
                        <span className="emp-item-name">{emp.name}</span>
                        {emp.email && <span className="emp-item-email">{emp.email}</span>}
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setEmployees(employees.filter((e) => e.name !== emp.name))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setView('list'); setError(null); }}
                disabled={!!busy}
              >
                {hasContent ? 'Back' : 'Cancel'}
              </button>
              <button type="submit" className="btn-primary" disabled={!!busy || !companyName.trim()}>
                {busy === 'create' ? 'Creating…' : 'Create company'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
