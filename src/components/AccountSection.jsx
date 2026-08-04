import { useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import './AccountSection.css';

// Account section for the Settings popup — Phase 0 of Supabase Auth.
// Three states: signed-out row, two-step sign-in (email → check-your-email),
// and signed-in (avatar + email + Synced badge, sign-out row below).
export default function AccountSection() {
  const { user, loading, isAuthenticated, signInWithOtp, signOut } = useAuth();
  const [step, setStep] = useState('idle'); // 'idle' | 'email' | 'sent'
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const resetFlow = () => {
    setStep('idle');
    setEmail('');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const { error: otpError } = await signInWithOtp(email.trim());
    setSending(false);
    if (otpError) {
      setError(otpError.message || 'Could not send sign-in link. Try again.');
      return;
    }
    setStep('sent');
  };

  const handleSignOut = async () => {
    await signOut();
    resetFlow();
  };

  if (loading) {
    return (
      <div className="account-section">
        <div className="account-row account-row-static">
          <span className="account-row-icon">✉️</span>
          <span className="account-row-label">Loading…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const initial = (user.email || '?').charAt(0).toUpperCase();
    return (
      <div className="account-section">
        <div className="account-row account-row-static">
          <span className="account-avatar">{initial}</span>
          <span className="account-row-label">{user.email}</span>
          <span className="account-badge">Synced</span>
        </div>
        <button className="account-row account-row-button" onClick={handleSignOut}>
          <span className="account-row-icon">↩️</span>
          <span className="account-row-label account-row-label-muted">Sign out</span>
        </button>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <div className="account-section">
        <form className="account-signin-form" onSubmit={handleSubmit}>
          <label className="account-signin-label" htmlFor="account-email-input">
            Sign in with email
          </label>
          <input
            id="account-email-input"
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="account-signin-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="account-signin-error">{error}</p>}
          <div className="account-signin-actions">
            <button type="button" className="account-signin-cancel" onClick={resetFlow}>
              Cancel
            </button>
            <button type="submit" className="account-signin-submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send magic link'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className="account-section">
        <div className="account-signin-sent">
          <div className="account-signin-sent-title">📬 Check your email</div>
          <p className="account-signin-sent-desc">
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish signing in.
          </p>
          <button className="account-signin-cancel" onClick={resetFlow}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account-section">
      <button className="account-row account-row-button" onClick={() => setStep('email')}>
        <span className="account-row-icon">✉️</span>
        <span className="account-row-label">Sign in to sync across devices</span>
        <span className="account-row-chevron">›</span>
      </button>
    </div>
  );
}
