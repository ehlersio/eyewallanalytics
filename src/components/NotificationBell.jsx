import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { supported, permission, subscribed, subscribe, unsubscribe, loading, error } =
    usePushNotifications();

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

  return (
    <div className="notif-wrap">
      <button
        className={`notif-bell ${subscribed ? 'notif-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={subscribed ? 'Notification settings' : 'Enable notifications'}
        title={subscribed ? 'Notifications on' : 'Get notified of goals & game events'}
      >
        {subscribed ? '🔔' : '🔕'}
      </button>

      {open && (
        <div className="notif-popup">
          <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

          <div className="notif-title">
            {subscribed ? '🔔 Notifications on' : '🔕 Notifications off'}
          </div>

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
            <div className="notif-event-label">You\'ll be notified for:</div>
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
        </div>
      )}
    </div>
  );
}
