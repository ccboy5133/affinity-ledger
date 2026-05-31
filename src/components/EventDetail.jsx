import React, { useState } from 'react';
import { deleteEvent, updateEvent } from '../hooks/useEvents';
import { SalaryBreakdownField } from './AddEventModal.jsx';
import InvoiceModal from './InvoiceModal.jsx';

function todayIso() { return new Date().toISOString().slice(0, 10); }

function fmt(n) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

export default function EventDetail({ companyId, event, company, isOwner, canCreateInvoices, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state — reinitialised each time we enter edit mode via enterEdit()
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editGross, setEditGross] = useState('');
  const [editSavedPct, setEditSavedPct] = useState(30);
  const [editPicked, setEditPicked] = useState([]);
  const [editSplitMode, setEditSplitMode] = useState('even');
  const [editCustomAmounts, setEditCustomAmounts] = useState({});
  const [editNotes, setEditNotes] = useState('');
  const [saveError, setSaveError] = useState(null);

  // View-mode derived values
  const gross = Number(event.grossIncome) || 0;
  const pct = Number(event.savedPct) || 0;
  const reserve = (gross * pct) / 100;
  const salary = gross - reserve;
  const perPerson = event.employees?.length ? salary / event.employees.length : 0;

  // Edit-mode derived values
  const editGrossNum = Number(editGross) || 0;
  const editReserve = (editGrossNum * editSavedPct) / 100;
  const editSalary = editGrossNum - editReserve;
  const editPerPersonEven = editPicked.length > 0 ? editSalary / editPicked.length : 0;
  const editCustomTotal = editPicked.reduce((s, n) => s + (Number(editCustomAmounts[n]) || 0), 0);
  const editCustomRemaining = editSalary - editCustomTotal;

  function enterEdit() {
    setEditName(event.name || '');
    setEditDate(event.date || todayIso());
    setEditGross(String(event.grossIncome || ''));
    setEditSavedPct(Number(event.savedPct) || 30);
    setEditPicked(event.employees || []);
    setEditSplitMode(event.splitMode || 'even');
    setEditCustomAmounts(
      Object.fromEntries((event.salaryBreakdown || []).map((b) => [b.name, String(b.amount)])),
    );
    setEditNotes(event.notes || '');
    setSaveError(null);
    setEditing(true);
  }

  function toggleEditPick(label) {
    setEditPicked((prev) => {
      if (prev.includes(label)) {
        setEditCustomAmounts((ca) => { const n = { ...ca }; delete n[label]; return n; });
        return prev.filter((n) => n !== label);
      }
      return [...prev, label];
    });
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteEvent(companyId, event.id);
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) { setSaveError('Name is required.'); return; }
    if (!(editGrossNum > 0)) { setSaveError('Gross income must be greater than 0.'); return; }
    setSaveError(null);
    setBusy(true);
    const salaryBreakdown = editPicked.map((n) => ({
      name: n,
      amount: editSplitMode === 'even' ? editSalary / editPicked.length : Number(editCustomAmounts[n]) || 0,
    }));
    try {
      await updateEvent(companyId, event.id, {
        name: editName,
        date: editDate,
        grossIncome: editGrossNum,
        savedPct: editSavedPct,
        employees: editPicked,
        salaryBreakdown,
        splitMode: editSplitMode,
        notes: editNotes,
      });
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? 'Edit event' : event.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {editing ? (
          <div className="modal-body">
            <label className="field">
              <span>Event name</span>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Gross income</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={editGross}
                  onChange={(e) => setEditGross(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            <label className="field">
              <span>Split — {editSavedPct}% to reserve</span>
              <input
                type="range"
                min="0"
                max="100"
                value={editSavedPct}
                onChange={(e) => setEditSavedPct(Number(e.target.value))}
              />
              <div className="split-preview">
                <div><strong>{fmt(editReserve)}</strong> saved</div>
                <div><strong>{fmt(editSalary)}</strong> to salary</div>
              </div>
            </label>

            {company.employees?.length > 0 && (
              <div className="field">
                <span>Who worked it</span>
                <div className="chip-row">
                  {company.employees.map((emp) => {
                    const label = typeof emp === 'string' ? emp : emp.name;
                    return (
                      <button
                        type="button"
                        key={label}
                        className={`chip chip-pick ${editPicked.includes(label) ? 'chip-on' : ''}`}
                        onClick={() => toggleEditPick(label)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {editPicked.length > 0 && (
              <SalaryBreakdownField
                picked={editPicked}
                salary={editSalary}
                splitMode={editSplitMode}
                setSplitMode={setEditSplitMode}
                customAmounts={editCustomAmounts}
                setCustomAmounts={setEditCustomAmounts}
                perPersonEven={editPerPersonEven}
                customRemaining={editCustomRemaining}
              />
            )}

            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Anything worth remembering"
              />
            </label>
          </div>
        ) : (
          <div className="modal-body">
            <div className="detail-date">{fmtDate(event.date)}</div>

            <div className="detail-grid">
              <DetailCard label="Gross income" value={fmt(gross)} />
              <DetailCard label={`To reserve (${pct}%)`} value={fmt(reserve)} accent="emerald" />
              <DetailCard label="Salary pool" value={fmt(salary)} accent="amber" />
              {!event.salaryBreakdown?.length && event.employees?.length > 0 && (
                <DetailCard label="Per person" value={fmt(perPerson)} accent="violet" />
              )}
            </div>

            {event.salaryBreakdown?.length > 0 && (
              <div className="field">
                <span>Pay breakdown</span>
                <div className="salary-breakdown">
                  {event.salaryBreakdown.map(({ name, amount }) => (
                    <div key={name} className="salary-row">
                      <span className="salary-name">{name}</span>
                      <span className="salary-amount">{fmt(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.employees?.length > 0 && !event.salaryBreakdown?.length && (
              <div className="field">
                <span>Crew</span>
                <div className="chip-row">
                  {event.employees.map((n) => (
                    <span key={n} className="chip chip-static">{n}</span>
                  ))}
                </div>
              </div>
            )}

            {event.notes && (
              <div className="field">
                <span>Notes</span>
                <div className="notes-block">{event.notes}</div>
              </div>
            )}
          </div>
        )}

        <div className="modal-foot">
          {editing ? (
            <>
              {saveError && <span className="inv-error">{saveError}</span>}
              <button className="btn-ghost" onClick={() => { setEditing(false); setSaveError(null); }} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : confirming ? (
            <>
              <span className="confirm-text">Delete this event?</span>
              <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              {isOwner && (
                <>
                  <button className="btn-ghost" onClick={() => setConfirming(true)}>Delete</button>
                  <button className="btn-ghost" onClick={enterEdit}>Edit</button>
                </>
              )}
              {canCreateInvoices && (
                <button className="btn-secondary" onClick={() => setShowInvoice(true)}>
                  Create invoice
                </button>
              )}
              <button className="btn-primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>

      {showInvoice && (
        <InvoiceModal event={event} company={company} onClose={() => setShowInvoice(false)} />
      )}
    </div>
  );
}

function DetailCard({ label, value, accent }) {
  return (
    <div className={`detail-card ${accent ? `kpi-${accent}` : ''}`}>
      <div className="detail-card-label">{label}</div>
      <div className="detail-card-value">{value}</div>
    </div>
  );
}
