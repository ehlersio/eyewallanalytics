import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePushNotifications, loadPrefs, savePrefs } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import { useAuth } from '../utils/AuthContext';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { AHL_TEAM_CONFIG } from '../utils/ahlApi';
import { getTheme, setTheme } from '../utils/themeConfig';
import { getLocale, setLocale } from '../utils/localeConfig';
import { upsertLocale } from '../utils/localeSync';
import { applyTeamTheme } from '../utils/applyTeamTheme';
import TeamLogo from '../components/TeamLogo';
import AccountSection from './AccountSection';

// Tailwind migration (Session 95, Phase 1) -- previously NotificationBell.css.
// notif-summary-chip* classes below were previously defined in
// PeriodSummary.css (a later-phase file) -- this component is their only
// consumer (confirmed via grep), so they migrate here now rather than
// waiting on PeriodSummary's own phase; the now-dead rules are removed from
// PeriodSummary.css in this same change.
//
// .notif-bell always renders with `notif-active` alongside it in this
// codebase's one real usage below, and `.notif-bell.notif-active`'s
// opacity:1 always won over the plain `.notif-bell` rule's opacity:0.6 (via
// selector specificity) -- so the dimmed 0.6 state was already unreachable
// dead CSS before this migration touched it. Reproduced as always-1, not
// reintroduced as a real toggle.
//
// Several original class names are kept as literal marker strings
// alongside the Tailwind utilities (notif-bell/notif-popup/notif-close/
// notif-title/notif-change-team-btn/notif-summary-chip and its period/
// score/game variants) -- auth.cy.js, theme.cy.js, topnav-safe-area.cy.js,
// and period-summary.cy.js select and assert on these exact class names.
// They carry no CSS of their own anymore; Tailwind owns the visuals, these
// are pure test hooks now.
const WRAP_CLASSES = 'relative';
const BELL_CLASSES = 'notif-bell bg-transparent border-0 text-[18px] cursor-pointer py-1 px-1.5 rounded-[8px] [transition:opacity_0.15s]';
const POPUP_CLASSES = 'notif-popup absolute top-[calc(100%+10px)] right-0 z-[500] w-[280px] max-w-[calc(100vw-24px)] max-h-[min(560px,calc(100vh-90px))] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[16px] p-[18px] shadow-[var(--popup-shadow)] animate-[popupIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const CLOSE_CLASSES = 'notif-close absolute top-3 right-3.5 bg-transparent border-0 text-[14px] text-[color:var(--text-dim)] cursor-pointer py-0.5 px-[5px] hover:text-[color:var(--text)]';
const TITLE_CLASSES = 'notif-title text-[14px] font-bold text-[color:var(--text)] mb-2 pr-5';
const DESC_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-[1.5] mb-3.5';
const BLOCKED_CLASSES = 'text-[11px] text-[color:var(--amber)] bg-[rgba(240,160,48,0.1)] rounded-[8px] py-2 px-2.5 mb-3 leading-[1.5]';
const ERROR_CLASSES = 'text-[11px] text-[color:var(--red-bright)] mb-2.5';
const TOGGLE_BTN_BASE = 'w-full p-2.5 rounded-[10px] border-0 text-[13px] font-bold cursor-pointer [transition:opacity_0.15s] mb-3.5 disabled:opacity-50 disabled:cursor-wait enabled:hover:opacity-90';
const TOGGLE_BTN_ON = 'bg-[var(--red-bright)] text-white';
const TOGGLE_BTN_OFF = 'bg-[var(--bg3)] text-[color:var(--text-muted)]';
const EVENTS_CLASSES = 'flex flex-col gap-1.5';
const EVENT_LABEL_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-dim)] mb-0.5';
const EVENT_ROW_CLASSES = 'flex items-center gap-2 text-[12px] text-[color:var(--text-muted)]';
const CHECK_CLASSES = 'ml-auto text-[color:var(--green)] text-[12px]';
const SECTION_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-2';
const MY_TEAM_CLASSES = 'mb-3';
const TEAM_ROW_CLASSES = 'flex items-center gap-2 pt-2 px-0 pb-1';
const TEAM_NAME_CLASSES = 'flex-1 text-[14px] font-semibold text-[color:var(--text)]';
const CHANGE_TEAM_BTN_CLASSES = 'notif-change-team-btn py-1 px-2.5 text-[12px] rounded-[6px] border border-[var(--team-primary)] text-[color:var(--team-primary)] bg-transparent cursor-pointer font-medium [transition:background_0.15s] hover:bg-[rgba(var(--team-primary-rgb,204,0,0),0.1)]';

