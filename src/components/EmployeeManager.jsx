import React, { useState } from 'react';
import {
  addEmployee,
  removeEmployee,
  updateEmployeePermissions,
  linkEmployeeEmail,
} from '../hooks/useCompany';
import { sendInviteEmail } from '../utils/email';
import { useInviteStatuses } from '../hooks/useMembership';

const PERMISSIONS = [
  { key: 'canAddEvents',      label: 'Events' },
  { key: 'canCreateInvoices', label: 'Invoices' },
];

export default function TeamPage({ company, user, onClose }) {
  const [newName, setNewName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const inviteStatuses = useInviteStatuses(company.id, company.employees);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2800);
  }

  async function handleAdd(e) {
    e?.preventDefault();
    const v = newName.trim();
    if (!v) return;
    if (company.employees.find((emp) => emp.name === v)) {
      setAddError('Already on the team.');
      return;
    }
    setAddError(null);
    setAddBusy(true);
    try {
      await addEmployee(company.id, { name: v });
      setNewName('');
    } catch (err) {
      setAddError(err.message || 'Could not add member.');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleRemove(emp) {
    try {
      await removeEmployee(company.id, emp);
    } catch (err) {
      setError(err.message || 'Could not remove member.');
    }
  }

  async function handlePermToggle(empName, key, value) {
    try {
      await updateEmployeePermissions(company.id, empName, { [key]: value });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLinkEmail(emp, email) {
    try {
      await linkEmployeeEmail(company.id, emp.name, email);
      try {
        await sendInviteEmail({
          toEmail: email,
          toName: emp.name,
          companyName: company.name,
          fromName: user.displayName || user.email,
        });
        flash(`Linked and invite sent to ${email}.`);
      } catch (mailErr) {
        console.error('EmailJS send failed:', mailErr);
        setError(`Email linked, but invite failed: ${mailErr.message}`);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Team</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          {error   && <div className="auth-error">{error}</div>}
          {success && <div className="settings-success">{success}</div>}

          {/* Add member */}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input
              className="inv-input"
              style={{ flex: 1 }}
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(null); }}
              placeholder="Add member by name…"
            />
            <button type="submit" className="btn-secondary" disabled={addBusy || !newName.trim()}>
              Add
            </button>
          </form>
          {addError && <div className="hint" style={{ color: 'var(--danger)', marginTop: -8 }}>{addError}</div>}

          {/* Roster */}
          {company.employees.length === 0 ? (
            <div className="hint" style={{ textAlign: 'center', padding: '16px 0' }}>No team members yet.</div>
          ) : (
            <div className="team-table">
              {company.employees.map((emp) => (
                <MemberRow
                  key={emp.name}
                  emp={emp}
                  status={emp.email ? (inviteStatuses[emp.email.toLowerCase()] || 'pending') : null}
                  onPermToggle={handlePermToggle}
                  onRemove={handleRemove}
                  onLinkEmail={handleLinkEmail}
                />
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Member row ───────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  pending:  { label: 'Invite pending', cls: 'emp-status-pending' },
  accepted: { label: 'Member',         cls: 'emp-status-member' },
  declined: { label: 'Declined',       cls: 'emp-status-declined' },
};

function MemberRow({ emp, status, onPermToggle, onRemove, onLinkEmail }) {
  const [selectedPerm, setSelectedPerm] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);

  const activePerms = PERMISSIONS.filter((p) => emp.permissions[p.key]);
  const canAdd = selectedPerm !== '' && !emp.permissions[selectedPerm];

  async function submitLink(e) {
    e?.preventDefault();
    const email = linkEmail.trim().toLowerCase();
    if (!email) return;
    setLinkBusy(true);
    try {
      await onLinkEmail(emp, email);
      setLinking(false);
      setLinkEmail('');
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div className="team-row">
      <div className="team-col-name">
        <span className="emp-item-name">{emp.name}</span>
        {emp.email ? (
          <span className="emp-item-email">
            {emp.email}
            {(() => {
              const s = STATUS_LABELS[status] || STATUS_LABELS.pending;
              return <span className={`emp-status ${s.cls}`}>{s.label}</span>;
            })()}
          </span>
        ) : linking ? (
          <form className="emp-link-row" onSubmit={submitLink}>
            <input
              type="email"
              value={linkEmail}
              onChange={(e) => setLinkEmail(e.target.value)}
              placeholder="Enter email"
              autoFocus
            />
            <button type="submit" className="btn-secondary" disabled={linkBusy} style={{ padding: '4px 10px', fontSize: 12 }}>
              {linkBusy ? '…' : 'Link & invite'}
            </button>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => { setLinking(false); setLinkEmail(''); }}>
              ×
            </button>
          </form>
        ) : (
          <button className="emp-link-btn" onClick={() => setLinking(true)}>
            + Link email
          </button>
        )}
      </div>

      <div className="team-col-perms">
        {/* Active permissions — click × to revoke */}
        {activePerms.map((p) => (
          <button
            key={p.key}
            className="perm-chip perm-chip-on"
            onClick={() => onPermToggle(emp.name, p.key, false)}
            title={`Remove ${p.label} permission`}
          >
            {p.label} ×
          </button>
        ))}

        {/* Add permission controls */}
        <select
          className="perm-select"
          value={selectedPerm}
          onChange={(e) => setSelectedPerm(e.target.value)}
        >
          <option value="">Permission…</option>
          {PERMISSIONS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button
          className="perm-add-btn"
          disabled={!canAdd}
          onClick={() => {
            onPermToggle(emp.name, selectedPerm, true);
            setSelectedPerm('');
          }}
        >
          Add
        </button>
      </div>

      <button
        type="button"
        className="icon-btn"
        onClick={() => onRemove(emp)}
        aria-label={`Remove ${emp.name}`}
        style={{ fontSize: 16, flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
