// components/NotificationsBell.jsx -- the 🔔 next to the ⚙️ in the top bar
// (Settings redesign, Option C, 2026-09). Holds the latest game's period
// and final summaries, newest first, and the recent alerts for every team
// you follow (step 7: GET /alerts/recent, the last 3 days, whether or not
// push is on), with a dot on the bell while something's new since you
// last looked. Settings keeps only settings.
//
// Summaries come from the game view (PeriodSummaryContext: NHL and PWHL);
// recent alerts from eyewall-poller, every league.
//
// Marker classes for Cypress: summary-bell (the button), summary-bell-dot,
// summary-bell-panel, and the notif-summary-chip* ones on each summary row
// (period-summary, shot-map, goal-replay select on those).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getRecentAlerts } from '../utils/nhlApi';
import { FOLLOWED_CHANGED_EVENT, getFollowedTeams, sameTeam } from '../utils/followedTeams';
import { getLocalSelection } from '../utils/favoriteTeamSync';
import { alertKey } from '../utils/alertTeams';
import {
  ALERT_ICONS, alertAge, alertId, alertLink, clearAllAlerts, dedupeAlerts, dismissAlert, hasNewAlerts,
  loadAlertsSeenAt, loadCleared, saveAlertsSeenAt, visibleAlerts,
} from '../utils/recentAlerts';
import SwipeToDelete from './SwipeToDelete';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { useSport } from '../utils/SportContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { hasUnseen, loadSeen, markSeen, newestFirst, summaryKey } from '../utils/summarySeen';
import { OPEN_SETTINGS_EVENT } from './SettingsMenu';
import {
  CHEVRON_CLASSES, CLOSE_CLASSES, HEADER_ROW_CLASSES, ICON_CLASSES, ROW_BUTTON_CLASSES, ROW_CLASSES, ROW_SUB_CLASSES,
  ROW_TEXT_CLASSES, ROW_TITLE_CLASSES, SECTION_ACTION_CLASSES, SECTIONS_CLASSES, Section, Sheet, TITLE_CLASSES, useSheet,
} from './SheetParts';

const WRAP_CLASSES = 'relative';
const TRIGGER_CLASSES = 'summary-bell relative bg-transparent border-0 text-[18px] cursor-pointer py-1 px-1.5 rounded-[8px]';
const DOT_CLASSES = 'summary-bell-dot absolute top-0.5 right-0.5 w-[9px] h-[9px] rounded-full bg-[var(--red-bright)] border-2 border-[var(--bg0)]';
const NEW_DOT_CLASSES = 'w-2 h-2 rounded-full bg-[var(--red-bright)] shrink-0';
const CHIP_CLASSES = `notif-summary-chip ${ROW_BUTTON_CLASSES}`;
const CHIP_GAME_CLASSES = 'notif-summary-chip-game bg-[rgba(var(--team-primary-rgb),0.06)]';
const CHIP_PERIOD_CLASSES = 'notif-summary-chip-period min-w-[44px] h-[30px] rounded-[8px] flex items-center justify-center font-[family-name:var(--font-display)] text-[14px] font-extrabold text-white bg-[var(--red)] shrink-0';
const CHIP_PERIOD_GAME_CLASSES = 'text-[12px] tracking-[0.06em]';
const CHIP_SCORE_CLASSES = `notif-summary-chip-score ${ROW_TITLE_CLASSES}`;
const AGE_CLASSES = 'text-[12px] text-[color:var(--text-dim)] whitespace-nowrap self-start pt-0.5';
// The age and › make way for the row's hover × (SwipeToDelete).
const UNDER_X_CLASSES = '[@media(hover:hover)]:group-hover:invisible group-has-[.swipe-row-x:focus-visible]:invisible';
const ALERTS_REFRESH_MS = 2 * 60 * 1000;
const EMPTY_CLASSES = 'summary-bell-empty text-[14px] text-[color:var(--text-muted)] leading-[1.5] m-0 px-1';