const SUMMARIES_SECTION_CLASSES = 'mt-3.5 pt-3.5 border-t-[0.5px] border-t-[var(--border)]';
const SUMMARIES_LABEL_CLASSES = 'text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--text-dim)] mb-2';
const SUMMARY_CHIP_BASE = 'notif-summary-chip flex items-center gap-2 w-full py-[9px] px-2.5 bg-[var(--bg2)] border-0 rounded-[8px] cursor-pointer mb-1 text-left [transition:background_0.15s] hover:bg-[var(--bg3)]';
const SUMMARY_CHIP_GAME = 'notif-summary-chip-game border-[0.5px] border-[rgba(var(--team-primary-rgb),0.3)] bg-[rgba(var(--team-primary-rgb),0.06)]';
const SUMMARY_CHIP_PERIOD_BASE = 'notif-summary-chip-period text-[11px] font-extrabold text-[color:var(--red-bright)] min-w-[24px]';
const SUMMARY_CHIP_PERIOD_GAME = 'text-[9px] tracking-[0.08em]';
const SUMMARY_CHIP_SCORE_CLASSES = 'notif-summary-chip-score text-[12px] font-bold text-[color:var(--text)] flex-1';
const SUMMARY_CHIP_ARROW_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';

// ── Preference definitions ────────────────────────────────────

// iOS Safari (and every iOS browser, since Apple mandates WebKit under
// the hood) only exposes the Web Push API to a PWA actually installed via
// "Add to Home Screen" — a regular browser tab never gets PushManager,
// even on iOS 16.4+. usePushNotifications()'s `supported` flag correctly
// comes back false there, but that used to just silently drop the whole
// section with no explanation. This distinguishes that specific, fixable
// case (show install instructions) from a genuinely unsupported browser.
function isIOSBrowserTab() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
}

// labelKey/itemLabelKey look up settings.prefGroup.*/settings.prefItem.* in
// i18n/locales/*.json.
const PREF_GROUPS = [
  {
    labelKey: 'settings.prefGroup.gameFlow',
    items: [
      { key: 'gameStart',   icon: '🏒', labelKey: 'settings.prefItem.gameStart' },
      { key: 'periodStart', icon: '🔔', labelKey: 'settings.prefItem.periodStart' },
      { key: 'periodEnd',   icon: '🔕', labelKey: 'settings.prefItem.periodEnd' },
    ],
  },
  {
    labelKey: 'settings.prefGroup.goals',
    items: [
      { key: 'goal',     icon: '🚨', labelKey: 'settings.prefItem.goal' },
      { key: 'oppGoal',  icon: '😬', labelKey: 'settings.prefItem.oppGoal' },
      { key: 'hatTrick', icon: '🎩', labelKey: 'settings.prefItem.hatTrick' },
    ],
  },
  {
    labelKey: 'settings.prefGroup.specialTeams',
    items: [
      { key: 'penalty',      icon: '⚡', labelKey: 'settings.prefItem.penalty' },
      { key: 'goaliePulled', icon: '🥅', labelKey: 'settings.prefItem.goaliePulled' },
    ],
  },
  {
    labelKey: 'settings.prefGroup.result',
    items: [
      { key: 'win',  icon: '🏆', labelKey: 'settings.prefItem.win' },
      { key: 'loss', icon: '📉', labelKey: 'settings.prefItem.loss' },
    ],
  },
];

