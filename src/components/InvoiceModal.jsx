import React, { useState, useMemo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function todayFormatted() {
  return fmtDate(new Date().toISOString());
}

function makeInvoiceNumber() {
  const d = new Date();
  return `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
}

// ─── Invoice HTML generator ───────────────────────────────────────────────────

function buildInvoiceHtml({ companyName, invoiceInfo = {}, client, invoiceNumber, eventName, eventDate, lineItems, notes }) {
  const subtotal = lineItems.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);

  const rows = lineItems.map((r) => {
    const amount = (Number(r.qty) || 0) * (Number(r.rate) || 0);
    return `
      <tr>
        <td class="td-desc">${esc(r.description)}</td>
        <td class="td-num">${Number(r.qty) || 0}</td>
        <td class="td-num">${fmtUSD(r.rate)}</td>
        <td class="td-num td-amt">${fmtUSD(amount)}</td>
      </tr>`;
  }).join('');

  const contactLines = [invoiceInfo.address, invoiceInfo.phone, invoiceInfo.email]
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1f262c; background: #fff; }
  .page { max-width: 760px; margin: 0 auto; padding: 56px 48px; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .company-name { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; color: #1f262c; }
  .company-contact { margin-top: 6px; color: #6b7280; font-size: 12px; line-height: 1.6; }
  .invoice-label { font-size: 28px; font-weight: 300; color: #9ca3af; text-align: right; }
  .invoice-number { font-size: 13px; color: #6b7280; text-align: right; margin-top: 4px; }

  /* Meta row */
  .meta { display: flex; justify-content: space-between; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #f3f4f6; }
  .meta-block-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; font-weight: 600; }
  .meta-block-value { font-size: 14px; color: #1f262c; font-weight: 500; }
  .meta-block-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }

  /* Items table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  thead tr { background: #2E3A45; }
  thead th { padding: 10px 14px; text-align: left; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  th.td-num, td.td-num { text-align: right; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  tbody tr:last-child td { border-bottom: 1px solid #e5e7eb; }
  .td-desc { padding: 12px 14px; color: #1f262c; }
  .td-num { padding: 12px 14px; color: #374151; }
  .td-amt { font-weight: 600; color: #1f262c; }

  /* Totals */
  .totals { display: flex; justify-content: flex-end; margin-top: 0; }
  .totals-box { width: 220px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 13px; color: #6b7280; }
  .total-row.total-final { background: #C6A75E; color: #1f262c; font-size: 15px; font-weight: 700; border-radius: 0 0 6px 6px; padding: 12px 14px; }
  .total-row.total-final span:last-child { color: #1f262c; }

  /* Notes */
  .notes-section { margin-top: 36px; padding-top: 24px; border-top: 1px solid #f3f4f6; }
  .notes-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
  .notes-text { font-size: 12px; color: #6b7280; line-height: 1.6; white-space: pre-wrap; }

  /* Footer */
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center; font-size: 11px; color: #d1d5db; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="company-name">${esc(companyName)}</div>
      <div class="company-contact">${contactLines}</div>
    </div>
    <div>
      <div class="invoice-label">INVOICE</div>
      <div class="invoice-number">${esc(invoiceNumber)}</div>
    </div>
  </div>

  <div class="meta">
    <div>
      <div class="meta-block-label">Bill To</div>
      <div class="meta-block-value">${esc(client.name || '—')}</div>
      ${client.address ? `<div class="meta-block-sub">${esc(client.address)}</div>` : ''}
    </div>
    <div>
      <div class="meta-block-label">Invoice Date</div>
      <div class="meta-block-value">${esc(todayFormatted())}</div>
    </div>
    <div>
      <div class="meta-block-label">Event</div>
      <div class="meta-block-value">${esc(eventName)}</div>
      <div class="meta-block-sub">${esc(fmtDate(eventDate))}</div>
    </div>
    ${invoiceInfo.terms ? `<div>
      <div class="meta-block-label">Payment Terms</div>
      <div class="meta-block-value">${esc(invoiceInfo.terms)}</div>
    </div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="td-num">Qty</th>
        <th class="td-num">Rate</th>
        <th class="td-num">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row total-final">
        <span>Total</span>
        <span>${fmtUSD(subtotal)}</span>
      </div>
    </div>
  </div>

  ${notes ? `
  <div class="notes-section">
    <div class="notes-label">Notes</div>
    <div class="notes-text">${esc(notes)}</div>
  </div>` : ''}

  <div class="footer">Thank you for your business.</div>
</div>
</body>
</html>`;
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Component ────────────────────────────────────────────────────────────────

const emptyLine = () => ({ id: crypto.randomUUID(), description: '', qty: 1, rate: '' });

export default function InvoiceModal({ event, company, onClose }) {
  const invoiceNumber = useMemo(makeInvoiceNumber, []);
  const invoiceInfo = company.invoiceInfo || {};

  const [client, setClient] = useState({ name: '', address: '' });
  const [lines, setLines] = useState([emptyLine()]);
  const [notes, setNotes] = useState(event.notes || '');
  const [step, setStep] = useState('form'); // 'form' | 'preview'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [overrideLimit, setOverrideLimit] = useState(false);

  const subtotal = lines.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);
  const budget = Number(event.grossIncome) || 0;
  const overBudget = budget > 0 && subtotal > budget && !overrideLimit;
  const barPct = budget > 0 ? Math.min((subtotal / budget) * 100, 100) : 0;

  function setLine(id, field, value) {
    setLines((ls) => ls.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(id) { setLines((ls) => ls.filter((l) => l.id !== id)); }

  const filledHtml = useMemo(() => buildInvoiceHtml({
    companyName: company.name,
    invoiceInfo,
    client,
    invoiceNumber,
    eventName: event.name,
    eventDate: event.date,
    lineItems: lines.filter((l) => l.description.trim()),
    notes,
  }), [step === 'preview' ? step : null]);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const defaultName = `${company.name} - ${event.name} - ${invoiceNumber}`.replace(/[^a-z0-9 \-]/gi, '_');
      const result = await window.ledger.exportInvoicePdf({ html: filledHtml, defaultName });
      if (result.saved) setSaved(true);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Create invoice</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {event.name} · {invoiceNumber}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`inv-step-btn ${step === 'form' ? 'inv-step-on' : ''}`}
              onClick={() => setStep('form')}
            >
              1. Details
            </button>
            <button
              className={`inv-step-btn ${step === 'preview' ? 'inv-step-on' : ''}`}
              onClick={() => setStep('preview')}
              disabled={lines.every((l) => !l.description.trim()) || overBudget}
            >
              2. Preview
            </button>
            <button className="icon-btn" onClick={onClose}>×</button>
          </div>
        </div>

        {step === 'form' && (
          <div className="modal-body">
            {/* Client */}
            <div className="inv-section-title">Bill to</div>
            <div className="field-row">
              <label className="field">
                <span>Client name</span>
                <input
                  type="text"
                  value={client.name}
                  onChange={(e) => setClient({ ...client, name: e.target.value })}
                  placeholder="Client or company name"
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Address (optional)</span>
                <input
                  type="text"
                  value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })}
                  placeholder="City, State"
                />
              </label>
            </div>

            {/* Line items */}
            <div className="inv-section-title" style={{ marginTop: 8 }}>Services</div>
            <div className="inv-lines-header">
              <span className="inv-col-desc">Description</span>
              <span className="inv-col-num">Qty</span>
              <span className="inv-col-num">Rate</span>
              <span className="inv-col-num">Amount</span>
              <span style={{ width: 32 }} />
            </div>

            {lines.map((line) => {
              const amount = (Number(line.qty) || 0) * (Number(line.rate) || 0);
              return (
                <div key={line.id} className="inv-line">
                  <input
                    className="inv-input inv-col-desc"
                    type="text"
                    value={line.description}
                    onChange={(e) => setLine(line.id, 'description', e.target.value)}
                    placeholder="e.g. DJ services, 4 hrs"
                  />
                  <input
                    className="inv-input inv-col-num"
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => setLine(line.id, 'qty', e.target.value)}
                  />
                  <input
                    className="inv-input inv-col-num"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(e) => setLine(line.id, 'rate', e.target.value)}
                    placeholder="0.00"
                  />
                  <div className="inv-col-num inv-amount">{fmtUSD(amount)}</div>
                  <button
                    className="icon-btn"
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length === 1}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button className="btn-ghost inv-add-line" onClick={addLine}>+ Add line</button>

            <div className="inv-subtotal">
              <span>Total</span>
              <span style={{ color: budget > 0 && subtotal > budget ? 'var(--danger)' : 'inherit' }}>
                {fmtUSD(subtotal)}
              </span>
            </div>

            {budget > 0 && (
              <div className="inv-budget">
                <div className="inv-budget-row">
                  <span>Event revenue</span>
                  <strong>{fmtUSD(budget)}</strong>
                </div>
                <div className="inv-budget-bar-wrap">
                  <div
                    className={`inv-budget-bar ${subtotal > budget ? 'inv-budget-over' : ''}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="inv-budget-row">
                  <span>{subtotal > budget ? 'Over by' : 'Remaining'}</span>
                  <strong style={{ color: subtotal > budget ? 'var(--danger)' : 'var(--emerald)' }}>
                    {fmtUSD(Math.abs(budget - subtotal))}
                  </strong>
                </div>
                {subtotal > budget && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="inv-budget-warning">Total exceeds event revenue</span>
                    <label className="inv-override">
                      <input
                        type="checkbox"
                        checked={overrideLimit}
                        onChange={(e) => setOverrideLimit(e.target.checked)}
                      />
                      Override limit
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <label className="field">
              <span>Notes / payment instructions (optional)</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Venmo @..., please pay within 14 days"
              />
            </label>
          </div>
        )}

        {step === 'preview' && (
          <div className="modal-body" style={{ padding: 0 }}>
            <iframe
              className="invoice-preview"
              style={{ height: 520, borderRadius: 0 }}
              srcDoc={filledHtml}
              title="Invoice preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}

        <div className="modal-foot">
          {error && <span className="inv-error">{error}</span>}
          {saved && <span className="inv-saved">Saved!</span>}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          {step === 'form' && (
            <button
              className="btn-primary"
              onClick={() => setStep('preview')}
              disabled={lines.every((l) => !l.description.trim()) || overBudget}
              title={overBudget ? 'Total exceeds event revenue — check Override limit to proceed' : undefined}
            >
              Preview →
            </button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn-ghost" onClick={() => setStep('form')}>← Edit</button>
              <button className="btn-primary" onClick={handleExport} disabled={busy}>
                {busy ? 'Exporting…' : 'Export PDF'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