export default function NotificationsBell() {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { isPWHL } = useSport();
  const { summaries, openSummary } = usePeriodSummaryContext();
  const triggerRef = useRef(null);
  const [seen, setSeen] = useState(loadSeen);
  // What was new when the bell was opened, so those rows keep their dot
  // while it's open even though opening marks them seen.
  const [newAtOpen, setNewAtOpen] = useState(() => new Set());
  const { open, anchor, openSheet, closeSheet } = useSheet('bell', triggerRef);

  const teamAbbr = isPWHL ? PWHL_TEAM_CONFIG?.abbr : TEAM_CONFIG.abbr;

  // Recent alerts for the followed teams, primary first (that order also
  // picks the side of a game between two of them -- see dedupeAlerts).
  const [followed, setFollowed] = useState(getFollowedTeams);
  const primary = getLocalSelection();
  const alertOrder = [...followed.filter(t => sameTeam(t, primary)), ...followed.filter(t => !sameTeam(t, primary))].map(alertKey);
  const orderKey = alertOrder.join(',');
  const [alerts, setAlerts] = useState([]);
  // Cleared on this device, one by one or all at once (recentAlerts.js).
  const [cleared, setCleared] = useState(loadCleared);
  const shownAlerts = visibleAlerts(alerts, cleared);
  const [alertsSeenAt, setAlertsSeenAt] = useState(loadAlertsSeenAt);
  const [newAlertsAtOpen, setNewAlertsAtOpen] = useState(0);

  useEffect(() => {
    const onChange = e => setFollowed(e.detail || getFollowedTeams());
    window.addEventListener(FOLLOWED_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, onChange);
  }, []);

  const loadAlerts = useCallback(async () => {
    const order = orderKey ? orderKey.split(',') : [];
    const list = dedupeAlerts(await getRecentAlerts(order), order);
    setAlerts(list);
    // First look on this device: what's already there counts as seen.
    setAlertsSeenAt(prev => {
      if (prev != null) return prev;
      const at = list[0]?.at || Date.now();
      saveAlertsSeenAt(at);
      return at;
    });
  }, [orderKey]);

  // On load, every couple of minutes while the page is showing, and on open.
  useEffect(() => {
    loadAlerts();
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadAlerts(); }, ALERTS_REFRESH_MS);
    return () => clearInterval(id);
  }, [loadAlerts]);

  const unseen = hasUnseen(summaries, seen) || hasNewAlerts(shownAlerts, alertsSeenAt);

  // Anything that arrives while it's open counts as seen too.
  useEffect(() => {
    if (open && hasUnseen(summaries, seen)) setSeen(markSeen(summaries, seen));
  }, [open, summaries, seen]);

  const handleOpen = () => {
    if (open) { closeSheet(); return; }
    setNewAtOpen(new Set(summaries.map(summaryKey).filter(k => !seen.has(k))));
    setSeen(markSeen(summaries, seen));
    setNewAlertsAtOpen(alertsSeenAt ?? Infinity);
    if (alerts[0]) { saveAlertsSeenAt(alerts[0].at); setAlertsSeenAt(alerts[0].at); }
    loadAlerts();
    openSheet();
  };

  const handleOpenAlert = link => {
    closeSheet();
    navigate(link);
  };

  // The game view opens it in place when it's on screen. From any other
  // page these rows used to do nothing (the view that holds the summaries
  // wasn't there to open them), so go to it: NHL by summary link, which
  // also finds the game; PWHL's view opens the held summary as it mounts.
  const handleOpenSummary = s => {
    closeSheet();
    if (openSummary(s)) return;
    navigate(isPWHL ? '/pwhl/shots' : `/?summary=${s.isGameSummary ? 'game' : s.period}&game=${s.gameId}`);
  };

  const handleAlertSettings = () => {
    closeSheet();
    window.dispatchEvent(new window.CustomEvent(OPEN_SETTINGS_EVENT, { detail: { screen: 'alerts' } }));
  };

  const label = unseen ? t('bell.titleNew') : t('bell.title');

  return (
    <div className={WRAP_CLASSES}>
      <button
        ref={triggerRef}
        className={TRIGGER_CLASSES}
        onClick={handleOpen}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        🔔
        {unseen && <span className={DOT_CLASSES} aria-hidden="true" />}
      </button>

      {open && (
        <Sheet className="summary-bell-panel" anchor={anchor} label={t('bell.title')}>
          <div className={HEADER_ROW_CLASSES}>
            <span />
            <button className={`summary-bell-close ${CLOSE_CLASSES}`} onClick={closeSheet} aria-label={t('common.close')}>✕</button>
          </div>
          <h1 className={TITLE_CLASSES}>{t('bell.title')}</h1>

          <div className={SECTIONS_CLASSES}>
            {summaries.length > 0 && (
              <Section label={t('bell.latestGame')}>
                {newestFirst(summaries).map(s => (
                  <button
                    key={summaryKey(s)}
                    className={`${CHIP_CLASSES} ${s.isGameSummary ? CHIP_GAME_CLASSES : ''}`}
                    onClick={() => handleOpenSummary(s)}
                  >
                    <span className={`${CHIP_PERIOD_CLASSES} ${s.isGameSummary ? CHIP_PERIOD_GAME_CLASSES : ''}`}>
                      {s.isGameSummary ? 'FINAL' : s.periodShort}
                    </span>
                    <span className={ROW_TEXT_CLASSES}>
                      <span className={CHIP_SCORE_CLASSES}>
                        {s.carGoals !== undefined ? `${teamAbbr} ${s.carGoals}–${s.oppGoals}` : t('settings.viewSummary')}
                      </span>
                      <span className={ROW_SUB_CLASSES}>
                        {s.isGameSummary ? t('bell.finalSummary') : t('bell.periodSummary', { period: s.periodLabel })}
                      </span>
                    </span>
                    {newAtOpen.has(summaryKey(s)) && <span className={NEW_DOT_CLASSES} aria-label={t('bell.new')} />}
                    <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
                  </button>
                ))}
              </Section>
            )}

            {shownAlerts.length > 0 && (
              <Section
                label={t('bell.recentAlerts')}
                footer={t('bell.recentAlertsNote')}
                action={(
                  <button className={`summary-bell-clear-all ${SECTION_ACTION_CLASSES}`} onClick={() => setCleared(clearAllAlerts(alerts))}>
                    {t('bell.clearAll')}
                  </button>
                )}
              >
                {shownAlerts.map(a => {
                  const link = alertLink(a);
                  const isNew = a.at > newAlertsAtOpen;
                  const content = (
                    <>
                      <span className={ICON_CLASSES} aria-hidden="true">{ALERT_ICONS[a.type] || '🔔'}</span>
                      <span className={ROW_TEXT_CLASSES}>
                        <span className={ROW_TITLE_CLASSES}>{a.title}</span>
                        {a.body && <span className={ROW_SUB_CLASSES}>{a.body}</span>}
                      </span>
                      {isNew && <span className={NEW_DOT_CLASSES} aria-label={t('bell.new')} />}
                      <span className={`${AGE_CLASSES} ${UNDER_X_CLASSES}`}>{alertAge(a.at, Date.now(), i18n.language)}</span>
                      {link && <span className={`${CHEVRON_CLASSES} ${UNDER_X_CLASSES}`} aria-hidden="true">›</span>}
                    </>
                  );
                  return (
                    <SwipeToDelete
                      key={alertId(a)}
                      deleteLabel={t('bell.clearAlert', { title: a.title })}
                      onDelete={() => setCleared(c => dismissAlert(c, a))}
                    >
                      {link
                        ? <button className={`summary-bell-alert ${ROW_BUTTON_CLASSES}`} onClick={() => handleOpenAlert(link)}>{content}</button>
                        : <div className={`summary-bell-alert ${ROW_CLASSES}`}>{content}</div>}
                    </SwipeToDelete>
                  );
                })}
              </Section>
            )}

            {summaries.length === 0 && shownAlerts.length === 0 && (
              <p className={EMPTY_CLASSES}>{t('bell.empty')}</p>
            )}

            <Section>
              <button className={`summary-bell-alert-settings ${ROW_BUTTON_CLASSES}`} onClick={handleAlertSettings}>
                <span className={ICON_CLASSES} aria-hidden="true">⚙️</span>
                <span className={ROW_TEXT_CLASSES}>
                  <span className={ROW_TITLE_CLASSES}>{t('bell.alertSettings')}</span>
                  <span className={ROW_SUB_CLASSES}>{t('bell.alertSettingsSub')}</span>
                </span>
                <span className={CHEVRON_CLASSES} aria-hidden="true">›</span>
              </button>
            </Section>
          </div>
        </Sheet>
      )}
    </div>
  );
}
