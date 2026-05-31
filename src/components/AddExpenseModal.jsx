import React, { useState } from 'react';
import { addExpense } from '../hooks/useExpenses';

const CATEGORIES = ['Equipment', 'Transport', 'Venue', 'Marketing', 'Food & Drink', 'Staffing', 'Other'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddExpenseModal({ companyId, onClose }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Expense name is required.');
    if (!(Number(amount) > 0)) return setError('Amount must be greater than 0.');
    setBusy(true);
    try {
      await addExpense(companyId, { name, date, amount, category, notes });
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save expense.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>New expense</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Description</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sound system rental"
              autoFocus
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Amount</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
                  className={`chip chip-pick ${category === c ? 'chip-on' : ''}`}
                  onClick={() => setCategory(category === c ? '' : c)}
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
