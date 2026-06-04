import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { supported, permission, subscribed, subscribe, unsubscribe, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  // Don't render at all if browser doesn't support push
  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      const ok = await subscribe();
      if (ok) setOpen(false);
    }
  };

  const handleOpenSummary = (summary) => {
    setOpen(false);
    openSummary(summary);
  };

  // Show a dot on the bell if there are summaries available
  const hasSummaries = summaries.length > 0;

  return (
    <div className="notif-wrap">
      <button
        className='notif-bell notif-active'
        onClick={() => setOpen(o => !o)}
        aria-label={'Game Center'}
        title={'Game Center'}
      >
        {'⚡'}
      </button>

      {open && (
        <div className="notif-popup">
          <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

          <div className="notif-title">⚡ Game Center</div>

          <p className="notif-desc">
            {subscribed
              ? 'You\'ll get notified when the Canes score a goal, start a game, or win.'
              : 'Get instant alerts on your phone when the Canes score, start a game, or win — even when the app is closed.'}
          </p>

          {permission === 'denied' && (
            <p className="notif-blocked">
              Notifications are blocked in your browser settings. To enable, click the 🔒 in your address bar and allow notifications for this site.
            </p>
          )}

          {error && <p className="notif-error">{error}</p>}

          {permission !== 'denied' && (
            <button
              className={`notif-toggle-btn ${subscribed ? 'notif-off-btn' : 'notif-on-btn'}`}
              onClick={handleToggle}
              disabled={loading}
            >
              {loading
                ? 'Working…'
                : subscribed
                ? 'Turn off notifications'
                : 'Turn on notifications'}
            </button>
          )}

          <div className="notif-events">
            <div className="notif-event-label">🔔 Push Notifications</div>
            {[
              ['🚨', 'Canes goal scored'],
              ['🏒', 'Game starts'],
              ['🏆', 'Canes win'],
              ['😤', 'Opponent penalty (PP!)'],
            ].map(([icon, label]) => (
              <div key={label} className="notif-event-row">
                <span>{icon}</span>
                <span>{label}</span>
                {subscribed && <span className="notif-check">✓</span>}
              </div>
            ))}
          </div>

          {/* Period summaries section */}
          {hasSummaries && (
            <div className="notif-summaries-section">
              <div className="notif-summaries-label">📋 Game Center</div>
              {summaries.map(s => (
                <button
                  key={s.period}
                  className={`notif-summary-chip ${s.isGameSummary ? 'notif-summary-chip-game' : ''}`}
                  onClick={() => handleOpenSummary(s)}
                >
                  <span className="notif-summary-chip-period">
                    {s.isGameSummary ? 'FINAL' : s.periodShort}
                  </span>
                  <span className="notif-summary-chip-score">
                    {s.carGoals !== undefined
                      ? `CAR ${s.carGoals}–${s.oppGoals}`
                      : 'View summary'}
                  </span>
                  <span className="notif-summary-chip-arrow">›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
