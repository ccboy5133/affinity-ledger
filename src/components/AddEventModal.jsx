import React, { useState } from 'react';
import { addEvent } from '../hooks/useEvents';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function AddEventModal({ companyId, employees, onClose }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [grossIncome, setGrossIncome] = useState('');
  const [savedPct, setSavedPct] = useState(30);
  const [picked, setPicked] = useState([]);
  const [splitMode, setSplitMode] = useState('even');
  const [customAmounts, setCustomAmounts] = useState({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const gross = Number(grossIncome) || 0;
  const reserve = (gross * savedPct) / 100;
  const salary = gross - reserve;
  const perPersonEven = picked.length > 0 ? salary / picked.length : 0;
  const customTotal = picked.reduce((s, n) => s + (Number(customAmounts[n]) || 0), 0);
  const customRemaining = salary - customTotal;

  function togglePick(label) {
    setPicked((p) => {
      if (p.includes(label)) {
        setCustomAmounts((ca) => { const next = { ...ca }; delete next[label]; return next; });
        return p.filter((n) => n !== label);
      }
      return [...p, label];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Event name is required.');
    if (gross <= 0) return setError('Gross income must be greater than 0.');
    setBusy(true);
    const salaryBreakdown = picked.map((n) => ({
      name: n,
      amount: splitMode === 'even' ? salary / picked.length : Number(customAmounts[n]) || 0,
    }));
    try {
      await addEvent(companyId, {
        name,
        date,
        grossIncome: gross,
        savedPct: Number(savedPct),
        employees: picked,
        salaryBreakdown,
        splitMode,
        notes,
      });
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save event.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>New event</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span>Event name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Saturday wedding @ Vineyard"
              autoFocus
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>Gross income</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={grossIncome}
                onChange={(e) => setGrossIncome(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          <label className="field">
            <span>Split — {savedPct}% to reserve</span>
            <input
              type="range"
              min="0"
              max="100"
              value={savedPct}
              onChange={(e) => setSavedPct(Number(e.target.value))}
            />
            <div className="split-preview">
              <div><strong>{fmt(reserve)}</strong> saved</div>
              <div><strong>{fmt(salary)}</strong> to salary</div>
            </div>
          </label>

          <div className="field">
            <span>Who worked it</span>
            {employees.length === 0 ? (
              <div className="hint">No employees yet. Add some from the Team button.</div>
            ) : (
              <div className="chip-row">
                {employees.map((emp) => {
                  const label = typeof emp === 'string' ? emp : emp.name;
                  return (
                    <button
                      type="button"
                      key={label}
                      className={`chip chip-pick ${picked.includes(label) ? 'chip-on' : ''}`}
                      onClick={() => togglePick(label)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {picked.length > 0 && (
            <SalaryBreakdownField
              picked={picked}
              salary={salary}
              splitMode={splitMode}
              setSplitMode={setSplitMode}
              customAmounts={customAmounts}
              setCustomAmounts={setCustomAmounts}
              perPersonEven={perPersonEven}
              customRemaining={customRemaining}
            />
          )}

          <label className="field">
            <span>Notes (optional)</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this event"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save event'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Shared salary breakdown field ───────────────────────────────────────────

export function SalaryBreakdownField({
  picked, salary, splitMode, setSplitMode,
  customAmounts, setCustomAmounts,
  perPersonEven, customRemaining,
}) {
  return (
    <div className="field">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Pay split</span>
        <div className="split-mode-tabs">
          <button
            type="button"
            className={`split-mode-tab ${splitMode === 'even' ? 'split-mode-tab-on' : ''}`}
            onClick={() => setSplitMode('even')}
          >
            Even
          </button>
          <button
            type="button"
            className={`split-mode-tab ${splitMode === 'custom' ? 'split-mode-tab-on' : ''}`}
            onClick={() => setSplitMode('custom')}
          >
            Custom
          </button>
        </div>
      </div>
      <div className="salary-breakdown">
        {picked.map((name) => (
          <div key={name} className="salary-row">
            <span className="salary-name">{name}</span>
            {splitMode === 'even' ? (
              <span className="salary-amount">{fmt(perPersonEven)}</span>
            ) : (
              <input
                className="salary-input"
                type="number"
                min="0"
                step="0.01"
                value={customAmounts[name] ?? ''}
                onChange={(e) =>
                  setCustomAmounts((ca) => ({ ...ca, [name]: e.target.value }))
                }
                placeholder="0.00"
              />
            )}
          </div>
        ))}
        {splitMode === 'custom' && (
          <div className={`salary-remaining ${customRemaining < 0 ? 'salary-remaining-over' : ''}`}>
            <span>{customRemaining < 0 ? 'Over by' : 'Unallocated'}</span>
            <strong>{fmt(Math.abs(customRemaining))}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
