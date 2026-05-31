import React from 'react';
import { signOut } from '../firebase';

// Catches render/runtime errors anywhere in the tree and shows a recoverable
// screen instead of a blank window.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="splash">
        <div className="splash-mark">Affinity Ledger</div>
        <div className="splash-error">
          <div className="splash-error-title">Something went wrong</div>
          <div className="splash-error-body">
            {this.state.error?.message || String(this.state.error)}
          </div>
          <div className="splash-error-hint">
            Try reloading. If it keeps happening, sign out and back in.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button className="btn-ghost" onClick={() => signOut().finally(() => window.location.reload())}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
}
