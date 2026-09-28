// components/SettingsMenu.jsx -- the ⚙️ Settings button in the top bar and
// the panel it opens (was NotificationBell.jsx; it has been a gear, not a
// bell, for a long time).
//
// Layout (Settings redesign, Option A, 2026-09): one list of sections --
// your team, game summaries, alerts, app, help, account -- with Alerts as
// a screen of its own you drill into. Full-screen on phones, a panel under
// the gear on wider screens. Following several teams and the separate
// notifications bell (Option C) build on this; see the redesign canvas.
//
// Several class names are kept as literal marker strings alongside the
// Tailwind utilities -- notif-bell/notif-popup/notif-close/notif-title/
// notif-change-team-btn/notif-summary-chip and its period/score/game
// variants. Cypress selects on them (auth, theme, topnav-safe-area,
// period-summary, shot-map, goal-replay); they carry no CSS of their own.
import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePushNotifications, loadPrefs, savePrefs, hasSavedPrefs } from '../hooks/usePushNotifications';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import { useAuth } from '../utils/AuthContext';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { AHL_TEAM_CONFIG } from '../utils/ahlApi';
import { ECHL_TEAM_CONFIG } from '../utils/echlApi';
import { getSavedTheme, getTheme, setTheme, clearTheme } from '../utils/themeConfig';
import { getLocale, setLocale } from '../utils/localeConfig';
import { upsertLocale } from '../utils/localeSync';
import { applyTeamTheme, themeTeam } from '../utils/applyTeamTheme';
import TeamLogo from '../components/TeamLogo';
import AccountSection from './AccountSection';
import { OPEN_ABOUT_EVENT } from './AboutPopup';
import { autoFollowSupported, getAutoFollow, setAutoFollow, syncAutoFollow } from '../hooks/useLiveActivity';

// ── Classes ───────────────────────────────────────────────────
const WRAP_CLASSES = 'relative';
const TRIGGER_CLASSES = 'notif-bell bg-transparent border-0 text-[18px] cursor-pointer py-1 px-1.5 rounded-[8px]';
// Rendered into <body> (a portal): inside the top bar it could never sit
// above the bottom nav, whatever its z-index. Phones: the whole screen,
// clear of the notch and home indicator. Wider: a panel under the gear,
// placed from the gear's position (see `anchor`).
const PANEL_CLASSES = 'notif-popup fixed z-[600] bg-[var(--bg1)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] '
  + 'inset-0 pt-[max(12px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] px-4 animate-[sheetIn_0.2s_ease-out] '
  + 'min-[701px]:inset-auto min-[701px]:w-[380px] min-[701px]:max-h-[min(640px,calc(100vh-90px))] min-[701px]:p-4 min-[701px]:rounded-[16px] min-[701px]:border-[0.5px] min-[701px]:border-[var(--border-2)] min-[701px]:shadow-[var(--popup-shadow)] min-[701px]:animate-[popupIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]';
