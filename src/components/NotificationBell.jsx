import { useState, useCallback } from 'react';
import { usePushNotifications, loadPrefs, savePrefs } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { getTheme, setTheme } from '../utils/themeConfig';
import { applyTeamTheme } from '../utils/applyTeamTheme';
import TeamLogo from '../components/TeamLogo';
import './NotificationBell.css';

// ── Preference definitions ────────────────────────────────────

const PREF_GROUPS = [
  {
    label: 'Game Flow',
    items: [
      { key: 'gameStart',   icon: '🏒', label: 'Game starts' },
      { key: 'periodStart', icon: '🔔', label: 'Period starts (P2, P3, OT)' },
      { key: 'periodEnd',   icon: '🔕', label: 'Period ends' },
    ],
  },
  {
    label: 'Goals',
    items: [
      { key: 'goal',     icon: '🚨', label: 'Team goal scored' },
      { key: 'oppGoal',  icon: '😬', label: 'Opponent goal scored' },
      { key: 'hatTrick', icon: '🎩', label: 'Hat trick' },
    ],
  },
  {
    label: 'Special Teams',
    items: [
      { key: 'penalty',      icon: '⚡', label: 'Power play opportunity' },
      { key: 'goaliePulled', icon: '🥅', label: 'Opponent pulls goalie' },
    ],
  },
  {
    label: 'Result',
    items: [
      { key: 'win',  icon: '🏆', label: 'Win' },
      { key: 'loss', icon: '📉', label: 'Loss' },
    ],
  },
];

export default function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const { isPWHL }              = useSport();
  const activeTeam              = isPWHL ? PWHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr          = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const activeTeamName          = activeTeam?.displayName || TEAM_CONFIG.displayName;
  const [theme, setThemeState]  = useState(getTheme);
  const [prefs, setPrefsState]  = useState(() => loadPrefs());

  const { supported, permission, subscribed, subscribe, unsubscribe, updatePrefs, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  const handleChangeTeam = () => {
    setOpen(false);
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

  const leagueTeamKey = isPWHL ? `PWHL:${activeTeamAbbr}` : `NHL:${activeTeamAbbr}`;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      const ok = await subscribe(leagueTeamKey, prefs);
      if (ok) setOpen(false);
    }
  };

  const handlePrefToggle = useCallback(async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next);
    savePrefs(next);
    // Update server if already subscribed
    if (subscribed) {
      await updatePrefs(leagueTeamKey, next);
    }
  }, [prefs, subscribed, activeTeamAbbr, updatePrefs]);

  const handleOpenSummary = (summary) => {
    setOpen(false);
    openSummary(summary);
  };

  const hasSummaries = summaries.length > 0;

  return (
    <div className="notif-wrap">
      <button
        className="notif-bell notif-active"
        onClick={() => setOpen(o => !o)}
        aria-label="Settings"
        title="Settings"
      >
        ⚙️
      </button>

      {open && (
        <div className="notif-popup">
          <button className="notif-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>

          <div className="notif-title">⚙️ Settings</div>

          {/* My Team */}
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

          {/* Appearance */}
          <div className="notif-my-team">
            <div className="notif-event-label">🎨 Appearance</div>
            <div className="notif-team-row">
              <span className="notif-team-name">{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
              <button className="notif-change-team-btn" onClick={handleThemeToggle}>
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </div>

          {/* Push notifications */}
          {supported && (
            <>
              <p className="notif-desc">
                {subscribed
                  ? `Subscribed for ${activeTeamName} alerts.`
                  : `Get instant alerts on your phone for ${activeTeamName} — even when the app is closed.`}
              </p>

              {permission === 'denied' && (
                <p className="notif-blocked">
                  Notifications are blocked. Click 🔒 in your address bar and allow notifications for this site.
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

              {/* Preference toggles */}
              <div className="notif-events">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className="notif-event-label" style={{ marginBottom: 0 }}>🔔 Alert Preferences</div>
                  <button
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px' }}
                    onClick={() => setShowPrefs(p => !p)}
                  >
                    {showPrefs ? 'Hide ›' : 'Customize ›'}
                  </button>
                </div>

                {!showPrefs ? (
                  // Summary view — just show active prefs
                  PREF_GROUPS.flatMap(g => g.items)
                    .filter(item => prefs[item.key])
                    .map(item => (
                      <div key={item.key} className="notif-event-row">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                        {subscribed && <span className="notif-check">✓</span>}
                      </div>
                    ))
                ) : (
                  // Expanded preference editor
                  PREF_GROUPS.map(group => (
                    <div key={group.label} style={{ marginBottom: 10 }}>
                      <div className="notif-event-label" style={{ marginBottom: 4 }}>{group.label}</div>
                      {group.items.map(item => (
                        <div key={item.key} className="notif-event-row" style={{ cursor: 'pointer' }}
                          onClick={() => handlePrefToggle(item.key)}>
                          <span>{item.icon}</span>
                          <span style={{ color: prefs[item.key] ? 'var(--text)' : 'var(--text-dim)' }}>
                            {item.label}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 14 }}>
                            {prefs[item.key] ? '✅' : '⬜'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* Period summaries */}
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