export default function NotificationBell() {
  const { t }                   = useTranslation();
  const [open, setOpen]         = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const { isPWHL, isAHL }        = useSport();
  const { user }                 = useAuth();
  const activeTeam              = isPWHL ? PWHL_TEAM_CONFIG : isAHL ? AHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr          = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const activeTeamName          = activeTeam?.displayName || TEAM_CONFIG.displayName;
  const [theme, setThemeState]  = useState(getTheme);
  const [locale, setLocaleState] = useState(getLocale);
  const [prefs, setPrefsState]  = useState(() => loadPrefs());

  const { supported, permission, subscribed, subscribe, unsubscribe, updatePrefs, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  // Closes the popup and collapses the alert preferences editor back to
  // its compact summary view, so reopening settings later never starts
  // pre-expanded (this was why the popup could grow tall enough to cut
  // off Game Summaries on mobile — showPrefs never reset between opens).
  const closePopup = () => {
    setOpen(false);
    setShowPrefs(false);
  };

  const handleChangeTeam = () => {
    closePopup();
    localStorage.removeItem('eyewall:sport');
    localStorage.removeItem('eyewall:team');
    localStorage.removeItem('eyewall:pwhl_team');
    localStorage.removeItem('eyewall:ahl_team');
    localStorage.removeItem('eyewall:echl_team');
    // Signed-in users get their favorite team reconciled from the server on
    // every load (see favoriteTeamSync.js) -- without this flag, clearing
    // local storage here looks identical to "fresh device, no opinion yet"
    // to that reconciliation, which would silently re-apply the OLD server
    // value before TeamPicker ever renders, defeating this button entirely.
    // TeamPicker clears this flag itself once a new pick is made.
    localStorage.setItem('eyewall:team-change-pending', '1');
    // Navigate to root so TeamPicker shows at / regardless of current route.
    // After team selection, App.jsx redirects to the correct sport root.
    window.location.href = '/';
  };

  const handleThemeToggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTeamTheme(TEAM_CONFIG, next);
    setThemeState(next);
  };

  const handleLocaleToggle = () => {
    const next = locale === 'en' ? 'fr' : 'en';
    setLocale(next);
    setLocaleState(next);
    if (user?.id) upsertLocale(user.id, next);
  };

  // AHL has no live-game-tracking backend yet (see AHL_BUILD_BRIEF.md) --
  // this key is still computed for correctness (so the UI shows the right
  // team) but subscribing will have nothing to notify about server-side
  // until that exists.
  const leagueTeamKey = isPWHL ? `PWHL:${activeTeamAbbr}` : isAHL ? `AHL:${activeTeamAbbr}` : `NHL:${activeTeamAbbr}`;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      const ok = await subscribe(leagueTeamKey, prefs);
      if (ok) closePopup();
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
    closePopup();
    openSummary(summary);
  };

  const hasSummaries = summaries.length > 0;

  return (
    <div className={WRAP_CLASSES}>
      <button
        className={BELL_CLASSES}
        onClick={() => (open ? closePopup() : setOpen(true))}
        aria-label={t('settings.title')}
        title={t('settings.title')}
      >
        ⚙️
      </button>

      {open && (
        <div className={POPUP_CLASSES}>
          <button className={CLOSE_CLASSES} onClick={closePopup} aria-label={t('common.close')}>✕</button>

          <div className={TITLE_CLASSES}>⚙️ {t('settings.title')}</div>

          <AccountSection />

          <div className={SECTION_LABEL_CLASSES}>{t('settings.preferences')}</div>

          {/* My Team */}
          <div className={MY_TEAM_CLASSES}>
            <div className={EVENT_LABEL_CLASSES}>🏒 {t('settings.myTeam')}</div>
            <div className={TEAM_ROW_CLASSES}>
              <TeamLogo abbr={activeTeamAbbr} size={28} sport={isPWHL ? 'pwhl' : isAHL ? 'ahl' : 'nhl'} />
              <span className={TEAM_NAME_CLASSES}>{activeTeamName}</span>
              <button className={CHANGE_TEAM_BTN_CLASSES} onClick={handleChangeTeam}>
                {t('settings.change')}
              </button>
            </div>
          </div>

          {/* Appearance */}
          <div className={MY_TEAM_CLASSES}>
            <div className={EVENT_LABEL_CLASSES}>🎨 {t('settings.appearance')}</div>
            <div className={TEAM_ROW_CLASSES}>
              <span className={TEAM_NAME_CLASSES}>{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
              <button className={CHANGE_TEAM_BTN_CLASSES} onClick={handleThemeToggle}>
                {theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
              </button>
            </div>
          </div>

          {/* Language */}
          <div className={MY_TEAM_CLASSES}>
            <div className={EVENT_LABEL_CLASSES}>🌐 {t('settings.language')}</div>
            <div className={TEAM_ROW_CLASSES}>
              <span className={TEAM_NAME_CLASSES}>{locale === 'en' ? 'English' : 'Français'}</span>
              <button className={CHANGE_TEAM_BTN_CLASSES} onClick={handleLocaleToggle}>
                {locale === 'en' ? 'Français' : 'English'}
              </button>
            </div>
          </div>

          {/* Push notifications */}
          {!supported && (
            <div className={MY_TEAM_CLASSES}>
              <div className={EVENT_LABEL_CLASSES}>🔔 {t('settings.pushNotifications')}</div>
              <p className={DESC_CLASSES}>
                {isIOSBrowserTab()
                  ? t('settings.iosInstructions')
                  : t('settings.unsupported')}
              </p>
            </div>
          )}
          {supported && (
            <>
              <p className={DESC_CLASSES}>
                {subscribed
                  ? t('settings.subscribedText', { team: activeTeamName })
                  : t('settings.getAlertsText', { team: activeTeamName })}
              </p>

              {permission === 'denied' && (
                <p className={BLOCKED_CLASSES}>
                  {t('settings.blockedText')}
                </p>
              )}

              {error && <p className={ERROR_CLASSES}>{error}</p>}

              {permission !== 'denied' && (
                <button
                  className={`${TOGGLE_BTN_BASE} ${subscribed ? TOGGLE_BTN_OFF : TOGGLE_BTN_ON}`}
                  onClick={handleToggle}
                  disabled={loading}
                >
                  {loading
                    ? t('settings.working')
                    : subscribed
                    ? t('settings.turnOff')
                    : t('settings.turnOn')}
                </button>
              )}

              {/* Preference toggles */}
              <div className={EVENTS_CLASSES}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div className={EVENT_LABEL_CLASSES} style={{ marginBottom: 0 }}>🔔 {t('settings.alertPreferences')}</div>
                  <button
                    style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer', padding: '0 2px' }}
                    onClick={() => setShowPrefs(p => !p)}
                  >
                    {showPrefs ? t('settings.hide') : t('settings.customize')}
                  </button>
                </div>

                {!showPrefs ? (
                  // Summary view — just show active prefs
                  PREF_GROUPS.flatMap(g => g.items)
                    .filter(item => prefs[item.key])
                    .map(item => (
                      <div key={item.key} className={EVENT_ROW_CLASSES}>
                        <span>{item.icon}</span>
                        <span>{t(item.labelKey)}</span>
                        {subscribed && <span className={CHECK_CLASSES}>✓</span>}
                      </div>
                    ))
                ) : (
                  // Expanded preference editor
                  PREF_GROUPS.map(group => (
                    <div key={group.labelKey} style={{ marginBottom: 10 }}>
                      <div className={EVENT_LABEL_CLASSES} style={{ marginBottom: 4 }}>{t(group.labelKey)}</div>
                      {group.items.map(item => (
                        <div key={item.key} className={EVENT_ROW_CLASSES} style={{ cursor: 'pointer' }}
                          onClick={() => handlePrefToggle(item.key)}>
                          <span>{item.icon}</span>
                          <span style={{ color: prefs[item.key] ? 'var(--text)' : 'var(--text-dim)' }}>
                            {t(item.labelKey)}
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
            <div className={SUMMARIES_SECTION_CLASSES}>
              <div className={SUMMARIES_LABEL_CLASSES}>📋 {t('settings.gameSummaries')}</div>
              {summaries.map(s => (
                <button
                  key={s.period}
                  className={`${SUMMARY_CHIP_BASE} ${s.isGameSummary ? SUMMARY_CHIP_GAME : ''}`}
                  onClick={() => handleOpenSummary(s)}
                >
                  <span className={`${SUMMARY_CHIP_PERIOD_BASE} ${s.isGameSummary ? SUMMARY_CHIP_PERIOD_GAME : ''}`}>
                    {s.isGameSummary ? 'FINAL' : s.periodShort}
                  </span>
                  <span className={SUMMARY_CHIP_SCORE_CLASSES}>
                    {s.carGoals !== undefined
                      ? `${activeTeamAbbr} ${s.carGoals}–${s.oppGoals}`
                      : t('settings.viewSummary')}
                  </span>
                  <span className={SUMMARY_CHIP_ARROW_CLASSES}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
