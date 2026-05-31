import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useMemberships, checkInvitations, migrateOldMembership, createOwnerMembership } from './hooks/useMembership';
import { findOwnedCompanies } from './hooks/useCompany';
import { useCompany } from './hooks/useCompany';
import { signOut } from './firebase';
import Login from './components/Login.jsx';
import CompanySelector from './components/CompanySelector.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const { memberships, loading: membershipsLoading } = useMemberships(user?.uid);

  const [bootstrap, setBootstrap] = useState({ done: false, invites: [] });
  const [activeCompanyId, setActiveCompanyId] = useState(null);

  // Run once after memberships load: migrate legacy doc + fetch pending invites
  useEffect(() => {
    if (!user || membershipsLoading) return;
    if (bootstrap.done) return;

    async function run() {
      try {
        if (memberships.length === 0) {
          // 1. Try migrating a legacy flat membership doc
          const migrated = await migrateOldMembership(user.uid).catch(() => false);

          // 2. If nothing was migrated, scan for companies this uid owns
          //    (recovers the link if the membership doc was lost)
          if (!migrated) {
            const owned = await findOwnedCompanies(user.uid).catch(() => []);
            for (const co of owned) {
              await createOwnerMembership(user.uid, co.id, co.name).catch(() => {});
            }
          }
        }
        const invites = await checkInvitations(user.email).catch(() => []);
        setBootstrap({ done: true, invites });
      } catch (err) {
        console.error('Bootstrap error:', err);
        setBootstrap({ done: true, invites: [] });
      }
    }

    run();
  }, [user, membershipsLoading, bootstrap.done]);

  // Reset on sign-out
  useEffect(() => {
    if (!user) setBootstrap({ done: false, invites: [] });
  }, [user]);

  // Auto-select when there's exactly one company and no pending invites
  useEffect(() => {
    if (
      bootstrap.done &&
      !activeCompanyId &&
      memberships.length === 1 &&
      bootstrap.invites.length === 0
    ) {
      setActiveCompanyId(memberships[0].companyId);
    }
  }, [bootstrap, memberships, activeCompanyId]);

  // ── All hooks above this line ────────────────────────────────────────────────

  if (authLoading) return <SplashScreen status="Checking authentication…" />;
  if (!user) return <Login />;
  if (membershipsLoading || !bootstrap.done) return <SplashScreen user={user} status="Loading workspace…" />;

  if (activeCompanyId) {
    const membership = memberships.find((m) => m.companyId === activeCompanyId);
    return (
      <CompanyDashboard
        user={user}
        companyId={activeCompanyId}
        memberships={memberships}
        role={membership?.role || 'employee'}
        onSwitch={() => setActiveCompanyId(null)}
        onSelectCompany={(id) => setActiveCompanyId(id)}
      />
    );
  }

  // Waiting for auto-select effect to fire
  if (memberships.length === 1 && bootstrap.invites.length === 0) {
    return <SplashScreen user={user} />;
  }

  return (
    <CompanySelector
      user={user}
      memberships={memberships}
      pendingInvites={bootstrap.invites}
      onSelect={(companyId) => setActiveCompanyId(companyId)}
      onInviteAccepted={() => setBootstrap((b) => ({ ...b, invites: [] }))}
    />
  );
}

// Loads the company doc then renders the dashboard
function CompanyDashboard({ user, companyId, memberships, role, onSwitch, onSelectCompany }) {
  const { company, loading, error } = useCompany(companyId);

  if (loading) return <SplashScreen user={user} status="Loading company…" />;
  if (error) return <ErrorScreen error={error} />;
  if (!company) return <ErrorScreen error="Company not found — it may have been deleted." />;

  return (
    <Dashboard
      user={user}
      company={company}
      memberships={memberships}
      role={role}
      onSwitch={onSwitch}
      onSelectCompany={onSelectCompany}
    />
  );
}

// ─── Shared screens ───────────────────────────────────────────────────────────

export function SplashScreen({ user, status }) {
  return (
    <div className="splash">
      {user && (
        <button className="splash-signout" onClick={() => signOut()}>Sign out</button>
      )}
      <div className="splash-mark">Affinity Ledger</div>
      <div className="splash-loader">
        <div className="splash-dots">
          <span /><span /><span />
        </div>
        {status && <div className="splash-status">{status}</div>}
      </div>
    </div>
  );
}

export function ErrorScreen({ error }) {
  return (
    <div className="splash">
      <button className="splash-signout" onClick={() => signOut()}>Sign out</button>
      <div className="splash-mark">Affinity Ledger</div>
      <div className="splash-error">
        <div className="splash-error-title">Something went wrong</div>
        <div className="splash-error-body">{error}</div>
        <div className="splash-error-hint">
          If this is a Firestore permissions error, publish the security rules from the README.
        </div>
      </div>
    </div>
  );
}
