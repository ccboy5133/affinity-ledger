import { useEffect, useState } from 'react';
import {
  doc, collection, onSnapshot, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Hook: list all companies this user belongs to ────────────────────────────
// Reads /memberships/{uid}/companies subcollection
export function useMemberships(uid) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) { setMemberships([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'memberships', uid, 'companies'),
      (snap) => {
        setMemberships(snap.docs.map((d) => ({ companyId: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => { console.error('Memberships error:', err); setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [uid]);

  return { memberships, loading, error };
}

// ─── Create membership entries ────────────────────────────────────────────────

export async function createOwnerMembership(uid, companyId, companyName) {
  await setDoc(doc(db, 'memberships', uid, 'companies', companyId), {
    role: 'owner',
    companyName,
    joinedAt: Date.now(),
  });
}

export async function createEmployeeMembership(uid, { companyId, companyName, name, email }) {
  await setDoc(doc(db, 'memberships', uid, 'companies', companyId), {
    role: 'employee',
    companyName,
    name,
    email,
    joinedAt: Date.now(),
  });
}

// ─── Invitations: /invites/{encodedEmail}/{companyId} ─────────────────────────

export async function checkInvitations(email) {
  if (!email) return [];
  const snap = await getDocs(collection(db, 'invites', encodeEmail(email), 'pending'));
  return snap.docs
    .map((d) => ({ companyId: d.id, ...d.data() }))
    .filter((i) => i.status === 'pending');
}

export async function acceptInvitation(uid, invite, userEmail) {
  const { companyId, companyName, name } = invite;

  await createEmployeeMembership(uid, { companyId, companyName, name, email: userEmail });

  // Link uid into the company employees array
  const companyRef = doc(db, 'companies', companyId);
  const companySnap = await getDoc(companyRef);
  if (companySnap.exists()) {
    const employees = (companySnap.data().employees || []).map((emp) => {
      const e = normalizeEmployee(emp);
      if (e.email.toLowerCase() === userEmail.toLowerCase()) return { ...e, uid };
      return e;
    });
    await updateDoc(companyRef, { employees, updatedAt: Date.now() });
  }

  await updateDoc(doc(db, 'invites', encodeEmail(userEmail), 'pending', companyId), {
    status: 'accepted', acceptedAt: Date.now(), uid,
  });
}

export async function declineInvitation(userEmail, companyId) {
  await updateDoc(doc(db, 'invites', encodeEmail(userEmail), 'pending', companyId), {
    status: 'declined', declinedAt: Date.now(),
  });
}

export async function createInvitation(userEmail, { companyId, companyName, name }) {
  await setDoc(doc(db, 'invites', encodeEmail(userEmail), 'pending', companyId), {
    companyId,
    companyName,
    name,
    email: userEmail,
    status: 'pending',
    createdAt: Date.now(),
  });
}

// ─── Migration: recover lost membership from multiple legacy patterns ─────────
export async function migrateOldMembership(uid) {
  // Pattern 1: old flat /memberships/{uid} doc with a companyId field
  try {
    const oldRef = doc(db, 'memberships', uid);
    const oldSnap = await getDoc(oldRef);
    if (oldSnap.exists()) {
      const old = oldSnap.data();
      const companyId = old.companyId;
      if (companyId) {
        console.log('[migrate] Found legacy flat membership doc, companyId:', companyId);
        const companySnap = await getDoc(doc(db, 'companies', companyId)).catch(() => null);
        const companyName = companySnap?.exists() ? companySnap.data().name : 'My Company';
        if (old.role === 'owner') {
          await createOwnerMembership(uid, companyId, companyName);
        } else {
          await createEmployeeMembership(uid, {
            companyId,
            companyName,
            name: old.name || '',
            email: old.email || '',
          });
        }
        await deleteDoc(oldRef).catch(() => {});
        return true;
      }
    }
  } catch (e) {
    console.warn('[migrate] Pattern 1 failed:', e.message);
  }

  // Pattern 2: very old architecture where company doc ID === uid
  try {
    const legacyRef = doc(db, 'companies', uid);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const data = legacySnap.data();
      console.log('[migrate] Found legacy company doc at /companies/{uid}, name:', data.name);
      // Patch ownerId onto the doc so new rules recognise it
      if (!data.ownerId) {
        await updateDoc(legacyRef, { ownerId: uid, updatedAt: Date.now() }).catch(() => {});
      }
      await createOwnerMembership(uid, uid, data.name || 'My Company');
      return true;
    }
  } catch (e) {
    console.warn('[migrate] Pattern 2 failed:', e.message);
  }

  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function encodeEmail(email) {
  return email.toLowerCase().replace(/\./g, ',');
}

export function normalizeEmployee(emp) {
  if (typeof emp === 'string') {
    return { name: emp, email: '', uid: null, permissions: { canAddEvents: true, canCreateInvoices: false } };
  }
  return {
    name: emp.name || '',
    email: emp.email || '',
    uid: emp.uid || null,
    permissions: {
      canAddEvents: emp.permissions?.canAddEvents ?? true,
      canCreateInvoices: emp.permissions?.canCreateInvoices ?? false,
    },
  };
}