const WIDE_QUERY = '(min-width: 701px)';
const HEADER_ROW_CLASSES = 'flex items-center justify-between min-h-[44px]';
const CLOSE_CLASSES = 'notif-close w-11 h-11 flex items-center justify-center rounded-full border-0 bg-[var(--btn-fill)] text-[15px] text-[color:var(--text-muted)] cursor-pointer hover:bg-[var(--btn-fill-hover)] hover:text-[color:var(--text)]';
const BACK_CLASSES = 'settings-back flex items-center gap-1 min-h-[44px] pr-2 border-0 bg-transparent text-[15px] font-semibold text-[color:var(--team-primary)] cursor-pointer';
const TITLE_CLASSES = 'notif-title m-0 mb-4 font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-none text-[color:var(--text)]';
const SECTIONS_CLASSES = 'flex flex-col gap-5';
const SECTION_LABEL_CLASSES = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] px-1 pb-1.5';
const GROUP_CLASSES = 'bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[14px] overflow-hidden divide-y divide-[var(--border)]';
const ROW_CLASSES = 'flex items-center gap-3 px-3.5 py-2.5 min-h-[52px] w-full text-left';
const ROW_BUTTON_CLASSES = `${ROW_CLASSES} border-0 bg-transparent cursor-pointer text-[color:var(--text)] hover:bg-[var(--btn-fill)]`;
const ROW_TEXT_CLASSES = 'flex flex-col gap-0.5 flex-1 min-w-0';
const ROW_TITLE_CLASSES = 'text-[15px] font-semibold text-[color:var(--text)] leading-tight';
const ROW_SUB_CLASSES = 'text-[12px] text-[color:var(--text-muted)] leading-snug';
const ROW_VALUE_CLASSES = 'text-[14px] text-[color:var(--text-muted)] whitespace-nowrap';
const CHEVRON_CLASSES = 'text-[18px] leading-none text-[color:var(--text-dim)]';
const ICON_CLASSES = 'w-[30px] h-[30px] rounded-[8px] bg-[var(--bg3)] flex items-center justify-center text-[15px] shrink-0';
const FOOT_CLASSES = 'text-[12px] text-[color:var(--text-dim)] leading-snug px-1 pt-1.5';
const CHANGE_TEAM_BTN_CLASSES = 'notif-change-team-btn min-h-[36px] py-1 px-3 text-[13px] rounded-[18px] border-0 text-[color:var(--team-primary)] bg-[color-mix(in_srgb,var(--team-primary)_12%,transparent)] cursor-pointer font-semibold hover:bg-[color-mix(in_srgb,var(--team-primary)_20%,transparent)]';
const SEGMENTS_CLASSES = 'flex gap-0.5 p-[3px] rounded-[11px] bg-[var(--bg3)] w-full';
const SEGMENT_BASE = 'flex-1 min-h-[36px] rounded-[8px] border-0 text-[13px] font-semibold cursor-pointer';
const SEGMENT_ON = 'bg-[var(--bg1)] text-[color:var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.25)]';
const SEGMENT_OFF = 'bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]';
const SWITCH_BASE = 'relative w-[50px] h-[30px] shrink-0 rounded-full border-0 p-0 cursor-pointer [transition:background_0.15s] disabled:opacity-50 disabled:cursor-wait';
const SWITCH_KNOB_BASE = 'absolute top-[3px] w-6 h-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] [transition:left_0.15s]';
const DESC_CLASSES = 'text-[13px] text-[color:var(--text-muted)] leading-[1.5] m-0';
const BLOCKED_CLASSES = 'text-[12px] text-[color:var(--amber)] bg-[rgba(240,160,48,0.1)] rounded-[10px] py-2 px-3 leading-[1.5] m-0';
const ERROR_CLASSES = 'text-[12px] text-[color:var(--red-bright)] m-0';
const TOGGLE_BTN_BASE = 'w-full min-h-[44px] rounded-[12px] border-0 text-[14px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-wait enabled:hover:opacity-90';
const TOGGLE_BTN_ON = 'bg-[var(--red-bright)] text-white';
const TOGGLE_BTN_OFF = 'bg-[var(--bg3)] text-[color:var(--text-muted)]';

const SUMMARY_CHIP_BASE = `notif-summary-chip ${ROW_BUTTON_CLASSES}`;
const SUMMARY_CHIP_GAME = 'notif-summary-chip-game bg-[rgba(var(--team-primary-rgb),0.06)]';
const SUMMARY_CHIP_PERIOD_BASE = 'notif-summary-chip-period min-w-[44px] h-[30px] rounded-[8px] flex items-center justify-center font-[family-name:var(--font-display)] text-[14px] font-extrabold text-white bg-[var(--red)] shrink-0';
const SUMMARY_CHIP_PERIOD_GAME = 'text-[12px] tracking-[0.06em]';
const SUMMARY_CHIP_SCORE_CLASSES = `notif-summary-chip-score ${ROW_TITLE_CLASSES} flex-1`;

// ── Alert types ───────────────────────────────────────────────

// labelKey/itemLabelKey look up settings.prefGroup.*/settings.prefItem.*.
// `nhlOnly`: only the NHL poller sends it (eyewall-poller's pwhl.js and
// hockeytech.js have no end-of-period alert), so other leagues' lists
// leave it out rather than offer a switch that does nothing.
const PREF_GROUPS = [
  {
    labelKey: 'settings.prefGroup.gameFlow',
    items: [
      { key: 'gameStart',   labelKey: 'settings.prefItem.gameStart' },
      { key: 'periodStart', labelKey: 'settings.prefItem.periodStart' },
      { key: 'periodEnd',   labelKey: 'settings.prefItem.periodEnd', subKey: 'settings.prefItem.periodEndSub', nhlOnly: true },
    ],
  },
  {
    labelKey: 'settings.prefGroup.goals',
    items: [
      { key: 'goal',     labelKey: 'settings.prefItem.goal' },
      { key: 'oppGoal',  labelKey: 'settings.prefItem.oppGoal' },
      { key: 'hatTrick', labelKey: 'settings.prefItem.hatTrick' },
    ],
  },
  {
    labelKey: 'settings.prefGroup.specialTeams',
    items: [
      { key: 'penalty',      labelKey: 'settings.prefItem.penalty' },
      { key: 'goaliePulled', labelKey: 'settings.prefItem.goaliePulled' },
    ],
  },
  {
    labelKey: 'settings.prefGroup.result',
    items: [
      { key: 'win',  labelKey: 'settings.prefItem.win' },
      { key: 'loss', labelKey: 'settings.prefItem.loss' },
    ],
  },
];

