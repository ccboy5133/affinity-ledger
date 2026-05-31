import React, { useState } from 'react';
import { deleteExpense, updateExpense } from '../hooks/useExpenses';

const CATEGORIES = ['Equipment', 'Transport', 'Venue', 'Marketing', 'Food & Drink', 'Staffing', 'Other'];

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

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function ExpenseDetail({ companyId, expense, isOwner, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saveError, setSaveError] = useState(null);

  function enterEdit() {
    setEditName(expense.name || '');
    setEditDate(expense.date || todayIso());
    setEditAmount(String(expense.amount || ''));
    setEditCategory(expense.category || '');
    setEditNotes(expense.notes || '');
    setSaveError(null);
    setEditing(true);
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteExpense(companyId, expense.id);
      onClose();
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!editName.trim()) { setSaveError('Description is required.'); return; }
    if (!(Number(editAmount) > 0)) { setSaveError('Amount must be greater than 0.'); return; }
    setSaveError(null);
    setBusy(true);
    try {
      await updateExpense(companyId, expense.id, {
        name: editName,
        date: editDate,
        amount: editAmount,
        category: editCategory,
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
          <h2>{editing ? 'Edit expense' : expense.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {editing ? (
          <div className="modal-body">
            <label className="field">
              <span>Description</span>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </label>

            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </label>
              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="0.00"
                />
              </label>
            </div>

            <div className="field">
              <span>Category</span>
              <div className="chip-row" style={{ marginTop: 4 }}>
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`chip chip-pick ${editCategory === c ? 'chip-on' : ''}`}
                    onClick={() => setEditCategory(editCategory === c ? '' : c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Notes (optional)</span>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Any additional details"
              />
            </label>
          </div>
        ) : (
          <div className="modal-body">
            <div className="detail-date">{fmtDate(expense.date)}</div>

            <div className="detail-grid">
              <div
                className="detail-card kpi-danger"
                style={!expense.category ? { gridColumn: '1 / -1' } : undefined}
              >
                <div className="detail-card-label">Amount</div>
                <div className="detail-card-value">{fmt(Number(expense.amount) || 0)}</div>
              </div>
              {expense.category && (
                <div className="detail-card">
                  <div className="detail-card-label">Category</div>
                  <div className="detail-card-value">{expense.category}</div>
                </div>
              )}
            </div>

            {expense.notes && (
              <div className="field">
                <span>Notes</span>
                <div className="notes-block">{expense.notes}</div>
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
              <span className="confirm-text">Delete this expense?</span>
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
              <button className="btn-primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
