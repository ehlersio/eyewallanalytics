// components/NotificationsBell.jsx -- the 🔔 next to the ⚙️ in the top bar
// (Settings redesign, Option C, 2026-09). Holds the latest game's period
// and final summaries, newest first, with a dot on the bell while there's
// one you haven't looked at yet. Settings keeps only settings; this is
// where summaries live. Recent alerts join them in a later step.
//
// Only for leagues whose game view makes summaries (NHL and PWHL, through
// PeriodSummaryContext) -- AHL/ECHL would only ever show the empty state.
//
// Marker classes for Cypress: summary-bell (the button), summary-bell-dot,
// summary-bell-panel, and the notif-summary-chip* ones on each summary row
// (period-summary, shot-map, goal-replay select on those).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { useSport } from '../utils/SportContext';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { PWHL_TEAM_CONFIG } from '../utils/pwhlApi';
import { hasUnseen, loadSeen, markSeen, newestFirst, summaryKey } from '../utils/summarySeen';
import { OPEN_SETTINGS_EVENT } from './SettingsMenu';
import {
  CHEVRON_CLASSES, CLOSE_CLASSES, HEADER_ROW_CLASSES, ICON_CLASSES, ROW_BUTTON_CLASSES, ROW_SUB_CLASSES,
  ROW_TEXT_CLASSES, ROW_TITLE_CLASSES, SECTIONS_CLASSES, Section, Sheet, TITLE_CLASSES, useSheet,
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
const EMPTY_CLASSES = 'summary-bell-empty text-[14px] text-[color:var(--text-muted)] leading-[1.5] m-0 px-1';

export default function NotificationsBell() {
  const { t } = useTranslation();
  const { isPWHL, isAHL, isECHL } = useSport();
  const { summaries, openSummary } = usePeriodSummaryContext();
  const triggerRef = useRef(null);
  const [seen, setSeen] = useState(loadSeen);
  // What was new when the bell was opened, so those rows keep their dot
  // while it's open even though opening marks them seen.
  const [newAtOpen, setNewAtOpen] = useState(() => new Set());
  const { open, anchor, openSheet, closeSheet } = useSheet('bell', triggerRef);

  const teamAbbr = isPWHL ? PWHL_TEAM_CONFIG?.abbr : TEAM_CONFIG.abbr;
  const unseen = hasUnseen(summaries, seen);

  // Anything that arrives while it's open counts as seen too.
  useEffect(() => {
    if (open && hasUnseen(summaries, seen)) setSeen(markSeen(summaries, seen));
  }, [open, summaries, seen]);

  if (isAHL || isECHL) return null;

  const handleOpen = () => {
    if (open) { closeSheet(); return; }
    setNewAtOpen(new Set(summaries.map(summaryKey).filter(k => !seen.has(k))));
    setSeen(markSeen(summaries, seen));
    openSheet();
  };

  const handleOpenSummary = s => {
    closeSheet();
    openSummary(s);
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
            {summaries.length > 0 ? (
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
            ) : (
              <p className={EMPTY_CLASSES}>{t('bell.empty', { team: teamAbbr })}</p>
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