// iOS Safari (and every iOS browser, since Apple mandates WebKit under
// the hood) only exposes the Web Push API to a PWA actually installed via
// "Add to Home Screen" — a regular browser tab never gets PushManager,
// even on iOS 16.4+. usePushNotifications()'s `supported` flag correctly
// comes back false there; this tells that specific, fixable case (show
// install instructions) apart from a genuinely unsupported browser.
function isIOSBrowserTab() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
}

// ── Building blocks ───────────────────────────────────────────

function Section({ label, footer, children }) {
  return (
    <section>
      {label && <h2 className={SECTION_LABEL_CLASSES}>{label}</h2>}
      <div className={GROUP_CLASSES}>{children}</div>
      {footer && <p className={FOOT_CLASSES}>{footer}</p>}
    </section>
  );
}

function Switch({ on, onToggle, label, disabled, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`${SWITCH_BASE} ${on ? 'bg-[var(--green)]' : 'bg-[var(--btn-fill-hover)]'} ${className}`}
    >
      <span className={`${SWITCH_KNOB_BASE} ${on ? 'left-[23px]' : 'left-[3px]'}`} />
    </button>
  );
}

function Segments({ options, value, onChange, label }) {
  return (
    <div className={SEGMENTS_CLASSES} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${o.className || ''} ${SEGMENT_BASE} ${value === o.value ? SEGMENT_ON : SEGMENT_OFF}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function SettingsMenu() {
  const { t }                   = useTranslation();
  const [open, setOpen]         = useState(false);
  const [screen, setScreen]     = useState('main'); // 'main' | 'alerts'
  const triggerRef              = useRef(null);
  // Wide screens: where the panel hangs, from the gear's position at open.
  const [anchor, setAnchor]     = useState(null);
  const { isPWHL, isAHL, isECHL } = useSport();
  const { user }                 = useAuth();
  const activeTeam              = isPWHL ? PWHL_TEAM_CONFIG : isAHL ? AHL_TEAM_CONFIG : isECHL ? ECHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr          = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const activeTeamName          = activeTeam?.displayName || TEAM_CONFIG.displayName;
  const league                  = isPWHL ? 'PWHL' : isAHL ? 'AHL' : isECHL ? 'ECHL' : 'NHL';
  // 'dark' | 'light' | 'system' -- system: nothing saved, following the device.
  const [themeChoice, setThemeChoice] = useState(() => getSavedTheme() ?? 'system');
  const [locale, setLocaleState] = useState(getLocale);
  const [prefs, setPrefsState]  = useState(() => loadPrefs());
  // "Follow my team's games" on the Lock Screen: null until the native
  // side answers, and the row only exists where it can work (iOS 17.2+
  // app, Live Activities allowed, NHL favorite -- see useLiveActivity.js).
  const [autoFollow, setAutoFollowState] = useState(null);
  const [autoFollowBusy, setAutoFollowBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await autoFollowSupported())) return;
      const enabled = await getAutoFollow();
      if (!cancelled) setAutoFollowState(enabled);
    })();
    return () => { cancelled = true; };
  }, []);
  const handleAutoFollowToggle = async () => {
    const next = !autoFollow;
    setAutoFollowBusy(true);
    try {
      await setAutoFollow(next);
      setAutoFollowState(next);
    } catch {
      // Left as it was; the native side refused.
    } finally {
      setAutoFollowBusy(false);
    }
  };

  const { supported, permission, subscribed, subscribe, unsubscribe, updatePrefs, loading, error } =
    usePushNotifications();
  const { summaries, openSummary } = usePeriodSummaryContext();

  // Closing always lands back on the main screen next time.
  const closePanel = () => {
    setOpen(false);
    setScreen('main');
  };

  // Escape closes, as a full-screen panel on a keyboard should.
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const openPanel = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    setAnchor(r && window.matchMedia(WIDE_QUERY).matches
      ? { top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) }
      : null);
    setOpen(true);
  };

  const handleChangeTeam = () => {
    closePanel();
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

  const handleThemeChange = choice => {
    if (choice === 'system') clearTheme();
    else setTheme(choice);
    applyTeamTheme(themeTeam(TEAM_CONFIG), getTheme());
    setThemeChoice(choice);
  };

  const handleLocaleChange = next => {
    if (next === locale) return;
    setLocale(next);
    setLocaleState(next);
    if (user?.id) upsertLocale(user.id, next);
    // The Lock Screen's "puck drop" alert is sent in this language.
    syncAutoFollow().catch(() => {});
  };

  const leagueTeamKey = `${league}:${activeTeamAbbr}`;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe(leagueTeamKey, prefs);
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
  }, [prefs, subscribed, leagueTeamKey, updatePrefs]);

  // End-of-period alerts became on by default (2026-09). A subscriber who
  // never changed their alert choices is on the defaults, so their
  // subscription gets the new ones once; saved only when the server took
  // them, so a failed try runs again next launch.
  useEffect(() => {
    if (!subscribed || hasSavedPrefs()) return;
    let cancelled = false;
    (async () => {
      const current = loadPrefs();
      if (await updatePrefs(leagueTeamKey, current) && !cancelled) savePrefs(current);
    })();
    return () => { cancelled = true; };
  }, [subscribed, updatePrefs, leagueTeamKey]);

  const handleOpenSummary = (summary) => {
    closePanel();
    openSummary(summary);
  };

  const handleOpenAbout = () => {
    closePanel();
    window.dispatchEvent(new window.Event(OPEN_ABOUT_EVENT));
  };

  const alertsValue = !supported ? t('settings.notifUnavailable')
    : permission === 'denied' ? t('settings.notifBlocked')
      : subscribed ? t('settings.notifOn') : t('settings.notifOff');

  const prefGroups = PREF_GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => league === 'NHL' || !item.nhlOnly) }))
    .filter(g => g.items.length);

  const mainScreen = (
    <>
      <div className={HEADER_ROW_CLASSES}>
        <span />
        <button className={CLOSE_CLASSES} onClick={closePanel} aria-label={t('common.close')}>✕</button>
      </div>
      <h1 className={TITLE_CLASSES}>{t('settings.title')}</h1>

      <div className={SECTIONS_CLASSES}>
        <Section label={t('settings.yourTeam')}>
          <div className={ROW_CLASSES}>
            <TeamLogo abbr={activeTeamAbbr} size={32} sport={league.toLowerCase()} />
            <span className={ROW_TEXT_CLASSES}>
              <span className={ROW_TITLE_CLASSES}>{activeTeamName}</span>
              <span className={ROW_SUB_CLASSES}>{league}</span>
            </span>
            <button className={CHANGE_TEAM_BTN_CLASSES} onClick={handleChangeTeam}>{t('settings.change')}</button>
          </div>
        </Section>

        {/* Until the notifications bell takes them (redesign Option C). */}
        {summaries.length > 0 && (
          <Section label={t('settings.gameSummaries')}>
            {summaries.map(s => (
              <button
                key={s.isGameSummary ? 'game' : s.period}
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
                <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
              </button>
            ))}
          </Section>
        )}

        <Section label={t('settings.alerts')}>
          <button className={`settings-alerts-row ${ROW_BUTTON_CLASSES}`} onClick={() => setScreen('alerts')}>
            <span className={ICON_CLASSES} aria-hidden="true">🔔</span>
            <span className={ROW_TEXT_CLASSES}>
              <span className={ROW_TITLE_CLASSES}>{t('settings.notifications')}</span>
              <span className={ROW_SUB_CLASSES}>{t('settings.notificationsSub', { team: activeTeamAbbr })}</span>
            </span>
            <span className={ROW_VALUE_CLASSES}>{alertsValue}</span>
            <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
          </button>
          {autoFollow !== null && (
            <div className={ROW_CLASSES}>
              <span className={ICON_CLASSES} aria-hidden="true">🔒</span>
              <span className={ROW_TEXT_CLASSES}>
                <span className={ROW_TITLE_CLASSES}>{t('settings.followTeamGames', { team: TEAM_CONFIG.abbr })}</span>
                <span className={ROW_SUB_CLASSES}>{t('settings.followTeamGamesDesc')}</span>
              </span>
              <Switch
                className="lock-screen-auto-follow"
                on={autoFollow}
                onToggle={handleAutoFollowToggle}
                disabled={autoFollowBusy}
                label={t('settings.followTeamGames', { team: TEAM_CONFIG.abbr })}
              />
            </div>
          )}
        </Section>

        <Section label={t('settings.app')}>
          <div className={`${ROW_CLASSES} flex-col items-stretch gap-2`}>
            <span className={ROW_TITLE_CLASSES}>{t('settings.appearance')}</span>
            <Segments
              label={t('settings.appearance')}
              value={themeChoice}
              onChange={handleThemeChange}
              options={[
                { value: 'dark', label: t('settings.themeDark'), className: 'settings-theme-dark' },
                { value: 'light', label: t('settings.themeLight'), className: 'settings-theme-light' },
                { value: 'system', label: t('settings.themeSystem'), className: 'settings-theme-system' },
              ]}
            />
          </div>
          <div className={`${ROW_CLASSES} flex-col items-stretch gap-2`}>
            <span className={ROW_TITLE_CLASSES}>{t('settings.language')}</span>
            <Segments
              label={t('settings.language')}
              value={locale}
              onChange={handleLocaleChange}
              options={[{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }]}
            />
          </div>
        </Section>

        <Section label={t('settings.help')}>
          <button className={`settings-about-row ${ROW_BUTTON_CLASSES}`} onClick={handleOpenAbout}>
            <span className={ICON_CLASSES} aria-hidden="true">ℹ️</span>
            <span className={ROW_TEXT_CLASSES}>
              <span className={ROW_TITLE_CLASSES}>{t('settings.about')}</span>
            </span>
            <span className={ROW_VALUE_CLASSES}>{__APP_VERSION__}</span>
            <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
          </button>
        </Section>

        <section>
          <h2 className={SECTION_LABEL_CLASSES}>{t('settings.account')}</h2>
          <AccountSection />
        </section>
      </div>
    </>
  );

  const alertsScreen = (
    <>
      <div className={HEADER_ROW_CLASSES}>
        <button className={BACK_CLASSES} onClick={() => setScreen('main')}>
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>{t('settings.title')}
        </button>
        <button className={CLOSE_CLASSES} onClick={closePanel} aria-label={t('common.close')}>✕</button>
      </div>
      <h1 className={TITLE_CLASSES}>{t('settings.alerts')}</h1>

      <div className={SECTIONS_CLASSES}>
        <div className="flex flex-col gap-3">
          {!supported && (
            <p className={DESC_CLASSES}>
              {isIOSBrowserTab() ? t('settings.iosInstructions') : t('settings.unsupported')}
            </p>
          )}
          {supported && (
            <>
              <p className={DESC_CLASSES}>
                {subscribed
                  ? t('settings.subscribedText', { team: activeTeamName })
                  : t('settings.getAlertsText', { team: activeTeamName })}
              </p>
              {permission === 'denied' && <p className={BLOCKED_CLASSES}>{t('settings.blockedText')}</p>}
              {error && <p className={ERROR_CLASSES}>{error}</p>}
              {permission !== 'denied' && (
                <button
                  className={`settings-push-toggle ${TOGGLE_BTN_BASE} ${subscribed ? TOGGLE_BTN_OFF : TOGGLE_BTN_ON}`}
                  onClick={handleToggle}
                  disabled={loading}
                >
                  {loading ? t('settings.working') : subscribed ? t('settings.turnOff') : t('settings.turnOn')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Choices apply as soon as alerts are on; before that they're what
            turning them on will ask for. Only this league's alert types. */}
        {supported && prefGroups.map((group, i) => (
          <Section
            key={group.labelKey}
            label={t(group.labelKey)}
            footer={i === prefGroups.length - 1 ? t('settings.alertsFooter', { league }) : null}
          >
            {group.items.map(item => (
              <div key={item.key} className={`settings-pref-${item.key} ${ROW_CLASSES}`}>
                <span className={ROW_TEXT_CLASSES}>
                  <span className={ROW_TITLE_CLASSES}>{t(item.labelKey)}</span>
                  {item.subKey && <span className={ROW_SUB_CLASSES}>{t(item.subKey)}</span>}
                </span>
                <Switch on={!!prefs[item.key]} onToggle={() => handlePrefToggle(item.key)} label={t(item.labelKey)} />
              </div>
            ))}
          </Section>
        ))}
      </div>
    </>
  );

  return (
    <div className={WRAP_CLASSES}>
      <button
        ref={triggerRef}
        className={TRIGGER_CLASSES}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={t('settings.title')}
        aria-expanded={open}
        title={t('settings.title')}
      >
        ⚙️
      </button>

      {open && createPortal(
        <div className={PANEL_CLASSES} style={anchor || undefined} role="dialog" aria-modal="true" aria-label={t('settings.title')}>
          {screen === 'alerts' ? alertsScreen : mainScreen}
        </div>,
        document.body
      )}
    </div>
  );
}
