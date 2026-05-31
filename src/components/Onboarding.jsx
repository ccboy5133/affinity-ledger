import React, { useState } from 'react';
import { createCompany } from '../hooks/useCompany';
import { signOut } from '../firebase';

export default function Onboarding({ user, onCreated }) {
  const [companyName, setCompanyName] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [employees, setEmployees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function addEmp(e) {
    e?.preventDefault();
    const name = empName.trim();
    const email = empEmail.trim().toLowerCase();
    if (!name) return;
    if (employees.find((n) => n.name === name)) return;
    setEmployees([...employees, { name, email, uid: null }]);
    setEmpName('');
    setEmpEmail('');
  }

  function removeEmp(name) {
    setEmployees(employees.filter((e) => e.name !== name));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    setBusy(true);
    try {
      await createCompany(user.uid, { name: companyName, employees });
      await onCreated();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not save company.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card auth-card-wide" onSubmit={handleSubmit}>
        <div className="auth-brand">Set up your company</div>
        <div className="auth-tag">Signed in as {user.email}</div>

        <label className="field">
          <span>Company name</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Affinity AI"
            autoFocus
          />
        </label>

        <div className="field">
          <span>Add employees</span>
          <div className="emp-grid">
            <input
              type="text"
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmp(); } }}
              placeholder="Full name"
            />
            <input
              type="email"
              value={empEmail}
              onChange={(e) => setEmpEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmp(); } }}
              placeholder="Email (optional — for invite)"
            />
            <button type="button" className="btn-secondary" onClick={addEmp}>Add</button>
          </div>
          <div className="field-hint">Employees with an email will be auto-linked when they sign in.</div>
        </div>

        {employees.length > 0 && (
          <div className="emp-list">
            {employees.map((emp) => (
              <div key={emp.name} className="emp-item">
                <div className="emp-item-info">
                  <span className="emp-item-name">{emp.name}</span>
                  {emp.email && <span className="emp-item-email">{emp.email}</span>}
                </div>
                <button type="button" className="icon-btn" onClick={() => removeEmp(emp.name)}>×</button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-actions">
          <button type="button" className="btn-ghost" onClick={() => signOut()}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Continue to dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
}
