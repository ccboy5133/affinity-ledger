import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';

// Events are stored under /companies/{uid}/events/{eventId}
// Schema:
// { name, date (ISO string), grossIncome (number), savedPct (0–100),
//   employees: string[], notes, createdAt }
export function useEvents(uid) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, 'companies', uid, 'events'),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  const totals = useMemo(() => {
    let gross = 0;
    let reserve = 0;
    let salaries = 0;
    for (const e of events) {
      const g = Number(e.grossIncome) || 0;
      const pct = Number(e.savedPct) || 0;
      const saved = (g * pct) / 100;
      gross += g;
      reserve += saved;
      salaries += g - saved;
    }
    return { gross, reserve, salaries, count: events.length };
  }, [events]);

  return { events, loading, totals };
}

export async function addEvent(uid, payload) {
  const grossIncome = Number(payload.grossIncome) || 0;
  const savedPct = Math.max(0, Math.min(100, Number(payload.savedPct) || 0));
  return addDoc(collection(db, 'companies', uid, 'events'), {
    name: payload.name.trim(),
    date: payload.date,
    grossIncome,
    savedPct,
    employees: payload.employees || [],
    salaryBreakdown: payload.salaryBreakdown || [],
    splitMode: payload.splitMode || 'even',
    notes: (payload.notes || '').trim(),
    createdAt: Date.now(),
  });
}

export async function updateEvent(uid, eventId, payload) {
  const grossIncome = Number(payload.grossIncome) || 0;
  const savedPct = Math.max(0, Math.min(100, Number(payload.savedPct) || 0));
  await updateDoc(doc(db, 'companies', uid, 'events', eventId), {
    name: payload.name.trim(),
    date: payload.date,
    grossIncome,
    savedPct,
    employees: payload.employees || [],
    salaryBreakdown: payload.salaryBreakdown || [],
    splitMode: payload.splitMode || 'even',
    notes: (payload.notes || '').trim(),
    updatedAt: Date.now(),
  });
}

export async function deleteEvent(uid, eventId) {
  await deleteDoc(doc(db, 'companies', uid, 'events', eventId));
}
