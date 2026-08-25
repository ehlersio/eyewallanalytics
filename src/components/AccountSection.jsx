import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../utils/AuthContext';

// Tailwind migration (Session 95, Phase 1) -- previously AccountSection.css.
// Every `var(--text-primary)` below was `var(--text-primary)` in the
// original CSS -- that custom property is never defined anywhere in the
// codebase (same class of bug as Phase 0's --bg-1/--bg-2 fix). Verified
// live: the invalid reference made `color` fall back to its inherited
// value, which traces back to `html,body,#root`'s `color: var(--text)` --
// i.e. it already rendered as var(--text) today, just by coincidence of
// the DOM's inheritance chain. Using var(--text) directly here reproduces
// the exact same computed color with no visual change, while fixing the
// dead reference.
// A handful of original class names are kept as literal marker strings
// alongside the Tailwind utilities below (account-row-button/
// account-row-label/account-avatar/account-badge/account-signin-form/
// account-signin-input/account-signin-error/account-signin-cancel/
// account-signin-submit) -- auth.cy.js selects and asserts on these exact
// class names. They carry no CSS of their own anymore; Tailwind owns the
// visuals, these are pure test hooks now.
const SECTION_CLASSES = 'mb-3.5 pb-3 border-b-[0.5px] border-b-[var(--border-2)]';
const ROW_CLASSES = 'flex items-center gap-2.5 w-full py-1.5 bg-transparent border-0 text-left [font:inherit]';
const ROW_BUTTON_CLASSES = 'account-row-button cursor-pointer rounded-[8px] [transition:opacity_0.15s] hover:opacity-80';
const ROW_STATIC_CLASSES = 'cursor-default';
const ROW_ICON_CLASSES = 'text-[16px] w-[22px] text-center shrink-0';
const ROW_LABEL_CLASSES = 'account-row-label flex-1 text-[14px] font-semibold text-[color:var(--text)] overflow-hidden text-ellipsis whitespace-nowrap';
const ROW_LABEL_MUTED_CLASSES = 'font-medium text-[color:var(--text-muted)]';
const ROW_CHEVRON_CLASSES = 'text-[14px] text-[color:var(--text-dim)] shrink-0';
const AVATAR_CLASSES = 'account-avatar w-[26px] h-[26px] rounded-full bg-[var(--team-primary)] text-white flex items-center justify-center text-[12px] font-bold shrink-0';
const BADGE_CLASSES = 'account-badge text-[9px] font-bold uppercase tracking-[0.05em] text-[color:var(--green)] bg-[rgba(61,186,126,0.12)] py-[3px] px-[7px] rounded-[6px] shrink-0';
const SIGNIN_FORM_CLASSES = 'account-signin-form flex flex-col gap-2';
const SIGNIN_LABEL_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)]';
const SIGNIN_INPUT_CLASSES = 'account-signin-input py-[9px] px-2.5 rounded-[8px] border-[0.5px] border-[var(--border-2)] bg-[var(--bg3)] text-[color:var(--text)] text-[13px] focus:[outline:1.5px_solid_var(--team-primary)]';
const SIGNIN_ERROR_CLASSES = 'account-signin-error text-[11px] text-[color:var(--red-bright)] m-0';
const SIGNIN_ACTIONS_CLASSES = 'flex gap-2 mt-0.5';
const SIGNIN_CANCEL_CLASSES = 'account-signin-cancel py-2 px-2.5 rounded-[8px] border-0 bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] font-semibold cursor-pointer';
const SIGNIN_SUBMIT_CLASSES = 'account-signin-submit flex-1 py-2 px-2.5 rounded-[8px] border-0 bg-[var(--team-primary)] text-white text-[12px] font-bold cursor-pointer disabled:opacity-60 disabled:cursor-wait';
const SIGNIN_SENT_TITLE_CLASSES = 'text-[14px] font-bold text-[color:var(--text)] mb-1.5';
const SIGNIN_SENT_DESC_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.5] mb-2.5';

