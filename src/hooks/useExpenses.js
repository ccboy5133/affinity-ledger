import { useEffect, useMemo, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';

// Stored under /companies/{uid}/expenses/{expenseId}
// Schema: { name, date (ISO), amount (number), category, notes, createdAt }
export function useExpenses(uid) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setExpenses([]); setLoading(false); return; }
    setLoading(true);
    const q = query(
      collection(db, 'companies', uid, 'expenses'),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Expenses error:', err);
        setExpenses([]);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  const total = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses],
  );

  return { expenses, loading, total };
}

export async function addExpense(uid, payload) {
  return addDoc(collection(db, 'companies', uid, 'expenses'), {
    name: payload.name.trim(),
    date: payload.date,
    amount: Number(payload.amount) || 0,
    category: (payload.category || '').trim(),
    notes: (payload.notes || '').trim(),
    createdAt: Date.now(),
  });
}

export async function updateExpense(uid, expenseId, payload) {
  await updateDoc(doc(db, 'companies', uid, 'expenses', expenseId), {
    name: payload.name.trim(),
    date: payload.date,
    amount: Number(payload.amount) || 0,
    category: (payload.category || '').trim(),
    notes: (payload.notes || '').trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteExpense(uid, expenseId) {
  await deleteDoc(doc(db, 'companies', uid, 'expenses', expenseId));
}
