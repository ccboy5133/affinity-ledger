import React, { useState } from 'react';
import {
  addTab, updateTab, closeTab, setRepayment, resolveTab, reopenTab, deleteTab,
  tabTotal, tabParticipants, owedByPerson, paidByPerson, totalRepaid, isFullyRepaid,
} from '../hooks/useTabs';

function fmt(n) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
const newItem = () => ({ id: crypto.randomUUID(), person: '', description: '', amount: '' });

export default function TabModal({ companyId, tab, employees = [], onClose }) {
  const isRepayment = tab && (tab.status === 'closed' || tab.status === 'resolved');
  if (isRepayment) {
    return <RepaymentView companyId={companyId} tab={tab} onClose={onClose} />;
  }
  return <EditView companyId={companyId} tab={tab} employees={employees} onClose={onClose} />;
}

// ─── Create / edit an open tab ────────────────────────────────────────────────

function EditView({ companyId, tab, employees, onClose }) {
  const editing = !!tab;
  const [name, setName] = useState(tab?.name || '');
  const [date, setDate] = useState(tab?.date || todayIso());
  const [participants, setParticipants] = useState(tab ? tabParticipants(tab) : []);
  const [items, setItems] = useState(
    tab?.items?.length ? tab.items.map((i) => ({ ...i, amount: String(i.amount) })) : [newItem()],
  );
  const [newPart, setNewPart] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  function addParticipant(nm) {
    const v = (nm ?? newPart).trim();
    if (!v || participants.includes(v)) { setNewPart(''); return; }
    setParticipants((p) => [...p, v]);
    setNewPart('');
  }
  function removeParticipant(nm) {
    setParticipants((p) => p.filter((x) => x !== nm));
    setItems((its) => its.map((it) => it.person === nm ? { ...it, person: '' } : it));
  }
  function setItem(id, field, val) {
    setItems((its) => its.map((it) => it.id === id ? { ...it, [field]: val } : it));
  }
  function addItemRow() { setItems((its) => [...its, newItem()]); }
  function removeItemRow(id) { setItems((its) => its.filter((it) => it.id !== id)); }

  const empNames = employees.map((e) => (typeof e === 'string' ? e : e.name)).filter(Boolean);
  const suggestions = empNames.filter((n) => !participants.includes(n));

  function buildPayload() {
    const cleanItems = items
      .filter((it) => it.person && (Number(it.amount) || 0) > 0)
      .map((it) => ({
        id: it.id, person: it.person,
        description: (it.description || '').trim(),
        amount: Number(it.amount) || 0,
      }));
    return { name, date, participants, items: cleanItems };
  }

  async function handleSave(closeAfter = false) {
    if (!name.trim()) { setError('Tab name is required.'); return; }
    const payload = buildPayload();
    if (payload.items.length === 0) { setError('Add at least one expense (person + amount).'); return; }
    setError(null);
    setBusy(true);
    try {
      let tabId = tab?.id;
      if (editing) {
        await updateTab(companyId, tabId, payload);
      } else {
        const ref = await addTab(companyId, payload);
        tabId = ref.id;
      }
      if (closeAfter) {
        await closeTab(companyId, { ...tab, id: tabId, ...payload });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save tab.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try { await deleteTab(companyId, tab.id); onClose(); }
    catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{editing ? 'Edit tab' : 'New tab'}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Shared expenses — each person owes their items
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="field-row">
            <label className="field">
              <span>Tab name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maryland trip" autoFocus />
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          {/* Participants */}
          <div className="field">
            <span>People</span>
            <div className="chip-row" style={{ marginBottom: 6 }}>
              {participants.map((p) => (
                <span key={p} className="chip">
                  {p}
                  <button type="button" onClick={() => removeParticipant(p)}>×</button>
                </span>
              ))}
            </div>
            <form className="emp-link-row" onSubmit={(e) => { e.preventDefault(); addParticipant(); }}>
              <input value={newPart} onChange={(e) => setNewPart(e.target.value)} placeholder="Add a person…" />
              <button type="submit" className="btn-secondary" style={{ padding: '6px 12px' }}>Add</button>
            </form>
            {suggestions.length > 0 && (
              <div className="chip-row" style={{ marginTop: 6 }}>
                {suggestions.map((n) => (
                  <button type="button" key={n} className="chip chip-pick" onClick={() => addParticipant(n)}>+ {n}</button>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="inv-section-title" style={{ marginTop: 4 }}>Expenses</div>
          <div className="tab-items-header">
            <span style={{ flex: '0 0 130px' }}>Person</span>
            <span style={{ flex: 1 }}>What for</span>
            <span style={{ width: 90, textAlign: 'right' }}>Amount</span>
            <span style={{ width: 32 }} />
          </div>
          {items.map((it) => (
            <div key={it.id} className="tab-item-row">
              <select
                className="perm-select"
                style={{ flex: '0 0 130px', borderRadius: 8 }}
                value={it.person}
                onChange={(e) => setItem(it.id, 'person', e.target.value)}
              >
                <option value="">Who…</option>
                {participants.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                className="inv-input"
                style={{ flex: 1 }}
                value={it.description}
                onChange={(e) => setItem(it.id, 'description', e.target.value)}
                placeholder="e.g. Hotel, gas, dinner"
              />
              <input
                className="inv-input"
                style={{ width: 90, textAlign: 'right' }}
                type="number" min="0" step="0.01"
                value={it.amount}
                onChange={(e) => setItem(it.id, 'amount', e.target.value)}
                placeholder="0.00"
              />
              <button className="icon-btn" onClick={() => removeItemRow(it.id)} disabled={items.length === 1}>×</button>
            </div>
          ))}
          <button className="btn-ghost inv-add-line" onClick={addItemRow}>+ Add expense</button>

          <div className="inv-subtotal">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>

          {/* Per-person preview */}
          {participants.length > 0 && (
            <div className="tab-breakdown">
              {participants.map((p) => {
                const owed = items.filter((it) => it.person === p).reduce((s, it) => s + (Number(it.amount) || 0), 0);
                return (
                  <div key={p} className="tab-breakdown-row">
                    <span>{p}</span>
                    <strong>{fmt(owed)}</strong>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}
        </div>

        <div className="modal-foot">
          {confirming ? (
            <>
              <span className="confirm-text">Delete this tab?</span>
              <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>Delete</button>
            </>
          ) : (
            <>
              {editing && <button className="btn-ghost" onClick={() => setConfirming(true)}>Delete</button>}
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-secondary" onClick={() => handleSave(false)} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-tab-close" onClick={() => handleSave(true)} disabled={busy} title="Close the tab and start tracking repayments">
                Close tab →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Repayment view (closed / resolved) ───────────────────────────────────────

function RepaymentView({ companyId, tab, onClose }) {
  const resolved = tab.status === 'resolved';
  const participants = tabParticipants(tab);
  const total = tabTotal(tab);
  const repaid = totalRepaid(tab);
  const remaining = total - repaid;
  const fullyRepaid = isFullyRepaid(tab);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handlePaidChange(person, value) {
    await setRepayment(companyId, tab.id, person, value).catch((e) => console.error(e));
  }
  async function handleResolve() {
    setBusy(true);
    try { await resolveTab(companyId, tab.id); onClose(); }
    catch (e) { console.error(e); setBusy(false); }
  }
  async function handleReopen() {
    setBusy(true);
    try { await reopenTab(companyId, tab.id); onClose(); }
    catch (e) { console.error(e); setBusy(false); }
  }
  async function handleDelete() {
    setBusy(true);
    try { await deleteTab(companyId, tab.id); onClose(); }
    catch (e) { console.error(e); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{tab.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {resolved
                ? 'Resolved — fully paid back'
                : 'Repayment — track who has paid back'}
            </div>
          </div>
          <span className={`tab-status-badge ${resolved ? 'tab-status-resolved' : 'tab-status-repay'}`}>
            {resolved ? 'Resolved' : 'Awaiting repayment'}
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-card"><div className="detail-card-label">Total cost</div><div className="detail-card-value">{fmt(total)}</div></div>
            <div className={`detail-card ${resolved ? 'kpi-resolved' : 'kpi-repay'}`}>
              <div className="detail-card-label">{remaining > 0.005 ? 'Outstanding' : 'Paid back'}</div>
              <div className="detail-card-value">{fmt(remaining > 0.005 ? remaining : total)}</div>
            </div>
          </div>

          {participants.map((p) => {
            const owed = owedByPerson(tab, p);
            const paid = paidByPerson(tab, p);
            const settled = paid >= owed - 0.005 && owed > 0;
            const personItems = (tab.items || []).filter((it) => it.person === p);
            return (
              <div key={p} className={`tab-person ${settled ? 'tab-person-settled' : ''}`}>
                <div className="tab-person-head">
                  <span className="tab-person-name">
                    {p} {settled && <span className="tab-person-check">✓</span>}
                  </span>
                  <span className="tab-person-figs">
                    <span className="tab-person-owed">{fmt(owed)} owed</span>
                  </span>
                </div>
                <div className="tab-person-items">
                  {personItems.map((it) => (
                    <div key={it.id} className="tab-person-item">
                      <span>{it.description || '—'}</span>
                      <span>{fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="tab-person-repay">
                  <span>Paid back</span>
                  <input
                    type="number" min="0" step="0.01"
                    className="salary-input"
                    value={paid || ''}
                    disabled={resolved}
                    onChange={(e) => handlePaidChange(p, e.target.value)}
                    placeholder="0.00"
                  />
                  <span className={`tab-person-remaining ${settled ? 'is-settled' : ''}`}>
                    {settled ? 'Settled' : `${fmt(Math.max(owed - paid, 0))} left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-foot">
          {confirming ? (
            <>
              <span className="confirm-text">Delete this tab?</span>
              <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button className="btn-danger" onClick={handleDelete} disabled={busy}>Delete</button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setConfirming(true)}>Delete</button>
              {resolved ? (
                <button className="btn-ghost" onClick={handleReopen} disabled={busy}>Reopen</button>
              ) : (
                <button className="btn-ghost" onClick={handleReopen} disabled={busy} title="Back to editing expenses">← Reopen tab</button>
              )}
              <button className="btn-ghost" onClick={onClose}>Close</button>
              {!resolved && (
                <button
                  className="btn-resolve"
                  onClick={handleResolve}
                  disabled={busy || !fullyRepaid}
                  title={fullyRepaid ? 'Mark as fully paid and resolved' : 'Enable once the full amount is paid back'}
                >
                  {fullyRepaid ? 'Mark resolved ✓' : 'Mark resolved'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
