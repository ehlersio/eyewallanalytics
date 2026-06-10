import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { getTheme, setTheme } from '../utils/themeConfig';
import { applyTeamTheme } from '../utils/applyTeamTheme';
import TeamLogo from '../components/TeamLogo';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme);
  const { supported, permission, subscribed, subscribe, unsubscribe, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  const handleChangeTeam = () => {
    setOpen(false);
    localStorage.removeItem('eyewall:team');
    window.location.reload();
  };

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTeamTheme(TEAM_CONFIG, next);
    setThemeState(next);
  };

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

  const hasSummaries = summaries.length > 0;

  return (
    <div className="notif-wrap">
      <button
        className='notif-bell notif-active'
        onClick={() => setOpen(o => !o)}
        aria-label={'Settings'}
        title={'Settings'}
      >
        {'⚙️'}
      </button>

      {open && (
        <div className="notif-popup">
          <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

          <div className="notif-title">⚙️ Settings</div>

          {/* My Team section */}
          <div className="notif-my-team">
            <div className="notif-event-label">🏒 My Team</div>
            <div className="notif-team-row">
              <TeamLogo abbr={TEAM_CONFIG.abbr} size={28} />
              <span className="notif-team-name">{TEAM_CONFIG.displayName}</span>
              <button className="notif-change-team-btn" onClick={handleChangeTeam}>
                Change
              </button>
            </div>
          </div>

          {/* Appearance section */}
          <div className="notif-my-team">
            <div className="notif-event-label">🎨 Appearance</div>
            <div className="notif-team-row">
              <span className="notif-team-name">{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
              <button className="notif-change-team-btn" onClick={handleThemeToggle}>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </div>

          <p className="notif-desc">
            {subscribed
              ? `You'll get notified when the ${TEAM_CONFIG.displayName} score a goal, start a game, or win.`
              : `Get instant alerts on your phone when the ${TEAM_CONFIG.displayName} score, start a game, or win — even when the app is closed.`}
          </p>

          {permission === 'denied' && (
            <p className="notif-blocked">
              Notifications are blocked in your browser settings. To enable, click the 🔒 in your address bar and allow notifications for this site.
            </p>
          )}

          {error && <p className="notif-error">{error}</p>}

          {supported && permission !== 'denied' && (
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

          {supported && (
          <div className="notif-events">
            <div className="notif-event-label">🔔 Push Notifications</div>
            {[
              ['🚨', `${TEAM_CONFIG.displayName} goal scored`],
              ['🏒', 'Game starts'],
              ['🏆', `${TEAM_CONFIG.displayName} win`],
              ['😤', 'Opponent penalty (PP!)'],
            ].map(([icon, label]) => (
              <div key={label} className="notif-event-row">
                <span>{icon}</span>
                <span>{label}</span>
                {subscribed && <span className="notif-check">✓</span>}
              </div>
            ))}
          </div>
          )}

          {/* Period summaries section */}
          {hasSummaries && (
            <div className="notif-summaries-section">
              <div className="notif-summaries-label">📋 Game Summaries</div>
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
                      ? `${TEAM_CONFIG.abbr} ${s.carGoals}–${s.oppGoals}`
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
