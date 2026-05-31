import { useEffect, useState } from 'react';
import {
  doc, collection, onSnapshot, setDoc, addDoc, updateDoc, getDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { encodeEmail, normalizeEmployee, createOwnerMembership, createInvitation } from './useMembership';

// ─── Recovery: find any companies owned by this uid ──────────────────────────
export async function findOwnedCompanies(uid) {
  const q = query(collection(db, 'companies'), where('ownerId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─── Hook: load one company by its ID ─────────────────────────────────────────
export function useCompany(companyId) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) { setCompany(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const unsub = onSnapshot(
      doc(db, 'companies', companyId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setCompany({
            id: snap.id,
            ...data,
            employees: (data.employees || []).map(normalizeEmployee),
          });
        } else {
          setCompany(null);
        }
        setLoading(false);
      },
      (err) => { console.error('Firestore error:', err); setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [companyId]);

  return { company, loading, error };
}

// ─── Create a brand-new company (auto-generated ID) ───────────────────────────
export async function createCompany(uid, { name, employees }) {
  const normalizedEmployees = employees.map(normalizeEmployee);

  const ref = await addDoc(collection(db, 'companies'), {
    name: name.trim(),
    ownerId: uid,
    employees: normalizedEmployees,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const companyId = ref.id;

  // Create owner membership in new subcollection
  await createOwnerMembership(uid, companyId, name.trim());

  // Create invitations for employees with emails
  for (const emp of normalizedEmployees) {
    if (emp.email) {
      await createInvitation(emp.email, {
        companyId,
        companyName: name.trim(),
        name: emp.name,
      });
    }
  }

  return companyId;
}

// ─── Employee management ──────────────────────────────────────────────────────

export async function addEmployee(companyId, { name, email }) {
  const emp = normalizeEmployee({ name, email });
  const companyRef = doc(db, 'companies', companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) return;
  const employees = [...(snap.data().employees || []).map(normalizeEmployee), emp];
  await updateDoc(companyRef, { employees, updatedAt: Date.now() });

  // Create invitation if email provided
  if (emp.email) {
    const companySnap = snap.data();
    await createInvitation(emp.email, {
      companyId,
      companyName: companySnap.name,
      name: emp.name,
    });
  }
}

export async function removeEmployee(companyId, emp) {
  const companyRef = doc(db, 'companies', companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) return;
  const employees = (snap.data().employees || [])
    .map(normalizeEmployee)
    .filter((e) => !(e.name === emp.name && e.email === emp.email));
  await updateDoc(companyRef, { employees, updatedAt: Date.now() });
}

export async function linkEmployeeEmail(companyId, empName, email) {
  const companyRef = doc(db, 'companies', companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) return;
  const cleanEmail = email.trim().toLowerCase();
  const employees = (snap.data().employees || []).map((e) => {
    const n = normalizeEmployee(e);
    if (n.name === empName && !n.email) return { ...n, email: cleanEmail };
    return n;
  });
  await updateDoc(companyRef, { employees, updatedAt: Date.now() });
  await createInvitation(cleanEmail, {
    companyId,
    companyName: snap.data().name,
    name: empName,
  });
}

export async function updateEmployeePermissions(companyId, empName, permissions) {
  const companyRef = doc(db, 'companies', companyId);
  const snap = await getDoc(companyRef);
  if (!snap.exists()) return;
  const employees = (snap.data().employees || []).map((e) => {
    const n = normalizeEmployee(e);
    if (n.name === empName) return { ...n, permissions: { ...n.permissions, ...permissions } };
    return n;
  });
  await updateDoc(companyRef, { employees, updatedAt: Date.now() });
}

export async function updateCompanyName(companyId, name) {
  await updateDoc(doc(db, 'companies', companyId), { name: name.trim(), updatedAt: Date.now() });
}

export async function saveEmailConfig(companyId, config) {
  await updateDoc(doc(db, 'companies', companyId), {
    emailConfig: {
      publicKey: (config.publicKey || '').trim(),
      serviceId: (config.serviceId || '').trim(),
      templateId: (config.templateId || '').trim(),
    },
    updatedAt: Date.now(),
  });
}

export async function saveCompanyFlags(companyId, flags) {
  await updateDoc(doc(db, 'companies', companyId), {
    ...flags,
    updatedAt: Date.now(),
  });
}

export async function saveInvoiceInfo(companyId, info) {
  await updateDoc(doc(db, 'companies', companyId), {
    invoiceInfo: {
      address: (info.address || '').trim(),
      phone: (info.phone || '').trim(),
      email: (info.email || '').trim(),
      terms: (info.terms || '').trim(),
    },
    updatedAt: Date.now(),
  });
}
