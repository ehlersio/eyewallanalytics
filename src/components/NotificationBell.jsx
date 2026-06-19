import { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { getTheme, setTheme } from '../utils/themeConfig';
import { applyTeamTheme } from '../utils/applyTeamTheme';
import TeamLogo from '../components/TeamLogo';
import './NotificationBell.css';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { sport, isPWHL } = useSport();
  const activeTeam = isPWHL ? PWHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const activeTeamName = activeTeam?.displayName || TEAM_CONFIG.displayName;
  const [theme, setThemeState] = useState(getTheme);
  const { supported, permission, subscribed, subscribe, unsubscribe, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  const handleChangeTeam = () => {
    setOpen(false);
    // Clear sport selection so user returns to league picker
    localStorage.removeItem('eyewall:sport');
    localStorage.removeItem('eyewall:team');
    localStorage.removeItem('eyewall:pwhl_team');
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
              <TeamLogo abbr={activeTeamAbbr} size={28} sport={isPWHL ? 'pwhl' : 'nhl'} />
              <span className="notif-team-name">{activeTeamName}</span>
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
              ? `You'll get notified when the ${activeTeamName} score a goal, start a game, or win.`
              : `Get instant alerts on your phone when the ${activeTeamName} score, start a game, or win — even when the app is closed.`}
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
              ['🚨', `${activeTeamName} goal scored`],
              ['🏒', 'Game starts'],
              ['🏆', `${activeTeamName} win`],
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
                      ? `${activeTeamAbbr} ${s.carGoals}–${s.oppGoals}`
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
