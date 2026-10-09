// components/SettingsMenu.jsx -- the ⚙️ Settings button in the top bar and
// the panel it opens (was NotificationBell.jsx; it has been a gear, not a
// bell, for a long time).
//
// Layout (Settings redesign, Option A, 2026-09): one list of sections --
// your team, alerts, app, help, account -- with Alerts as a screen of its
// own you drill into. Full-screen on phones, a panel under the gear on
// wider screens (SheetParts.jsx). Game summaries live under the
// notifications bell (NotificationsBell.jsx, Option C).
//
// Several class names are kept as literal marker strings alongside the
// Tailwind utilities -- notif-bell/notif-popup/notif-close/notif-title/
// notif-change-team-btn. Cypress selects on them (auth, theme,
// topnav-safe-area, period-summary); they carry no CSS of their own.
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePushNotifications, savePrefs } from '../hooks/usePushNotifications';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import { useAuth } from '../utils/AuthContext';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { AHL_TEAM_CONFIG } from '../utils/ahlApi';
import { ECHL_TEAM_CONFIG } from '../utils/echlApi';
import { getSavedTheme, getTheme, setTheme, clearTheme } from '../utils/themeConfig';
import { getLocale, setLocale } from '../utils/localeConfig';
import { setUnits } from '../utils/unitsConfig';
import { useUnits } from '../hooks/useUnits';
import { upsertLocale } from '../utils/localeSync';
import { applyTeamTheme, themeTeam } from '../utils/applyTeamTheme';
import AccountSection from './AccountSection';
import { OPEN_ABOUT_EVENT } from './AboutPopup';
import { START_TOUR_EVENT } from '../utils/tour';
import {
  BACK_CLASSES, CHEVRON_CLASSES, CLOSE_CLASSES, HEADER_ROW_CLASSES, ICON_CLASSES, ROW_BUTTON_CLASSES, ROW_CLASSES,
  ROW_SUB_CLASSES, ROW_TEXT_CLASSES, ROW_TITLE_CLASSES, ROW_VALUE_CLASSES, SECTIONS_CLASSES, SECTION_LABEL_CLASSES,
  Section, Segments, Sheet, Switch, TITLE_CLASSES, useSheet,
} from './SheetParts';
import { AddTeamScreen, LeagueTeamLogo, TeamsScreen, TeamsSection } from './SettingsTeams';
import { alertSettingsFor, lastSynced, loadAlertTeams, saveAlertSettings, setLastSynced, subscriptionTeams } from '../utils/alertTeams';
import { FOLLOWED_CHANGED_EVENT, getFollowedTeams, sameTeam, teamFor } from '../utils/followedTeams';
import { getLocalSelection } from '../utils/favoriteTeamSync';
import { autoFollowSupported, getAutoFollow, setAutoFollow, syncAutoFollow } from '../hooks/useLiveActivity';

// ── Classes ───────────────────────────────────────────────────
const WRAP_CLASSES = 'relative';
const TRIGGER_CLASSES = 'notif-bell bg-transparent border-0 text-[18px] cursor-pointer py-1 px-1.5 rounded-[8px]';
const DESC_CLASSES = 'text-[13px] text-[color:var(--text-muted)] leading-[1.5] m-0';
const BLOCKED_CLASSES = 'text-[12px] text-[color:var(--amber)] bg-[rgba(240,160,48,0.1)] rounded-[10px] py-2 px-3 leading-[1.5] m-0';
const ERROR_CLASSES = 'text-[12px] text-[color:var(--red-bright)] m-0';
const TOGGLE_BTN_BASE = 'w-full min-h-[44px] rounded-[12px] border-0 text-[14px] font-bold cursor-pointer disabled:opacity-50 disabled:cursor-wait enabled:hover:opacity-90';
const TOGGLE_BTN_ON = 'bg-[var(--red-bright)] text-white';
const TOGGLE_BTN_OFF = 'bg-[var(--bg3)] text-[color:var(--text-muted)]';

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

// ── Component ─────────────────────────────────────────────────

// Dispatched on window to open Settings from elsewhere; `detail.screen`
// 'alerts' or 'teams' opens that screen.
export const OPEN_SETTINGS_EVENT = 'eyewall:open-settings';