// Account section for the Settings popup — Phase 0 of Supabase Auth.
// Three states: signed-out row, two-step sign-in (email → check-your-email),
// and signed-in (avatar + email + Synced badge, sign-out row below).
export default function AccountSection() {
  const { user, loading, isAuthenticated, signInWithOtp, signOut } = useAuth();
  const [step, setStep] = useState('idle'); // 'idle' | 'email' | 'sent'
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const compactRowRef = useRef(null);

  // Settings popup (.notif-popup, in NotificationBell.jsx) is a scrollable
  // panel taller than its own max-height in every state (confirmed: adding
  // the Language row, Session ~locale, pushed it into overflow even in the
  // compact view). Cypress's click() scrolls the Cancel/Sign-out button
  // into view before clicking it -- since those buttons sit lower in the
  // taller "form open"/"signed in" states, that can leave the popup's
  // scroll offset such that this row, back at the top of a now-shorter
  // compact view, sits above the visible area. scrollIntoView('nearest')
  // corrects it without assuming exact scroll math.
  useEffect(() => {
    if (step === 'idle') {
      compactRowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [step, isAuthenticated]);

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
      <div className={SECTION_CLASSES}>
        <div className={`${ROW_CLASSES} ${ROW_STATIC_CLASSES}`}>
          <span className={ROW_ICON_CLASSES}>✉️</span>
          <span className={ROW_LABEL_CLASSES}>Loading…</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const initial = (user.email || '?').charAt(0).toUpperCase();
    return (
      <div className={SECTION_CLASSES} ref={compactRowRef}>
        <div className={`${ROW_CLASSES} ${ROW_STATIC_CLASSES}`}>
          <span className={AVATAR_CLASSES}>{initial}</span>
          <span className={ROW_LABEL_CLASSES}>{user.email}</span>
          <span className={BADGE_CLASSES}>Synced</span>
        </div>
        <button className={`${ROW_CLASSES} ${ROW_BUTTON_CLASSES}`} onClick={handleSignOut}>
          <span className={ROW_ICON_CLASSES}>↩️</span>
          <span className={`${ROW_LABEL_CLASSES} ${ROW_LABEL_MUTED_CLASSES}`}>Sign out</span>
        </button>
      </div>
    );
  }

  if (step === 'email') {
    return (
      <div className={SECTION_CLASSES}>
        <form className={SIGNIN_FORM_CLASSES} onSubmit={handleSubmit}>
          <label className={SIGNIN_LABEL_CLASSES} htmlFor="account-email-input">
            Sign in with email
          </label>
          <input
            id="account-email-input"
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            className={SIGNIN_INPUT_CLASSES}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className={SIGNIN_ERROR_CLASSES}>{error}</p>}
          <div className={SIGNIN_ACTIONS_CLASSES}>
            <button type="button" className={SIGNIN_CANCEL_CLASSES} onClick={resetFlow}>
              Cancel
            </button>
            <button type="submit" className={SIGNIN_SUBMIT_CLASSES} disabled={sending}>
              {sending ? 'Sending…' : 'Send magic link'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className={SECTION_CLASSES}>
        <div>
          <div className={SIGNIN_SENT_TITLE_CLASSES}>📬 Check your email</div>
          <p className={SIGNIN_SENT_DESC_CLASSES}>
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish signing in.
          </p>
          <button className={SIGNIN_CANCEL_CLASSES} onClick={resetFlow}>
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={SECTION_CLASSES} ref={compactRowRef}>
      <button className={`${ROW_CLASSES} ${ROW_BUTTON_CLASSES}`} onClick={() => setStep('email')}>
        <span className={ROW_ICON_CLASSES}>✉️</span>
        <span className={ROW_LABEL_CLASSES}>Sign in to sync across devices</span>
        <span className={ROW_CHEVRON_CLASSES}>›</span>
      </button>
    </div>
  );
}
