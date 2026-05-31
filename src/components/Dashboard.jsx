import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useEvents } from '../hooks/useEvents';
import { useExpenses } from '../hooks/useExpenses';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useUpdateCheck } from '../hooks/useUpdateCheck';
import { signOut } from '../firebase';
import { createCompany } from '../hooks/useCompany';
import AddEventModal from './AddEventModal.jsx';
import EventDetail from './EventDetail.jsx';
import AddExpenseModal from './AddExpenseModal.jsx';
import ExpenseDetail from './ExpenseDetail.jsx';
import EmployeeManager from './EmployeeManager.jsx';
import Settings from './Settings.jsx';
import TabModal from './TabModal.jsx';
import { useTabs, tabTotal, totalRepaid } from '../hooks/useTabs';

function fmtCurrency(n) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function Dashboard({ user, company, memberships, role, onSwitch, onSelectCompany }) {
  const isOwner = role === 'owner';
  const tabsEnabled = !!company.tabsEnabled;
  const { events, loading: eventsLoading } = useEvents(company.id);
  const { expenses, loading: expensesLoading } = useExpenses(company.id);
  const { tabs } = useTabs(company.id, tabsEnabled);
  const online = useOnlineStatus();
  const update = useUpdateCheck();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [selectedTab, setSelectedTab] = useState(null);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Time filter — not persisted
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | '30d'

  // Expenses affect reserve — persisted across sessions
  const [deductExpenses, setDeductExpenses] = useState(() => {
    const saved = localStorage.getItem('ledger-deduct-expenses');
    return saved === null ? true : saved === 'true';
  });
  function toggleDeductExpenses() {
    setDeductExpenses((prev) => {
      localStorage.setItem('ledger-deduct-expenses', String(!prev));
      return !prev;
    });
  }

  // Filtered data
  const cutoff = useMemo(() => {
    if (timeFilter === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, [timeFilter]);

  const filteredEvents = useMemo(
    () => (cutoff ? events.filter((e) => e.date >= cutoff) : events),
    [events, cutoff],
  );
  const filteredExpenses = useMemo(
    () => (cutoff ? expenses.filter((e) => e.date >= cutoff) : expenses),
    [expenses, cutoff],
  );

  // Totals computed from filtered data
  const totals = useMemo(() => {
    let gross = 0, reserve = 0, salaries = 0;
    for (const e of filteredEvents) {
      const g = Number(e.grossIncome) || 0;
      const pct = Number(e.savedPct) || 0;
      const saved = (g * pct) / 100;
      gross += g; reserve += saved; salaries += g - saved;
    }
    return { gross, reserve, salaries, count: filteredEvents.length };
  }, [filteredEvents]);

  const filteredExpensesTotal = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [filteredExpenses],
  );

  const displayReserve = deductExpenses
    ? totals.reserve - filteredExpensesTotal
    : totals.reserve;

  // Tabs split by lifecycle, time-filtered
  const filteredTabs = useMemo(
    () => (cutoff ? tabs.filter((t) => (t.date || '') >= cutoff) : tabs),
    [tabs, cutoff],
  );
  const openTabs = useMemo(() => filteredTabs.filter((t) => t.status === 'open'), [filteredTabs]);
  const repayTabs = useMemo(
    () => filteredTabs.filter((t) => t.status === 'closed' || t.status === 'resolved'),
    [filteredTabs],
  );

  // Match the signed-in user to their employee entry by email (from their
  // verified auth token) — no client needs write access to the company doc.
  const myEmail = (user.email || '').toLowerCase();
  const myPerms = isOwner
    ? { canAddEvents: true, canCreateInvoices: true }
    : (company.employees.find((e) => e.email && e.email.toLowerCase() === myEmail)?.permissions
        || { canAddEvents: true, canCreateInvoices: false });

  // Keep selected items in sync with real-time updates (e.g. after editing)
  useEffect(() => {
    if (!selectedEvent) return;
    const updated = events.find((e) => e.id === selectedEvent.id);
    if (updated) setSelectedEvent(updated);
  }, [events]);

  useEffect(() => {
    if (!selectedExpense) return;
    const updated = expenses.find((e) => e.id === selectedExpense.id);
    if (updated) setSelectedExpense(updated);
  }, [expenses]);

  useEffect(() => {
    if (!selectedTab) return;
    const updated = tabs.find((t) => t.id === selectedTab.id);
    if (updated) setSelectedTab(updated);
    else setSelectedTab(null);
  }, [tabs]);

  const canAddEvents = isOwner || myPerms.canAddEvents;
  const canCreateInvoices = isOwner || myPerms.canCreateInvoices;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-left">
          <div className="top-brand">Affinity Ledger</div>
        </div>
        <div className="top-right">
          {update && (
            <a
              className="update-badge"
              href={update.assetUrl || update.releaseUrl}
              target="_blank"
              rel="noreferrer"
              title={`Version ${update.latest} is available — click to download`}
            >
              ↑ Update to {update.latest}
            </a>
          )}
          {!online && (
            <div className="sync-badge" title="Offline — changes will sync when reconnected">
              <span className="sync-icon">↻</span>
              Offline
            </div>
          )}
          {isOwner && (
            <>
              <button className="btn-ghost" onClick={() => setShowEmployees(true)}>
                Team ({company.employees?.length || 0})
              </button>
              <button className="btn-ghost" onClick={() => setShowSettings(true)}>
                Settings
              </button>
            </>
          )}
          <div className="user-pill" title={user.email}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" />
            ) : (
              <span className="avatar-fallback">{(user.displayName || user.email || '?')[0]}</span>
            )}
            <span>{user.displayName || user.email}</span>
          </div>
          <button className="btn-ghost" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <main className="dash">
        <section className="hero">
          <div className="hero-top-row">
            <CompanySwitcher
              company={company}
              memberships={memberships}
              user={user}
              onSelectCompany={onSelectCompany}
            />
            <div className="time-filter-tabs">
              <button
                className={`time-filter-tab ${timeFilter === 'all' ? 'time-filter-tab-on' : ''}`}
                onClick={() => setTimeFilter('all')}
              >
                Lifetime
              </button>
              <button
                className={`time-filter-tab ${timeFilter === '30d' ? 'time-filter-tab-on' : ''}`}
                onClick={() => setTimeFilter('30d')}
              >
                30 days
              </button>
            </div>
          </div>
          <div className="hero-earnings-label">Total earnings</div>
          <div className="hero-earnings">{fmtCurrency(totals.gross)}</div>
          <div className="hero-sub">
            Across {totals.count} {totals.count === 1 ? 'event' : 'events'}
          </div>
        </section>

        <section className="kpi-row">
          <KpiCard
            label="In reserve"
            value={fmtCurrency(displayReserve)}
            accent={displayReserve < 0 ? 'danger' : 'emerald'}
            sub={deductExpenses && filteredExpensesTotal > 0 ? `after ${fmtCurrency(filteredExpensesTotal)} expenses` : null}
          />
          <KpiCard label="Paid out as salary" value={fmtCurrency(totals.salaries)} accent="amber" />
          <KpiCard
            label="Avg per event"
            value={fmtCurrency(totals.count ? totals.gross / totals.count : 0)}
            accent="violet"
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Events</h2>
            {canAddEvents && (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>+ New event</button>
            )}
          </div>

          {eventsLoading ? (
            <div className="empty">Loading…</div>
          ) : filteredEvents.length === 0 ? (
            <div className="empty">
              <p>
                {events.length === 0
                  ? `No events yet.${canAddEvents ? ' Add your first gig to start tracking revenue.' : ''}`
                  : 'No events in the last 30 days.'}
              </p>
              {events.length === 0 && canAddEvents && (
                <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add event</button>
              )}
            </div>
          ) : (
            <div className="event-list">
              {filteredEvents.map((ev) => (
                <button key={ev.id} className="event-row" onClick={() => setSelectedEvent(ev)}>
                  <div className="event-row-main">
                    <div className="event-row-name">{ev.name}</div>
                    <div className="event-row-meta">
                      {fmtDate(ev.date)} · {ev.employees?.length || 0} on crew
                    </div>
                  </div>
                  <div className="event-row-figs">
                    <div className="event-row-gross">{fmtCurrency(ev.grossIncome)}</div>
                    <div className="event-row-split">
                      {ev.savedPct}% saved · {fmtCurrency((ev.grossIncome * ev.savedPct) / 100)} to reserve
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel" style={{ marginTop: 24 }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2>Expenses</h2>
              {!expensesLoading && filteredExpenses.length > 0 && (
                <span className="panel-head-stat">{fmtCurrency(filteredExpensesTotal)} total</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="reserve-toggle-label" title="Subtract expenses from the reserve balance">
                <span>Affects reserve</span>
                <span
                  className={`perm-toggle ${deductExpenses ? 'perm-toggle-on' : ''}`}
                  onClick={toggleDeductExpenses}
                  role="switch"
                  aria-checked={deductExpenses}
                >
                  <span className="perm-toggle-thumb" />
                </span>
              </label>
              {tabsEnabled && isOwner && (
                <button className="btn-tab-new" onClick={() => setShowAddTab(true)}>+ New tab</button>
              )}
              {isOwner && (
                <button className="btn-primary" onClick={() => setShowAddExpense(true)}>+ New expense</button>
              )}
            </div>
          </div>

          {expensesLoading ? (
            <div className="empty">Loading…</div>
          ) : filteredExpenses.length === 0 && openTabs.length === 0 ? (
            <div className="empty">
              <p>
                {expenses.length === 0
                  ? `No expenses yet.${isOwner ? ' Track costs like equipment, transport, and venue fees.' : ''}`
                  : 'No expenses in the last 30 days.'}
              </p>
              {expenses.length === 0 && isOwner && (
                <button className="btn-primary" onClick={() => setShowAddExpense(true)}>+ Add expense</button>
              )}
            </div>
          ) : (
            <div className="event-list">
              {openTabs.map((t) => (
                <button key={t.id} className="event-row tab-row tab-row-expense" onClick={() => setSelectedTab(t)}>
                  <div className="event-row-main">
                    <div className="event-row-name">
                      <span className="tab-badge tab-badge-expense">TAB</span> {t.name}
                    </div>
                    <div className="event-row-meta">
                      {fmtDate(t.date)} · {(t.items || []).length} expense{(t.items || []).length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="expense-row-amount">{fmtCurrency(tabTotal(t))}</div>
                </button>
              ))}
              {filteredExpenses.map((ex) => (
                <button key={ex.id} className="event-row" onClick={() => setSelectedExpense(ex)}>
                  <div className="event-row-main">
                    <div className="event-row-name">{ex.name}</div>
                    <div className="event-row-meta">
                      {fmtDate(ex.date)}{ex.category ? ` · ${ex.category}` : ''}
                    </div>
                  </div>
                  <div className="expense-row-amount">{fmtCurrency(ex.amount)}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {tabsEnabled && repayTabs.length > 0 && (
          <section className="panel" style={{ marginTop: 24 }}>
            <div className="panel-head">
              <h2>Repayments</h2>
            </div>
            <div className="event-list">
              {repayTabs.map((t) => {
                const total = tabTotal(t);
                const repaid = totalRepaid(t);
                const resolved = t.status === 'resolved';
                const pct = total > 0 ? Math.min((repaid / total) * 100, 100) : 0;
                return (
                  <button
                    key={t.id}
                    className={`event-row tab-row ${resolved ? 'tab-row-resolved' : 'tab-row-repay'}`}
                    onClick={() => setSelectedTab(t)}
                  >
                    <div className="event-row-main">
                      <div className="event-row-name">
                        <span className={`tab-badge ${resolved ? 'tab-badge-resolved' : 'tab-badge-repay'}`}>
                          {resolved ? 'RESOLVED' : 'REPAY'}
                        </span> {t.name}
                      </div>
                      <div className="event-row-meta">
                        {resolved ? 'Fully paid back' : `${fmtCurrency(repaid)} of ${fmtCurrency(total)} repaid`}
                      </div>
                      {!resolved && (
                        <div className="tab-progress"><div className="tab-progress-bar" style={{ width: `${pct}%` }} /></div>
                      )}
                    </div>
                    <div className="event-row-figs">
                      <div className="event-row-gross">{fmtCurrency(total)}</div>
                      <div className="event-row-split">
                        {resolved ? 'settled' : `${fmtCurrency(Math.max(total - repaid, 0))} outstanding`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {showAdd && canAddEvents && (
        <AddEventModal
          companyId={company.id}
          employees={company.employees || []}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showAddExpense && isOwner && (
        <AddExpenseModal
          companyId={company.id}
          onClose={() => setShowAddExpense(false)}
        />
      )}
      {selectedExpense && (
        <ExpenseDetail
          companyId={company.id}
          expense={selectedExpense}
          isOwner={isOwner}
          onClose={() => setSelectedExpense(null)}
        />
      )}
      {showAddTab && tabsEnabled && isOwner && (
        <TabModal
          companyId={company.id}
          employees={company.employees || []}
          onClose={() => setShowAddTab(false)}
        />
      )}
      {selectedTab && tabsEnabled && (
        <TabModal
          companyId={company.id}
          tab={selectedTab}
          employees={company.employees || []}
          onClose={() => setSelectedTab(null)}
        />
      )}
      {selectedEvent && (
        <EventDetail
          companyId={company.id}
          event={selectedEvent}
          company={company}
          isOwner={isOwner}
          canCreateInvoices={canCreateInvoices}
          onClose={() => setSelectedEvent(null)}
        />
      )}
      {showEmployees && isOwner && (
        <EmployeeManager
          company={company}
          user={user}
          onClose={() => setShowEmployees(false)}
        />
      )}
      {showSettings && isOwner && (
        <Settings
          company={company}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ─── Company switcher ─────────────────────────────────────────────────────────

function CompanySwitcher({ company, memberships, user, onSelectCompany }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const others = (memberships || []).filter((m) => m.companyId !== company.id);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      const companyId = await createCompany(user.uid, { name: newName.trim(), employees: [] });
      onSelectCompany(companyId);
      setOpen(false);
    } catch (err) {
      setCreateError(err.message || 'Could not create company.');
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    setOpen((v) => !v);
    setCreating(false);
    setNewName('');
    setCreateError(null);
  }

  return (
    <div className="csd-wrap" ref={ref}>
      <button className="csd-trigger" onClick={toggle}>
        <span>{company.name}</span>
        <span className={`csd-caret ${open ? 'csd-caret-open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="csd-dropdown">
          {!creating ? (
            <>
              {others.map((m) => (
                <button
                  key={m.companyId}
                  className="csd-item"
                  onClick={() => { onSelectCompany(m.companyId); setOpen(false); }}
                >
                  <span className="csd-avatar">{(m.companyName || '?')[0].toUpperCase()}</span>
                  <span>{m.companyName}</span>
                </button>
              ))}
              {others.length > 0 && <div className="csd-divider" />}
              <button className="csd-item csd-item-new" onClick={() => setCreating(true)}>
                + New company
              </button>
            </>
          ) : (
            <form className="csd-create-form" onSubmit={handleCreate}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Company name"
                autoFocus
              />
              {createError && <div className="hint" style={{ color: 'var(--danger)' }}>{createError}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setCreating(false)}>
                  Back
                </button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={busy || !newName.trim()}>
                  {busy ? '…' : 'Create'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent, sub }) {
  return (
    <div className={`kpi kpi-${accent}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
