import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';

// Shared expense "tabs" — stored under /companies/{id}/tabs/{tabId}
// Schema:
// {
//   name, status: 'open'|'closed'|'resolved',
//   items: [{ id, person, description, amount }],
//   repayments: { [person]: number },
//   date (ISO), createdAt, updatedAt, closedAt, resolvedAt
// }
export function useTabs(companyId, enabled = true) {
  const [tabs, setTabs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !enabled) { setTabs([]); setLoading(false); return; }
    setLoading(true);
    const q = query(collection(db, 'companies', companyId, 'tabs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTabs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Tabs error:', err);
        setTabs([]);
        setLoading(false);
      },
    );
    return unsub;
  }, [companyId, enabled]);

  return { tabs, loading };
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function tabTotal(tab) {
  return (tab.items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
}

export function tabParticipants(tab) {
  const set = new Set(tab.participants || []);
  for (const it of tab.items || []) if (it.person) set.add(it.person);
  return [...set];
}

export function owedByPerson(tab, person) {
  return (tab.items || [])
    .filter((it) => it.person === person)
    .reduce((s, it) => s + (Number(it.amount) || 0), 0);
}

export function paidByPerson(tab, person) {
  return Number(tab.repayments?.[person]) || 0;
}

export function totalRepaid(tab) {
  return Object.values(tab.repayments || {}).reduce((s, v) => s + (Number(v) || 0), 0);
}

export function isFullyRepaid(tab) {
  const total = tabTotal(tab);
  return total > 0 && totalRepaid(tab) >= total - 0.005;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function addTab(companyId, { name, date, participants, items }) {
  return addDoc(collection(db, 'companies', companyId, 'tabs'), {
    name: name.trim(),
    status: 'open',
    date: date || new Date().toISOString().slice(0, 10),
    participants: participants || [],
    items: items || [],
    repayments: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function updateTab(companyId, tabId, payload) {
  await updateDoc(doc(db, 'companies', companyId, 'tabs', tabId), {
    ...payload,
    updatedAt: Date.now(),
  });
}

export async function closeTab(companyId, tab) {
  // Move from 'open' (expense) → 'closed' (awaiting repayment)
  const participants = tabParticipants(tab);
  const repayments = { ...(tab.repayments || {}) };
  for (const p of participants) if (repayments[p] == null) repayments[p] = 0;
  await updateDoc(doc(db, 'companies', companyId, 'tabs', tab.id), {
    status: 'closed',
    repayments,
    closedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function setRepayment(companyId, tabId, person, amount) {
  await updateDoc(doc(db, 'companies', companyId, 'tabs', tabId), {
    [`repayments.${person}`]: Number(amount) || 0,
    updatedAt: Date.now(),
  });
}

export async function resolveTab(companyId, tabId) {
  await updateDoc(doc(db, 'companies', companyId, 'tabs', tabId), {
    status: 'resolved',
    resolvedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function reopenTab(companyId, tabId) {
  await updateDoc(doc(db, 'companies', companyId, 'tabs', tabId), {
    status: 'open',
    updatedAt: Date.now(),
  });
}

export async function deleteTab(companyId, tabId) {
  await deleteDoc(doc(db, 'companies', companyId, 'tabs', tabId));
}