export default function SettingsMenu() {
  const { t }                   = useTranslation();
  const [screen, setScreen]     = useState('main'); // 'main' | 'alerts' | 'teams' | 'addTeam'
  const triggerRef              = useRef(null);
  // Closing always lands back on the main screen next time.
  const { open, anchor, openSheet, closeSheet: closePanel } = useSheet('settings', triggerRef, () => setScreen('main'));
  const { isPWHL, isAHL, isECHL } = useSport();
  const { user }                 = useAuth();
  const userId                  = user?.id;
  // Followed teams (utils/followedTeams.js), kept current as they change.
  const [followed, setFollowed] = useState(getFollowedTeams);
  const primary                 = getLocalSelection();
  useEffect(() => {
    const onChange = e => setFollowed(e.detail || getFollowedTeams());
    window.addEventListener(FOLLOWED_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, onChange);
  }, []);
  const activeTeam              = isPWHL ? PWHL_TEAM_CONFIG : isAHL ? AHL_TEAM_CONFIG : isECHL ? ECHL_TEAM_CONFIG : TEAM_CONFIG;
  const activeTeamAbbr          = activeTeam?.abbr || TEAM_CONFIG.abbr;
  const activeTeamName          = activeTeam?.displayName || TEAM_CONFIG.displayName;
  // 'dark' | 'light' | 'system' -- system: nothing saved, following the device.
  const [themeChoice, setThemeChoice] = useState(() => getSavedTheme() ?? 'system');
  const [locale, setLocaleState] = useState(getLocale);
  const units = useUnits();
  // Each followed team's alert choices on this device (utils/alertTeams.js),
  // and the team the Alerts screen is showing.
  const [alertTeams, setAlertTeams] = useState(loadAlertTeams);
  const [alertTeamPick, setAlertTeamPick] = useState(null);
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

  // The bell's "Alert settings" (NotificationsBell.jsx) and the team
  // switcher's "Manage teams" (TeamSwitcher.jsx) open Settings straight on
  // those screens.
  useEffect(() => {
    const onOpen = e => { setScreen(['alerts', 'teams'].includes(e.detail?.screen) ? e.detail.screen : 'main'); openSheet(); };
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
  }, [openSheet]);

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

  // The Alerts screen's team: the one picked, else the primary.
  const alertTeam = (alertTeamPick && followed.find(f => sameTeam(f, alertTeamPick))) || primary || followed[0];
  const alertTeamIsPrimary = sameTeam(alertTeam, primary);
  const alertSettings = alertTeam ? alertSettingsFor(alertTeam, alertTeams) : { on: true, prefs: {} };
  const alertLeague = (alertTeam?.sport || 'nhl').toUpperCase();
  const alertTeamName = (alertTeam && teamFor(alertTeam)?.displayName) || activeTeamName;
  const manyTeams = followed.length > 1;
  // Every followed team's games start one (useLiveActivity.js), any league.
  const followGamesLabel = manyTeams ? t('settings.followTeamsGames') : t('settings.followTeamGames', { team: activeTeamAbbr });

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      setLastSynced(null);
    } else {
      const teams = subscriptionTeams(followed, primary, alertTeams);
      if (teams.length && await subscribe(teams[0].key, teams[0].prefs, teams)) setLastSynced(JSON.stringify(teams));
    }
  };

  const saveAlertTeam = next => {
    setAlertTeams(saveAlertSettings(alertTeam, next, alertTeams));
    // The primary's choices double as the template a newly followed
    // team starts from.
    if (alertTeamIsPrimary) savePrefs(next.prefs);
  };
  const handlePrefToggle = key =>
    saveAlertTeam({ ...alertSettings, prefs: { ...alertSettings.prefs, [key]: !alertSettings.prefs[key] } });
  const handleTeamAlertsToggle = () => saveAlertTeam({ ...alertSettings, on: !alertSettings.on });

  // Keeps the poller's copy of this device's teams and choices current:
  // after any change here, a team followed or dropped, or an update to
  // the app (the first launch with this sends every followed team, and
  // the end-of-period default from 2026-09). Sent only when different
  // from what was last stored there.
  useEffect(() => {
    if (!subscribed) return;
    const teams = subscriptionTeams(followed, primary, alertTeams);
    const sig = JSON.stringify(teams);
    if (!teams.length || lastSynced() === sig) return;
    let cancelled = false;
    (async () => {
      if (await updatePrefs(teams[0].key, teams[0].prefs, teams) && !cancelled) setLastSynced(sig);
    })();
    return () => { cancelled = true; };
  }, [subscribed, followed, primary?.sport, primary?.abbr, alertTeams, updatePrefs]);

  const handleTakeTour = () => {
    closePanel();
    window.dispatchEvent(new window.Event(START_TOUR_EVENT));
  };

  const handleOpenAbout = () => {
    closePanel();
    window.dispatchEvent(new window.Event(OPEN_ABOUT_EVENT));
  };

  const alertsValue = !supported ? t('settings.notifUnavailable')
    : permission === 'denied' ? t('settings.notifBlocked')
      : subscribed ? t('settings.notifOn') : t('settings.notifOff');

  const prefGroups = PREF_GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => alertLeague === 'NHL' || !item.nhlOnly) }))
    .filter(g => g.items.length);

  const mainScreen = (
    <>
      <div className={HEADER_ROW_CLASSES}>
        <span />
        <button className={`notif-close ${CLOSE_CLASSES}`} onClick={closePanel} aria-label={t('common.close')}>✕</button>
      </div>
      <h1 className={`notif-title ${TITLE_CLASSES}`}>{t('settings.title')}</h1>

      <div className={SECTIONS_CLASSES}>
        <TeamsSection followed={followed} primary={primary} userId={userId} onManage={() => setScreen('teams')} />

        <Section label={t('settings.alerts')}>
          <button className={`settings-alerts-row ${ROW_BUTTON_CLASSES}`} onClick={() => setScreen('alerts')}>
            <span className={ICON_CLASSES} aria-hidden="true">🔔</span>
            <span className={ROW_TEXT_CLASSES}>
              <span className={ROW_TITLE_CLASSES}>{t('settings.notifications')}</span>
              <span className={ROW_SUB_CLASSES}>{manyTeams ? t('settings.notificationsSubTeams', { count: followed.length }) : t('settings.notificationsSub', { team: activeTeamAbbr })}</span>
            </span>
            <span className={ROW_VALUE_CLASSES}>{alertsValue}</span>
            <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
          </button>
          {autoFollow !== null && (
            <div className={ROW_CLASSES}>
              <span className={ICON_CLASSES} aria-hidden="true">🔒</span>
              <span className={ROW_TEXT_CLASSES}>
                <span className={ROW_TITLE_CLASSES}>{followGamesLabel}</span>
                <span className={ROW_SUB_CLASSES}>{t('settings.followTeamGamesDesc')}</span>
              </span>
              <Switch
                className="lock-screen-auto-follow"
                on={autoFollow}
                onToggle={handleAutoFollowToggle}
                disabled={autoFollowBusy}
                label={followGamesLabel}
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
          <div className={`${ROW_CLASSES} flex-col items-stretch gap-2`}>
            <span className={ROW_TITLE_CLASSES}>{t('settings.units')}</span>
            <Segments
              label={t('settings.units')}
              value={units}
              onChange={setUnits}
              options={[
                { value: 'imperial', label: t('settings.unitsImperial'), className: 'settings-units-imperial' },
                { value: 'metric', label: t('settings.unitsMetric'), className: 'settings-units-metric' },
              ]}
            />
          </div>
        </Section>

        <Section label={t('settings.help')}>
          <button className={`settings-tour-row ${ROW_BUTTON_CLASSES}`} onClick={handleTakeTour}>
            <span className={ICON_CLASSES} aria-hidden="true">🧭</span>
            <span className={ROW_TEXT_CLASSES}>
              <span className={ROW_TITLE_CLASSES}>{t('settings.takeTour')}</span>
              <span className={ROW_SUB_CLASSES}>{t('settings.takeTourSub')}</span>
            </span>
            <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
          </button>
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
          <AccountSection onClose={closePanel} />
        </section>
      </div>
    </>
  );

  // A drill-in screen's back button, close and title.
  const subHeader = (title, back, backLabel) => (
    <>
      <div className={HEADER_ROW_CLASSES}>
        <button className={`settings-back ${BACK_CLASSES}`} onClick={() => setScreen(back)}>
          <span aria-hidden="true" className="text-[22px] leading-none">‹</span>{backLabel}
        </button>
        <button className={`notif-close ${CLOSE_CLASSES}`} onClick={closePanel} aria-label={t('common.close')}>✕</button>
      </div>
      <h1 className={`notif-title ${TITLE_CLASSES}`}>{title}</h1>
    </>
  );

  const teamsScreen = (
    <>
      {subHeader(t('settings.yourTeams'), 'main', t('settings.title'))}
      <div className={SECTIONS_CLASSES}>
        <TeamsScreen followed={followed} primary={primary} userId={userId} onAdd={() => setScreen('addTeam')} />
      </div>
    </>
  );

  const addTeamScreen = (
    <>
      {subHeader(t('settings.addTeam'), 'teams', t('settings.yourTeams'))}
      <div className={`${SECTIONS_CLASSES} gap-4`}>
        <AddTeamScreen followed={followed} primary={primary} userId={userId} />
      </div>
    </>
  );

  const alertsScreen = (
    <>
      {subHeader(t('settings.alerts'), 'main', t('settings.title'))}

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
                {manyTeams
                  ? (subscribed ? t('settings.subscribedTextTeams') : t('settings.getAlertsTextTeams'))
                  : subscribed
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

        {/* Following several: one team's choices at a time. */}
        {supported && manyTeams && (
          <div className="settings-alert-teams flex gap-2 overflow-x-auto -mx-1 px-1 pb-1" role="radiogroup" aria-label={t('settings.alertsForTeam')}>
            {followed.map(team => {
              const picked = sameTeam(team, alertTeam);
              return (
                <button
                  key={`${team.sport}:${team.abbr}`}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  aria-label={teamFor(team)?.displayName || team.abbr}
                  onClick={() => setAlertTeamPick(team)}
                  className={`settings-alert-team-${team.sport}-${team.abbr} flex items-center gap-1.5 shrink-0 min-h-[40px] pl-1 pr-3 rounded-[20px] border text-[13px] font-semibold cursor-pointer ${picked ? 'border-[color:var(--text)] bg-[var(--btn-fill-hover)] text-[color:var(--text)]' : 'border-[var(--border-2)] bg-transparent text-[color:var(--text-muted)]'}`}
                >
                  <LeagueTeamLogo team={team} size={28} />{team.abbr}
                </button>
              );
            })}
          </div>
        )}

        {/* The primary's alerts are push's own on/off above; each other
            team has its own. */}
        {supported && manyTeams && !alertTeamIsPrimary && (
          <Section footer={t('settings.teamAlertsNote')}>
            <div className={`settings-team-alerts ${ROW_CLASSES}`}>
              <span className={ROW_TEXT_CLASSES}>
                <span className={ROW_TITLE_CLASSES}>{t('settings.alertsForTeamNamed', { team: alertTeamName })}</span>
              </span>
              <Switch on={alertSettings.on} onToggle={handleTeamAlertsToggle} label={t('settings.alertsForTeamNamed', { team: alertTeamName })} />
            </div>
          </Section>
        )}

        {/* Choices apply as soon as alerts are on; before that they're what
            turning them on will ask for. Only this team's league's types. */}
        {supported && alertSettings.on && prefGroups.map((group, i) => (
          <Section
            key={group.labelKey}
            label={t(group.labelKey)}
            footer={i === prefGroups.length - 1 ? t('settings.alertsFooter', { league: alertLeague }) : null}
          >
            {group.items.map(item => (
              <div key={item.key} className={`settings-pref-${item.key} ${ROW_CLASSES}`}>
                <span className={ROW_TEXT_CLASSES}>
                  <span className={ROW_TITLE_CLASSES}>{t(item.labelKey)}</span>
                  {item.subKey && <span className={ROW_SUB_CLASSES}>{t(item.subKey)}</span>}
                </span>
                <Switch on={!!alertSettings.prefs[item.key]} onToggle={() => handlePrefToggle(item.key)} label={t(item.labelKey)} />
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
        onClick={() => (open ? closePanel() : openSheet())}
        aria-label={t('settings.title')}
        aria-expanded={open}
        title={t('settings.title')}
      >
        ⚙️
      </button>

      {open && (
        <Sheet className="notif-popup" anchor={anchor} label={t('settings.title')}>
          {screen === 'alerts' ? alertsScreen
            : screen === 'teams' ? teamsScreen
              : screen === 'addTeam' ? addTeamScreen
                : mainScreen}
        </Sheet>
      )}
    </div>
  );
}
