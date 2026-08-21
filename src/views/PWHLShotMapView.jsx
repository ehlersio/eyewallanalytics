// views/PWHLShotMapView.jsx
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFetch, usePoll } from '../hooks/useFetch';
import {
  fetchPWHLShots, fetchPWHLRoster, fetchPWHLSchedule, fetchPWHLPBP,
  fetchPWHLToday, fetchPWHLLive, fetchPWHLTeamSeasonSummary,
  pbpByType,
  PWHL_TEAM_CONFIG, PWHL_TEAM_ID,
} from '../utils/pwhlApi';
import {
  PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, isPWHLPlayoffSeason,
  PWHL_REGULAR_SEASONS as SEASONS,
  PWHL_PLAYOFF_SEASON_MAP, PWHL_REGULAR_SEASON_MAP,
  getPWHLTeamById,
} from '../utils/pwhlConfig';
import { usePWHLDevGame } from '../utils/PWHLDevGameContext';
import {
  usePWHLGameEvents,
  PWHLGoalPopup, PWHLPenaltyPopup, PWHLWinPopup, PWHLPuckDropPopup,
  PWHLLiveInsights,
} from '../components/PWHLGameEvents';
import { HatTrickPopup } from '../components/GameEvents';
import { usePWHLPeriodSummary, usePWHLGameSummary } from '../hooks/usePWHLPeriodSummary';
import PWHLPeriodSummary from '../components/PWHLPeriodSummary';
import { usePeriodSummaryContext } from '../utils/PeriodSummaryContext';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import TeamLogo from '../components/TeamLogo';
import { MetCard } from '../components/StatBar';
import InfoTip from '../components/InfoTip';
import GameChipsRow, { LiveGameChip } from '../components/GameChipsRow';
import SeasonChipRow from '../components/SeasonChipRow';
import SeasonTypeToggle from '../components/SeasonTypeToggle';
import { rinkBtnClasses } from '../utils/rinkBtnClasses';
import { PAGE_CLASSES } from '../utils/pageClasses';
// ShotMapView.css import removed (Phase 5, sub-PR 6) -- the file is now
// fully deleted, every rule migrated to Tailwind across all 6 sub-PRs.

// SEASONS moved to pwhlConfig.js's PWHL_REGULAR_SEASONS (Session 43) — was
// an independent 5th copy of the same regular-season id/label list.

// Local TEAM_CODES (team_id -> abbr) map removed Session 85 — it was a
// stale 5th duplicate of the team-id list CLAUDE.md already flags as
// independently duplicated across repos, missing team_id 7 and all 4
// expansion teams (10-13). Silently broke opponent abbr/name/logo for
// expansion-team games in three places (game chips, score card). Use
// getPWHLTeamById (derived from PWHL_TEAMS, pwhlConfig.js) instead.

// ── PP indicator classes (Phase 4, sub-PR 2 -- GameEvents.css deleted) ──
// .score-team-wrap/.pp-indicator/.car-pp/.opp-pp were transitive consumers
// of GameEvents.css (loaded as a side effect of importing PWHLGoalPopup etc.
// from ./PWHLGameEvents above), not declared consumers -- migrated here
// rather than left as dead classNames. .en-indicator/.car-en/.opp-en stay
// literal and untouched: they're ShotMapView.css's own classes (out of
// scope), and use !important so they win regardless of how .pp-indicator's
// base becomes Tailwind utilities. Duplicated from ShotMapView.jsx.
const SCORE_TEAM_WRAP_CLASSES = 'flex flex-col items-center gap-1';
const PP_INDICATOR_BASE_CLASSES = 'text-[10px] font-bold py-0.5 px-2 rounded-[4px] animate-[ppPulse_1.5s_ease-in-out_infinite]';
const CAR_PP_CLASSES = 'car-pp bg-[rgba(61,186,126,0.2)] text-[color:var(--green)] border-[0.5px] border-[rgba(61,186,126,0.4)]';
const OPP_PP_CLASSES = 'opp-pp bg-[rgba(240,160,48,0.2)] text-[color:var(--amber)] border-[0.5px] border-[rgba(240,160,48,0.3)]';

// ── Score bar / boxscore basics (Phase 5, sub-PR 1 -- ShotMapView.css
// migrating to Tailwind; duplicated from ShotMapView.jsx per convention.
// PWHL has no period-grid or event-log rendering (confirmed via full-file
// grep -- PWHLGameEvents.jsx handles live events differently), so those
// constants aren't duplicated here. See ShotMapView.jsx's header comment
// for the .log-badge / .goalie-stat-val property-race fixes and the
// .team-primary-text unlayered-marker reasoning -- same fixes, same
// reasoning, applied here too.
const SCORE_CARD_CLASSES = 'score-card card mb-[10px]';
const SCORE_INNER_CLASSES = 'flex items-center justify-between gap-[10px]';
const SCORE_TEAM_CLASSES = 'flex items-center gap-2';
const scoreAbbrClasses = (variant) => {
  const base = 'font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[.04em]';
  if (variant === 'team-primary') return `${base} team-primary-text`;
  const color = variant === 'red' ? 'text-[color:var(--red-bright)]'
    : variant === 'muted' ? 'text-[color:var(--text-muted)]' : '';
  return `${base} ${color}`;
};
const scoreNumClasses = (variant) => {
  const base = 'font-[family-name:var(--font-display)] text-[36px] font-bold leading-none';
  if (variant === 'team-primary') return `${base} team-primary-text`;
  const color = variant === 'red' ? 'text-[color:var(--red-bright)]'
    : variant === 'muted' ? 'text-[color:var(--text-muted)]' : '';
  return `${base} ${color}`;
};
const SCORE_CENTER_CLASSES = 'text-center';
const SCORE_PERIOD_CLASSES = 'text-[11px] text-[color:var(--amber)] font-semibold uppercase tracking-[.06em]';
const SCORE_CLOCK_CLASSES = 'font-[family-name:var(--font-mono)] text-[22px] text-[color:var(--text)] leading-[1.2]';
const SCORE_STATE_CLASSES = 'text-[10px] text-[color:var(--text-dim)]';
// .pill/.pill-red (index.css, Phase 7b) -- shape + live-state color, this
// file's only real consumer of either class (.pill-green/.pill-amber were
// confirmed 100% dead app-wide during Phase 5 sub-PR 3's investigation).
const PILL_RED_CLASSES = 'inline-flex items-center gap-[5px] py-[3px] px-[10px] rounded-[20px] text-[11px] font-medium bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[color:var(--red-border)]';
// .dual-bar/.fill-blue (index.css, Phase 7b) -- see ShotMapView.jsx's
// identical comment for the full reasoning (marker kept for .dual-bar's
// light-mode override, fill classes convert cleanly with no override or
// shared-variant-function risk).
const DUAL_BAR_CLASSES = 'dual-bar flex h-[5px] rounded-[3px] overflow-hidden bg-[rgba(255,255,255,0.07)]';
const FILL_TEAM_PRIMARY_CLASSES = 'h-full bg-[var(--team-primary)] opacity-[0.85]';
// .two-col (index.css, Phase 7b) -- see ShotMapView.jsx's identical comment
// (only 2 real consumers app-wide, this file and ShotMapView.jsx).
const TWO_COL_CLASSES = 'grid grid-cols-[1fr_260px] gap-3 min-h-[400px] items-start max-[700px]:grid-cols-1';
const FILL_BLUE_CLASSES = 'h-full bg-[var(--blue-bright)] [transition:width_0.4s_ease]';

const metricsGridClasses = (cols) => cols === 4
  ? 'grid grid-cols-4 gap-2 mb-2'
  : 'grid grid-cols-3 gap-2 mb-[10px]';

const DANGER_GRID_CLASSES = 'grid grid-cols-3 gap-2 mt-2';
const DANGER_CELL_CLASSES =
  "danger-cell text-center p-[10px_6px] rounded-[var(--radius-sm)] bg-[var(--bg3)] relative cursor-pointer [transition:background_0.15s,transform_0.1s] hover:bg-[var(--bg2)] hover:-translate-y-px active:translate-y-0 after:content-['›'] after:absolute after:bottom-1 after:right-1.5 after:text-[10px] after:text-[color:var(--text-dim)] after:opacity-50";
const dangerNumClasses = (level) => {
  const color = level === 'high' ? 'text-[color:var(--red-bright)]'
    : level === 'med' ? 'text-[color:var(--amber)]' : 'text-[color:var(--text-muted)]';
  return `font-[family-name:var(--font-display)] text-[28px] font-bold leading-none mb-1 ${color}`;
};
const DANGER_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-muted)] mb-0.5';
const DANGER_SUB_CLASSES = 'text-[9px] text-[color:var(--text-dim)]';

const SCORER_ROW_CLASSES = 'flex items-center justify-between gap-2 py-[6px] border-b-[0.5px] border-[color:var(--border)]';
const SCORER_NAME_CLASSES = 'text-[13px] text-[color:var(--text)] flex-1';
const SCORER_STATS_CLASSES = 'flex gap-1';
const SCORER_CHIP_VARIANTS = {
  goal: 'bg-[rgba(61,186,126,.15)] text-[color:var(--green)]',
  assist: 'bg-[rgba(100,120,200,.15)] text-[#8899dd]',
  pts: 'bg-[var(--bg3)] text-[color:var(--text-muted)]',
};
const scorerChipClasses = (variant) =>
  `scorer-chip ${variant} text-[10px] font-semibold py-[2px] px-[6px] rounded-[4px] font-[family-name:var(--font-mono)] ${SCORER_CHIP_VARIANTS[variant]}`;

const GOALIE_CARD_CLASSES = 'py-2 border-b-[0.5px] border-[color:var(--border)]';
const GOALIE_HEADER_CLASSES = 'flex items-center gap-2 mb-2';
const GOALIE_ABBR_CLASSES = 'font-[family-name:var(--font-display)] text-[13px] font-bold shrink-0';
const GOALIE_NAME_CLASSES = 'text-[13px] font-medium text-[color:var(--text)]';
const GOALIE_STATS_GRID_CLASSES = 'flex gap-4 flex-wrap';
const GOALIE_STAT_COL_CLASSES = 'flex flex-col gap-0.5 min-w-[48px]';
const GOALIE_STAT_LABEL_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-dim)] flex items-center gap-0.5';
const goalieStatValClasses = (isSvPct) =>
  `font-[family-name:var(--font-mono)] text-[13px] font-semibold ${isSvPct ? 'text-[color:var(--green)]' : 'text-[color:var(--text-muted)]'}`;

const GM_STAT_HEADER_CLASSES = 'grid grid-cols-[42px_1fr_42px] gap-2 text-[11px] font-semibold text-center mb-[6px]';
const GM_STAT_ROW_CLASSES = 'grid grid-cols-[42px_1fr_42px] gap-2 items-center mb-[7px]';
const GM_STAT_MID_CLASSES = 'flex flex-col gap-[3px]';
const GM_STAT_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-muted)] text-center flex items-center justify-center gap-[3px]';
const gmStatValClasses = (variant) => {
  const base = 'font-[family-name:var(--font-mono)] text-[13px] font-medium text-center';
  if (variant === 'team-primary') return `${base} team-primary-text`;
  return `${base} ${variant === 'red' ? 'text-[color:var(--red-bright)]' : 'text-[color:var(--text-muted)]'}`;
};

// ── Stat Drill-Down Popup (Phase 5, ShotMapView.css sub-PR 2) --
// duplicated from ShotMapView.jsx per convention. PWHL's drill popup is
// simpler: no per-period faceoff breakdown chips (no .drill-periods/
// .period-chip/.c-green/.c-red here), no penalty totals row, no
// penaltyType badge -- see ShotMapView.jsx's header comment for the full
// property-race reasoning (.drill-val, .drill-tab, the drill-row-grid/
// drill-totals-row and drill-totals-row/pen-totals separate-class pairs).
// PPAnalysisPanel/PKAnalysisPanel's own "drill-empty" usages stay literal
// for now -- out of this sub-PR's scope (PP Analysis Panel, later sub-PR),
// and ShotMapView.css's `.drill-empty` rule stays in the file until those
// migrate too.
const DRILL_OVERLAY_CLASSES = 'drill-overlay fixed inset-0 z-[300] bg-[rgba(0,0,0,0.65)] flex items-center justify-center pt-4 px-0 pb-[72px] box-border';
const DRILL_POPUP_CLASSES = 'drill-popup bg-[var(--bg1)] rounded-[14px] w-[calc(100%-32px)] max-w-[460px] max-h-full flex flex-col border-[0.5px] border-[color:var(--border)] shadow-[0_8px_48px_rgba(0,0,0,0.6)] overflow-hidden';
const DRILL_HEADER_CLASSES = 'flex items-center justify-between pt-[13px] pb-[11px] px-4 border-b-[0.5px] border-[color:var(--border)] shrink-0';
const DRILL_TITLE_CLASSES = 'font-[family-name:var(--font-display)] text-[15px] font-bold text-[color:var(--text)]';
const DRILL_CLOSE_CLASSES = 'drill-close text-[18px] text-[color:var(--text-dim)] bg-transparent border-0 cursor-pointer py-0.5 px-2 rounded-[6px] leading-none hover:bg-[var(--bg3)] hover:text-[color:var(--text)]';
const DRILL_BODY_CLASSES = 'overflow-y-auto flex-1';
const DRILL_EMPTY_CLASSES = 'text-[color:var(--text-dim)] text-[13px] py-6 px-4 text-center';
const DRILL_TABLE_CLASSES = 'flex flex-col';
const DRILL_CHILD_ALIGN = '[&>*]:flex [&>*]:items-center [&>*:not(:first-child)]:justify-end';
const DRILL_COL_HEADER_CLASSES = `grid py-[5px] px-4 text-[9px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] border-b-[0.5px] border-[color:var(--border)] bg-[var(--bg2)] ${DRILL_CHILD_ALIGN}`;
const DRILL_COL_HEADER_FO_CLASSES = `${DRILL_COL_HEADER_CLASSES} grid-cols-[1fr_46px_46px_52px]`;
const DRILL_ROW_GRID_CLASSES = `drill-row-grid grid pt-[7px] pb-[7px] px-4 border-b-[0.5px] border-[rgba(255,255,255,0.04)] items-center ${DRILL_CHILD_ALIGN}`;
const DRILL_ROW_GRID_FO_CLASSES = `${DRILL_ROW_GRID_CLASSES} grid-cols-[1fr_46px_46px_52px]`;
const DRILL_ROW_GRID_SHOTS_TOTALS_CLASSES = `drill-row-grid grid pt-1 pb-[7px] px-4 mt-1 border-t border-t-[color:var(--border)] border-b-[0.5px] border-b-[rgba(255,255,255,0.04)] font-bold items-center ${DRILL_CHILD_ALIGN}`;
const DRILL_NAME_CLASSES = 'text-[13px] font-medium text-[color:var(--text)] min-w-0';
const DRILL_NAME_TOTALS_LABEL_CLASSES = 'text-[11px] font-medium text-[color:var(--text-dim)] min-w-0';
const DRILL_VAL_BASE = 'font-[family-name:var(--font-mono)] text-[12px]';
const drillValClasses = (variant) => {
  if (variant === 'green') return `${DRILL_VAL_BASE} text-[color:var(--green)] font-semibold`;
  if (variant === 'red') return `${DRILL_VAL_BASE} text-[color:var(--red-bright)] font-semibold`;
  if (variant === 'dim') return `${DRILL_VAL_BASE} text-[color:var(--text-dim)]`;
  if (variant === 'total') return `${DRILL_VAL_BASE} text-[color:var(--text)] font-bold`;
  if (variant === 'total-dim') return `${DRILL_VAL_BASE} text-[color:var(--text-dim)] font-bold`;
  return `${DRILL_VAL_BASE} text-[color:var(--text)]`;
};
const DRILL_TABS_CLASSES = 'flex border-b-[0.5px] border-[color:var(--border)] px-4';
const DRILL_TAB_BASE = 'flex-1 py-2 text-[12px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer flex items-center justify-center gap-[6px]';
const drillTabClasses = (active) => `${DRILL_TAB_BASE} ${active
  ? 'text-[color:var(--red-bright)] border-b-[color:var(--red-bright)]'
  : 'text-[color:var(--text-dim)] border-b-transparent'}`;
const PEN_ROW_CLASSES = 'pen-row px-4 py-2 border-b-[0.5px] border-[rgba(255,255,255,0.04)]';
const PEN_ROW_TOP_CLASSES = 'flex items-center gap-2 mb-[3px]';
const PEN_ROW_BOTTOM_CLASSES = 'flex items-center gap-2';
const PEN_BADGE_CLASSES = 'text-[10px] font-bold py-0.5 px-[6px] rounded-[4px]';
const PEN_PERIOD_CLASSES = 'text-[10px] text-[color:var(--text-dim)] ml-auto';
const PEN_DESC_CLASSES = 'text-[11px] text-[color:var(--text-muted)] capitalize';

// ── Shot Volume Bar / Advanced Game Panel / Debug panel (Phase 5,
// ShotMapView.css sub-PR 4) -- duplicated from ShotMapView.jsx per
// convention. No Live Insights or shotmap-top-btn here -- Live Insights
// is PWHLGameEvents.jsx's PWHLInsightsCard (migrated there directly), and
// the top-button is NHL-only. .debug-panel-cols here wraps a single plain
// <div> (no .debug-col children) -- a real structural asymmetry from
// NHL's two real columns, not a bug, preserved as-is. See ShotMapView.jsx
// for the full property-race/card-combo reasoning (.shot-volume-section
// vs .card, .sv-num text-align race, .debug-btn's non-racing modifiers).
const SHOT_VOLUME_SECTION_CLASSES = 'shot-volume-section card';
const SV_WRAP_CLASSES = 'flex flex-col gap-[6px]';
const SV_HEADER_CLASSES = 'flex justify-between items-center mb-1';
const svTeamClasses = (variant) => {
  const base = 'text-[10px] font-bold uppercase min-w-[30px]';
  if (variant === 'muted') return `${base} text-[color:var(--text-muted)] text-right`;
  return base;
};
const SV_DIFF_CLASSES = 'font-[family-name:var(--font-mono)] text-[13px] font-bold';
const SV_ROW_CLASSES = 'grid grid-cols-[80px_28px_1fr_28px] gap-[6px] items-center';
const SV_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-muted)] cursor-help';
const svNumClasses = (variant) => {
  const base = 'font-[family-name:var(--font-mono)] text-[12px] font-semibold';
  if (variant === 'muted') return `${base} text-right text-[color:var(--text-muted)]`;
  return `${base} text-right`;
};
const SV_BAR_WRAP_CLASSES = 'h-[6px] rounded-[3px] bg-[var(--bg3)] flex overflow-hidden';
const svFillClasses = (variant) => {
  const base = 'h-full [transition:width_0.3s_ease]';
  if (variant === 'muted') return `${base} bg-[color:var(--text-dim)] rounded-[0_3px_3px_0]`;
  return base;
};
const SV_LABEL_WRAP_CLASSES = 'flex items-center gap-0.5';

const ADV_CHIPS_ROW_CLASSES = 'flex gap-2 flex-nowrap justify-between mt-[10px] pt-2 border-t-[0.5px] border-t-[color:var(--border)]';
const ADV_CHIP_CLASSES = 'flex flex-col items-center bg-[var(--bg3)] rounded-[8px] py-[6px] px-[10px] flex-1 cursor-help';
const ADV_CHIP_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]';
const ADV_CHIP_VAL_CLASSES = 'font-[family-name:var(--font-mono)] text-[14px] font-bold mt-0.5';

const DANGER_QUALITY_CARD_CLASSES = 'mb-[10px]';

const DEBUG_PANEL_CLASSES = 'debug-panel fixed left-1/2 -translate-x-1/2 bg-[var(--bg1)] border-[1.5px] border-[color:var(--red-bright)] rounded-[var(--radius)] p-[14px] w-[min(420px,94vw)] z-[999] shadow-[0_8px_32px_rgba(0,0,0,0.6)]';
const DEBUG_PANEL_BOTTOM_STYLE = { bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px)' };
const DEBUG_PANEL_HEADER_CLASSES = 'flex items-start justify-between mb-[10px]';
const DEBUG_CLOSE_BTN_CLASSES = 'debug-close-btn bg-[var(--bg3)] border-0 text-[color:var(--text-dim)] text-[13px] py-1 px-2 rounded-[6px] cursor-pointer shrink-0 ml-2 min-h-0 min-w-0 hover:text-[color:var(--text)]';
const DEBUG_PANEL_TITLE_CLASSES = 'text-[14px] font-bold mb-0.5';
const DEBUG_PANEL_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';
const DEBUG_PANEL_COLS_CLASSES = 'grid grid-cols-2 gap-x-[14px] gap-y-[10px]';
const DEBUG_SECTION_LABEL_CLASSES = 'text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--text-dim)] mb-0.5';
const DEBUG_PANEL_BTNS_CLASSES = 'flex flex-col gap-[5px]';
const DEBUG_BTN_BASE = 'py-[7px] px-[10px] rounded-[7px] text-[11px] font-semibold cursor-pointer border-0 text-left min-h-0 min-w-0 w-full';
const DEBUG_BTN_VARIANTS = {
  goal: 'bg-[rgba(200,30,30,0.2)] text-[#f87171]',
  penalty: 'bg-[rgba(250,190,30,0.2)] text-[#fbbf24]',
  win: 'bg-[rgba(74,222,128,0.2)] text-[#4ade80]',
  push: 'bg-[var(--bg3)] text-[color:var(--text)]',
  close: 'bg-[var(--bg3)] text-[color:var(--text-dim)]',
  'pp-car': 'bg-[rgba(74,222,128,0.2)] text-[#4ade80]',
  'pp-opp': 'bg-[rgba(250,190,30,0.2)] text-[#fbbf24]',
};
const debugBtnClasses = (variant) => `${DEBUG_BTN_BASE} ${DEBUG_BTN_VARIANTS[variant] || ''}`.trim();

// ── PP Analysis Panel (Phase 5, ShotMapView.css sub-PR 5) -- duplicated
// from ShotMapView.jsx per convention. PWHL's PP/PK panels are simpler:
// no PP/PK units feature (ppUnit1/ppUnit2/pkUnit1/pkUnit2 are destructured
// but unused, confirmed via full-file grep), no assists shown, no shot-
// type/blocker breakdown row -- so no unit-chip/unit-badge/unit-note/
// goal-assists/shottype constants are needed here at all.
const PP_ANALYSIS_CLASSES = 'flex flex-col gap-3 py-1';
const PP_SUMMARY_ROW_CLASSES = 'flex items-center justify-around bg-[var(--bg3)] rounded-[10px] py-[12px] px-2 mx-4';
const PP_SUMMARY_STAT_CLASSES = 'flex flex-col items-center gap-0.5';
const PP_SUMMARY_VAL_CLASSES = 'text-[20px] font-bold text-[color:var(--text)] leading-none';
const PP_SUMMARY_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] flex items-center gap-0.5';
const PP_SUMMARY_DIVIDER_CLASSES = 'w-px h-8 bg-[var(--border)]';

const PP_OPPS_LIST_CLASSES = 'flex flex-col gap-0';
const PP_OPP_ITEM_CLASSES = 'border-t-[0.5px] border-t-[color:var(--border)] last:border-b-[0.5px] last:border-b-[color:var(--border)]';
const PP_OPP_HEADER_CLASSES = 'flex items-center justify-between py-[10px] px-4 cursor-pointer active:bg-[var(--bg3)]';
const PP_OPP_LEFT_CLASSES = 'flex items-center gap-2';
const PP_OPP_RIGHT_CLASSES = 'flex items-center gap-2';
const PP_OPP_NUM_CLASSES = 'text-[11px] font-bold text-[color:var(--text-muted)]';
const PP_OPP_TIME_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';
const PP_OPP_SOG_CLASSES = 'text-[11px] text-[color:var(--text-dim)]';
const PP_OPP_CHEVRON_CLASSES = 'text-[10px] text-[color:var(--text-dim)]';
const PP_ENTRY_BADGE_CLASSES = 'text-[9px] font-semibold py-[1px] px-[6px] bg-[rgba(250,190,30,0.12)] text-[#fbbf24] rounded-[20px] border-[0.5px] border-[rgba(250,190,30,0.25)]';

const PP_OUTCOME_VARIANTS = {
  goal: 'bg-[rgba(74,222,128,0.15)] text-[color:var(--green)] border-[0.5px] border-[rgba(74,222,128,0.3)]',
  shots: 'bg-[rgba(148,163,184,0.12)] text-[color:var(--text-muted)] border-[0.5px] border-[color:var(--border)]',
  none: 'bg-[rgba(248,113,113,0.1)] text-[color:var(--red-bright)] border-[0.5px] border-[rgba(248,113,113,0.2)]',
};
const ppOutcomeClasses = (variant) =>
  `text-[10px] font-bold py-0.5 px-[7px] rounded-[20px] ${PP_OUTCOME_VARIANTS[variant]}`;

const PP_OPP_DETAIL_CLASSES = 'px-4 pb-[14px] flex flex-col gap-[10px] bg-[var(--bg3)] border-t-[0.5px] border-t-[color:var(--border)]';
const PP_GOAL_ROW_CLASSES = 'flex items-start gap-2 pt-2 pb-1';
const PP_GOAL_ICON_CLASSES = 'text-[16px] leading-[1.2]';
const PP_GOAL_SCORER_CLASSES = 'text-[13px] font-semibold text-[color:var(--text)]';
const PP_GOAL_SHOTTYPE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] ml-[6px] py-[1px] px-[5px] bg-[var(--bg2)] rounded-[4px]';
const PP_GOAL_TIME_CLASSES = 'text-[11px] text-[color:var(--text-dim)] ml-auto whitespace-nowrap';

const PP_DETAIL_STATS_CLASSES = 'flex gap-0 bg-[var(--bg2)] rounded-[8px] overflow-hidden';
const PP_DETAIL_STAT_CLASSES = 'flex-1 flex flex-col items-center py-2 px-1 gap-0.5 border-r-[0.5px] border-r-[color:var(--border)] last:border-r-0';
const PP_DETAIL_VAL_CLASSES = 'text-[15px] font-bold text-[color:var(--text)]';
const PP_DETAIL_LABEL_CLASSES = 'text-[9px] text-[color:var(--text-dim)] uppercase tracking-[0.04em]';

const PP_MINI_RINK_CLASSES = 'mt-1';
const PP_MINI_RINK_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mb-1';

// ── Shot adapters ─────────────────────────────────────────────

function mapEventType(t) {
  if (t === 'goal')                                return 'goal';
  if (t === 'blocked_shot' || t === 'blocked-shot') return 'blocked-shot';
  return 'shot-on-goal';
}

/** Adapt a row from pwhl_shot_events (our team) → IceRink event */
function adaptOurShot(row, playerMap) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  if (x < 0) { x = -x; y = -y; }
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id: row.id, x, y,
    type:         mapEventType(row.event_type),
    isCanes:      true,       // our team = highlighted colour
    period:       row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName:  playerMap[row.shooter_id] || null,
    gameId:       row.game_id,
    shotType:     row.shot_type || null,
  };
}

/**
 * Adapt a row from opp_shots (all shots for the game, from Worker).
 * x_norm is negative for shots attacking the left net, positive for right.
 * We fold to positive x = attacking zone, same as our shots, but mark isCanes=false.
 */
function adaptOppShot(row) {
  const secs = row.time_seconds || 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  let x = parseFloat(row.x_norm);
  let y = parseFloat(row.y_norm);
  // Fold to attacking direction: negative x means attacking left net in pwhl coords
  if (x > 0) { x = -x; y = -y; }   // flip so attacking direction = positive x
  x = Math.abs(x);
  x = Math.min(x, 99);
  y = Math.max(-42, Math.min(42, y));
  return {
    id:           `opp-${row.shooter_id}-${row.time_seconds}`,
    x, y,
    type:         mapEventType(row.event_type),
    isCanes:      false,      // opponent = muted colour
    period:       row.period_id,
    timeInPeriod: `${mm}:${ss}`,
    shooterName:  row.shooter_name || null,
    gameId:       null,
    shotType:     null,
  };
}

/**
 * Adapt a live shot/goal event from /pwhl/live/:gameId → IceRink event.
 * Live events use raw x/y coords (not pre-normalised like stored shot events).
 */
function adaptLiveShot(ev, isOurTeam) {
  const CANVAS_W = 600.0, CANVAS_H = 300.0;
  const xRaw = ev.x, yRaw = ev.y;
  if (xRaw == null || yRaw == null) return null;
  const period = ev.period || 1;
  // Normalise to NHL rink coords (same transform as pwhl_shot_events.py)
  let xNorm = (xRaw / CANVAS_W - 0.5) * 200;
  let yNorm = (yRaw / CANVAS_H - 0.5) * 85;
  // Home attacks right in odd periods
  const homeAttacksRight = period % 2 === 1;
  const attackingRight   = isOurTeam ? homeAttacksRight : !homeAttacksRight;
  if (!attackingRight) { xNorm = -xNorm; yNorm = -yNorm; }
  // Fold to attacking direction (positive x)
  if (xNorm < 0) { xNorm = -xNorm; yNorm = -yNorm; }
  xNorm = Math.min(Math.abs(xNorm), 99);
  yNorm = Math.max(-42, Math.min(42, yNorm));

  const type = ev.isGoal || ev.eventType === 'goal'
    ? 'goal'
    : ev.eventType === 'blocked_shot' ? 'blocked-shot'
    : 'shot-on-goal';

  const shooter = ev.scorer || ev.scoredBy || ev.shooter;
  const name    = shooter ? `${shooter.firstName || ''} ${shooter.lastName || ''}`.trim() : null;

  return {
    id:           `live-${ev.eventType}-${ev.period}-${ev.timeSeconds}`,
    x:            xNorm,
    y:            yNorm,
    type,
    isCanes:      isOurTeam,
    period:       ev.period,
    timeInPeriod: ev.time || '0:00',
    shooterName:  name || null,
    gameId:       null,
    shotType:     ev.shotType || null,
  };
}

// pLabel moved inside PWHLShotMapView (needs isPlayoff in scope to label
// period 5+ correctly — see the component body).

function distFromGoal(x, y) {
  return Math.sqrt(Math.pow(Math.abs(x) - 89, 2) + y * y);
}

// GameChip/GameChipsRow/LiveGameChip generalized into
// src/components/GameChipsRow.jsx (Session 77) so ShotMapView.jsx (NHL)
// shares the same component instead of a forked copy. Raw schedule rows
// are mapped into the shared normalized shape just before render — see
// `gameChipGames`/`liveGameChipData` below.

// ── Stat Drill Popup ──────────────────────────────────────────

function StatDrillPopup({ drillStat, onClose, abbr, oppAbbr, color }) {
  const [tab, setTab] = useState('car');
  if (!drillStat) return null;

  const carRows = drillStat.carRows ?? drillStat.rows ?? [];
  const oppRows = drillStat.oppRows ?? [];
  const hasOpp  = drillStat.oppRows !== undefined;
  const rows    = tab === 'car' ? carRows : oppRows;
  const teamLabel = tab === 'car' ? abbr : (oppAbbr || 'OPP');

  const allPeriods = [...new Set(
    [...carRows, ...oppRows].flatMap(r => Object.keys(r.periods || {}))
  )].sort((a, b) => {
    const sk = l => {
      if (l === 'OT') return 4; if (l === 'SO') return 5;
      const m = l.match(/^(\d+)OT$/); if (m) return 3 + parseInt(m[1]);
      return parseInt(l.replace(/\D/g, '')) || 99;
    };
    return sk(a) - sk(b);
  });
  const periods    = allPeriods.length > 0 ? allPeriods : ['P1', 'P2', 'P3'];
  const periodTots = periods.reduce((acc, p) => {
    acc[p] = rows.reduce((s, r) => s + (r.periods?.[p] || 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((s, r) => s + (r.total || 0), 0);

  return (
    <div className={DRILL_OVERLAY_CLASSES} onClick={onClose}>
      <div className={DRILL_POPUP_CLASSES} onClick={e => e.stopPropagation()}>
        <div className={DRILL_HEADER_CLASSES}>
          <span className={DRILL_TITLE_CLASSES}>{drillStat.label}</span>
          <button className={DRILL_CLOSE_CLASSES} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {hasOpp && (
          <div className={DRILL_TABS_CLASSES}>
            <button className={drillTabClasses(tab === 'car')} onClick={() => setTab('car')}>
              <TeamLogo abbr={abbr} sport="pwhl" size={18} /> {abbr}
            </button>
            <button className={drillTabClasses(tab === 'opp')} onClick={() => setTab('opp')}>
              <TeamLogo abbr={oppAbbr} sport="pwhl" size={18} /> {oppAbbr || 'OPP'}
            </button>
          </div>
        )}

        <div className={DRILL_BODY_CLASSES}>
          {drillStat.type === 'shots' && (
            rows.length === 0
              ? <div className={DRILL_EMPTY_CLASSES}>No {teamLabel} data for this game.</div>
              : (
                <div className={DRILL_TABLE_CLASSES}>
                  <div className={DRILL_COL_HEADER_CLASSES}
                    style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                    <span>Player</span>
                    {periods.map(p => <span key={p}>{p}</span>)}
                    <span>Total</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={i} className={DRILL_ROW_GRID_CLASSES}
                      style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                      <span className={DRILL_NAME_CLASSES}>{r.name}</span>
                      {periods.map(p => (
                        <span key={p} className={drillValClasses(r.periods?.[p] ? undefined : 'dim')}>
                          {r.periods?.[p] || '—'}
                        </span>
                      ))}
                      <span className={drillValClasses('total')}>{r.total}</span>
                    </div>
                  ))}
                  {grandTotal > 0 && (
                    <div className={DRILL_ROW_GRID_SHOTS_TOTALS_CLASSES}
                      style={{ gridTemplateColumns: `1fr ${periods.map(() => '34px').join(' ')} 42px` }}>
                      <span className={DRILL_NAME_TOTALS_LABEL_CLASSES}>Total</span>
                      {periods.map(p => (
                        <span key={p} className={drillValClasses(periodTots[p] ? 'total' : 'total-dim')}>
                          {periodTots[p] || '—'}
                        </span>
                      ))}
                      <span className={drillValClasses('total')}>{grandTotal}</span>
                    </div>
                  )}
                </div>
              )
          )}

          {drillStat.type === 'faceoff' && (
            <div className={DRILL_TABLE_CLASSES}>
              {rows.length === 0
                ? <div className={DRILL_EMPTY_CLASSES}>No faceoff data for this game.</div>
                : (
                  <>
                    <div className={DRILL_COL_HEADER_FO_CLASSES}>
                      <span>Player</span><span>Won</span><span>Lost</span><span>Win%</span>
                    </div>
                    {rows.map((r, i) => (
                      <div key={i} className={DRILL_ROW_GRID_FO_CLASSES}>
                        <span className={DRILL_NAME_CLASSES}>{r.name}</span>
                        <span className={drillValClasses('green')}>{r.totalWon}</span>
                        <span className={drillValClasses('red')}>{r.totalLost}</span>
                        <span className={drillValClasses()}>
                          {r.total > 0 ? `${Math.round(r.totalWon / r.total * 100)}%` : '—'}
                        </span>
                      </div>
                    ))}
                  </>
                )
              }
            </div>
          )}

          {drillStat.type === 'ppanalysis' && (
            <PPAnalysisPanel drillStat={drillStat} abbr={abbr} color={color} />
          )}

          {drillStat.type === 'pkanalysis' && (
            <PKAnalysisPanel drillStat={drillStat} abbr={abbr} color={color} />
          )}

          {drillStat.type === 'penalties' && (
            <div className={DRILL_TABLE_CLASSES}>
              {rows.length === 0
                ? <div className={DRILL_EMPTY_CLASSES}>No {teamLabel} penalties.</div>
                : rows.map((r, i) => (
                  <div key={i} className={PEN_ROW_CLASSES}>
                    <div className={PEN_ROW_TOP_CLASSES}>
                      <span className={DRILL_NAME_CLASSES}>{r.name}</span>
                      <span className={PEN_BADGE_CLASSES}
                        style={{
                          background: r.minutes <= 2 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.2)',
                          color:      r.minutes <= 2 ? '#fbbf24'               : '#f87171',
                        }}>
                        {r.minutes} min
                      </span>
                      <span className={PEN_PERIOD_CLASSES}>{r.period}</span>
                    </div>
                    <div className={PEN_ROW_BOTTOM_CLASSES}>
                      <span className={PEN_DESC_CLASSES}>{r.description}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shot Attempts panel ───────────────────────────────────────

function ShotAttemptsPanel({ ourShots, oppShotRows, abbr, oppAbbr, color, goalieStats, teamId }) {
  const carSOG     = ourShots.filter(e => e.type === 'shot-on-goal' || e.type === 'goal').length;
  const carBlocked = ourShots.filter(e => e.type === 'blocked-shot').length;
  const carCorsi   = carSOG + carBlocked;
  const carFenwick = carSOG;

  const oppSOG     = oppShotRows.filter(r => r.event_type === 'shot' || r.event_type === 'goal').length;
  const oppBlocked = oppShotRows.filter(r => r.event_type === 'blocked_shot').length;
  const oppCorsi   = oppSOG + oppBlocked;
  const oppFenwick = oppSOG;

  const cfPct = carCorsi + oppCorsi > 0 ? Math.round(carCorsi  / (carCorsi  + oppCorsi)  * 100) : null;
  const ffPct = carFenwick + oppFenwick > 0 ? Math.round(carFenwick / (carFenwick + oppFenwick) * 100) : null;

  // xG from coordinates
  let xg = 0;
  ourShots.forEach(e => { xg += Math.max(Math.exp(-distFromGoal(e.x, e.y) / 15) * 0.55, 0.02); });
  xg = parseFloat(xg.toFixed(2));

  const goals      = ourShots.filter(e => e.type === 'goal').length;
  const luckDelta  = parseFloat((goals - xg).toFixed(2));
  const luckColor  = luckDelta > 0.5 ? 'var(--amber)' : luckDelta < -0.5 ? 'var(--blue-bright)' : 'var(--text-muted)';
  const luckLabel  = luckDelta >= 0 ? `+${luckDelta}G` : `${luckDelta}G`;

  // Real PDO = SH% + SV% (×100 each, summed)
  const shPct = carSOG > 0 ? parseFloat((goals / carSOG * 100).toFixed(1)) : 0;
  const ourGoalie = (goalieStats || []).find(g => g.team_id === teamId);
  const svPct = ourGoalie && (ourGoalie.saves + (ourGoalie.goals_against || 0)) > 0
    ? ourGoalie.saves / (ourGoalie.saves + (ourGoalie.goals_against || 0)) * 100
    : null;
  const pdo = svPct != null ? parseFloat((shPct + svPct).toFixed(1)) : null;
  const pdoColor = pdo != null
    ? pdo > 103 ? 'var(--amber)' : pdo < 97 ? 'var(--blue-bright)' : 'var(--text-muted)'
    : 'var(--text-muted)';

  const Row = ({ label, car, opp, help }) => {
    const cn = Number(car) || 0, on = Number(opp) || 0, tot = cn + on || 1;
    return (
      <div className={SV_ROW_CLASSES}>
        <div className={SV_LABEL_WRAP_CLASSES}>
          <span className={SV_LABEL_CLASSES}>{label}</span>
          <InfoTip text={help} position="above" />
        </div>
        <span className={svNumClasses()} style={{ color: color || 'var(--team-primary)' }}>{car ?? '—'}</span>
        <div className={SV_BAR_WRAP_CLASSES}>
          <div className={svFillClasses()} style={{ width: `${Math.round(cn / tot * 100)}%`, background: color || 'var(--team-primary)' }} />
          <div className={svFillClasses('muted')} style={{ width: `${Math.round(on / tot * 100)}%` }} />
        </div>
        <span className={svNumClasses('muted')}>{opp ?? '—'}</span>
      </div>
    );
  };

  const StatChip = ({ label, value, color, help }) => (
    <div className={ADV_CHIP_CLASSES} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <span className={ADV_CHIP_LABEL_CLASSES}>{label}</span>
        <InfoTip text={help} position="above" />
      </div>
      <span className={ADV_CHIP_VAL_CLASSES} style={{ color }}>{value}</span>
    </div>
  );

  return (
    <div className={SHOT_VOLUME_SECTION_CLASSES}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sec-label" style={{ marginBottom: 0 }}>Shot Attempts</div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>Corsi = all attempts · Fenwick excludes blocks</span>
      </div>

      <div className={SV_HEADER_CLASSES}>
        <span className={svTeamClasses()} style={{ color: color || 'var(--team-primary)' }}>{abbr}</span>
        <span className={SV_DIFF_CLASSES} style={{ color: cfPct != null && cfPct >= 50 ? 'var(--green)' : 'var(--red-bright)' }}>
          {cfPct != null ? `${cfPct >= 50 ? '+' : ''}${carCorsi - oppCorsi} CF` : ''}
        </span>
        <span className={svTeamClasses('muted')}>{oppAbbr || 'OPP'}</span>
      </div>

      <div className={SV_WRAP_CLASSES}>
        <Row label="Corsi (CF)"    car={carCorsi}   opp={oppCorsi}
          help="All shot attempts: goals + SOG + missed + blocked. Best possession proxy." />
        <Row label="Fenwick (FF)"  car={carFenwick} opp={oppFenwick}
          help="Shot attempts excluding blocked shots. More predictive than Corsi." />
        <Row label="Shots on Goal" car={carSOG}     opp={oppSOG}
          help="Shots that reached the goalie (goals + saves)." />
        <Row label="Blocked Shots" car={carBlocked} opp={oppBlocked}
          help="Attempts blocked by a skater before reaching the goalie." />
      </div>

      <div className={ADV_CHIPS_ROW_CLASSES}>
        <StatChip label="CF%"
          value={cfPct != null ? `${cfPct}%` : 'N/A'}
          color={cfPct != null && cfPct >= 50 ? 'var(--green)' : (color || 'var(--team-primary)')}
          help={`Corsi For %: ${abbr}'s share of all shot attempts. ≥50% = controlling play.`} />
        <StatChip label="FF%"
          value={ffPct != null ? `${ffPct}%` : 'N/A'}
          color={ffPct != null && ffPct >= 50 ? 'var(--green)' : (color || 'var(--team-primary)')}
          help={`Fenwick For %: ${abbr}'s share of unblocked attempts. Better predictor than Corsi.`} />
        <StatChip label="PDO"
          value={pdo != null ? pdo.toFixed(1) : `SH ${shPct}%`}
          color={pdoColor}
          help={pdo != null
            ? `PDO = SH% (${shPct}%) + SV% (${svPct?.toFixed(1)}%) = ${pdo}. Values >103 suggest luck; <97 suggest bad luck.`
            : "PDO = SH% + SV%. Goalie data not yet available for this game."} />
        <StatChip label="Luck"
          value={luckLabel}
          color={luckColor}
          help={`Goals (${goals}) vs expected goals from shot locations (xG ${xg}). Positive = scoring above expectation.`} />
      </div>
    </div>
  );
}

// ── Team Stats card ───────────────────────────────────────────

function TeamStatsCard({ pbpStats, shotStats, abbr, oppAbbr, color, oppColor, faceoffStats, teamId }) {
  const rows = [
    shotStats && {
      label: 'Shots on Goal', carN: shotStats.sog,    oppN: shotStats.oppSOG,
      help: 'Shots that reached the goalie (goals + saves).',
    },
    shotStats && {
      label: 'Blocked Shots', carN: shotStats.blocks, oppN: shotStats.oppBlocked,
      help: 'Attempts blocked by a skater before reaching the goalie.',
    },
    pbpStats && {
      label: 'Hits', carN: pbpStats.hits.car, oppN: pbpStats.hits.opp,
      help: 'Body checks delivered.',
    },
    pbpStats && {
      label: 'Penalties', carN: pbpStats.penalties.car, oppN: pbpStats.penalties.opp,
      help: 'Penalties taken — fewer is better.',
    },
    (() => {
      // faceoffStats has both teams' players — filter to ours via team_id
      // then fall back to PBP-derived (which now has away_team_id fixed in pipeline)
      let carPct = null, won = 0, lost = 0;
      const allFO = Object.values(faceoffStats || {});
      const ourFO = allFO.filter(p => p.team_id === teamId);
      if (ourFO.length > 0) {
        won  = ourFO.reduce((s, p) => s + p.wins,   0);
        lost = ourFO.reduce((s, p) => s + p.losses, 0);
        const total = won + lost;
        carPct = total > 0 ? (won / total * 100) : null;
      } else if (pbpStats?.faceoff.total > 0) {
        // Fallback: PBP-derived (accurate now that away_team_id is fixed in pipeline)
        carPct = pbpStats.faceoff.pct;
        won    = pbpStats.faceoff.won;
        lost   = pbpStats.faceoff.lost;
      }
      if (carPct == null) return null;
      return {
        label: 'Faceoff %',
        carN:  carPct,
        oppN:  100 - carPct,
        carDisplay: `${carPct.toFixed(1)}%`,
        oppDisplay: `${(100 - carPct).toFixed(1)}%`,
        help: `Faceoff win %. ${won}W – ${lost}L.`,
      };
    })(),
  ].filter(Boolean);

  if (!rows.length) return null;

  return (
    <div className="card">
      <div className="sec-label" style={{ marginBottom: 8 }}>Team stats — this game</div>
      <div className={GM_STAT_HEADER_CLASSES}>
        <span style={{ color: color || 'var(--team-primary)' }}>{abbr}</span>
        <span />
        <span style={{ color: oppColor || 'var(--text-muted)' }}>{oppAbbr || 'OPP'}</span>
      </div>
      {rows.map(({ label, carN, oppN, carDisplay, oppDisplay, help }) => {
        const cn  = Number(carN) || 0;
        const on  = Number(oppN) || 0;
        const tot = cn + on || 1;
        return (
          <div key={label} className={GM_STAT_ROW_CLASSES}>
            <span className={gmStatValClasses('team-primary')}>{carDisplay ?? cn}</span>
            <div className={GM_STAT_MID_CLASSES}>
              <div className={GM_STAT_LABEL_CLASSES}>
                {label}
                <InfoTip text={help} position="above" />
              </div>
              <div className={DUAL_BAR_CLASSES}>
                <div className={FILL_TEAM_PRIMARY_CLASSES} style={{ width: `${Math.round(cn / tot * 100)}%` }} />
                <div className={FILL_BLUE_CLASSES}         style={{ width: `${Math.round(on / tot * 100)}%` }} />
              </div>
            </div>
            <span className={gmStatValClasses('muted')}>{oppDisplay ?? on}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── PP Analysis Panel ────────────────────────────────────────
function PPAnalysisPanel({ drillStat, abbr, color }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { ppOpps, summary, ppUnit1, ppUnit2 } = drillStat; // eslint-disable-line no-unused-vars
  if (!ppOpps?.length) return <div className={DRILL_EMPTY_CLASSES}>No {abbr} power plays this game.</div>;
  const toggle    = idx => setOpenIdx(o => o === idx ? null : idx);
  const pctColor  = (g, o) => g/o >= 0.25 ? 'var(--green)' : g > 0 ? 'var(--text-muted)' : 'var(--red-bright)';
  const oIcon     = opp => opp.scored ? '⚡' : opp.sog >= 3 ? '🎯' : opp.shots === 0 ? '❌' : '🔲';
  const oLabel    = opp => opp.scored ? 'GOAL' : opp.sog >= 3 ? 'Shots' : opp.shots === 0 ? 'No shots' : 'No score';
  const oVariant  = opp => opp.scored ? 'goal' : opp.sog >= 3 ? 'shots' : 'none';
  return (
    <div className={PP_ANALYSIS_CLASSES}>
      <div className={PP_SUMMARY_ROW_CLASSES}>
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES} style={{ color: pctColor(summary.goals, summary.opps) }}>
            {summary.goals}/{summary.opps}
          </span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>PP Goals</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.opps > 0 ? `${Math.round(summary.goals/summary.opps*100)}%` : '—'}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>PP%</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.sog}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>SOG</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.xg}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>
            xG <InfoTip text="Expected goals on PP shots — estimated from shot distance and angle." position="above" />
          </span>
        </div>
      </div>
      <div className={PP_OPPS_LIST_CLASSES}>
        {ppOpps.map((opp, i) => (
          <div key={i} className={PP_OPP_ITEM_CLASSES}>
            <div className={PP_OPP_HEADER_CLASSES} onClick={() => toggle(i)}>
              <div className={PP_OPP_LEFT_CLASSES}>
                <span className={PP_OPP_NUM_CLASSES}>PP {i+1}</span>
                <span className={PP_OPP_TIME_CLASSES}>{opp.period} · {opp.startTime}</span>
                {opp.quickEntry && <span className={PP_ENTRY_BADGE_CLASSES}>⚡ Quick entry</span>}
              </div>
              <div className={PP_OPP_RIGHT_CLASSES}>
                <span className={ppOutcomeClasses(oVariant(opp))}>{oIcon(opp)} {oLabel(opp)}</span>
                <span className={PP_OPP_SOG_CLASSES}>{opp.sog} SOG</span>
                <span className={PP_OPP_CHEVRON_CLASSES}>{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>
            {openIdx === i && (
              <div className={PP_OPP_DETAIL_CLASSES}>
                {opp.goals.map((g, gi) => (
                  <div key={gi} className={PP_GOAL_ROW_CLASSES}>
                    <span className={PP_GOAL_ICON_CLASSES}>🚨</span>
                    <div>
                      <span className={PP_GOAL_SCORER_CLASSES}>{g.scorer}</span>
                      {g.shotType && <span className={PP_GOAL_SHOTTYPE_CLASSES}>{g.shotType}</span>}
                    </div>
                    <span className={PP_GOAL_TIME_CLASSES}>{g.time}</span>
                  </div>
                ))}
                <div className={PP_DETAIL_STATS_CLASSES}>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.sog}</span><span className={PP_DETAIL_LABEL_CLASSES}>SOG</span></div>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.shots}</span><span className={PP_DETAIL_LABEL_CLASSES}>SA</span></div>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.xg}</span><span className={PP_DETAIL_LABEL_CLASSES}>xG</span></div>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.duration}s</span><span className={PP_DETAIL_LABEL_CLASSES}>Duration</span></div>
                </div>
                {opp.shotEvents.length > 0 && (
                  <div className={PP_MINI_RINK_CLASSES}>
                    <div className={PP_MINI_RINK_LABEL_CLASSES}>Shot locations</div>
                    <HockeyRink events={toHockeyRinkEvents(opp.shotEvents)} readOnly teamAbbr={abbr} teamColor={color} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PK Analysis Panel ─────────────────────────────────────────
function PKAnalysisPanel({ drillStat, abbr, color }) {
  const [openIdx, setOpenIdx] = useState(null);
  const { pkOpps, summary, pkUnit1, pkUnit2 } = drillStat; // eslint-disable-line no-unused-vars
  if (!pkOpps?.length) return <div className={DRILL_EMPTY_CLASSES}>No {abbr} penalty kills this game.</div>;
  const toggle   = idx => setOpenIdx(o => o === idx ? null : idx);
  const pctColor = (ga, o) => ga === 0 ? 'var(--green)' : ga/o <= 0.25 ? 'var(--text-muted)' : 'var(--red-bright)';
  const oIcon    = opp => opp.allowed ? '🚨' : opp.sog >= 4 ? '🛡️' : '✅';
  const oLabel   = opp => opp.allowed ? 'Goal' : opp.sog >= 4 ? 'Held' : 'Killed';
  const oVariant = opp => opp.allowed ? 'none' : opp.sog >= 4 ? 'shots' : 'goal';
  const survived = summary.opps - summary.goalsAgainst;
  return (
    <div className={PP_ANALYSIS_CLASSES}>
      <div className={PP_SUMMARY_ROW_CLASSES}>
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES} style={{ color: pctColor(summary.goalsAgainst, summary.opps) }}>
            {survived}/{summary.opps}
          </span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>PK Kills</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.opps > 0 ? `${Math.round(survived/summary.opps*100)}%` : '—'}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>PK%</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.sogAgainst}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>SOG vs</span>
        </div>
        <div className={PP_SUMMARY_DIVIDER_CLASSES} />
        <div className={PP_SUMMARY_STAT_CLASSES}>
          <span className={PP_SUMMARY_VAL_CLASSES}>{summary.xgAgainst}</span>
          <span className={PP_SUMMARY_LABEL_CLASSES}>
            xGA <InfoTip text="Expected goals against on PK — from shot locations. Lower is better." position="above" />
          </span>
        </div>
      </div>
      <div className={PP_OPPS_LIST_CLASSES}>
        {pkOpps.map((opp, i) => (
          <div key={i} className={PP_OPP_ITEM_CLASSES}>
            <div className={PP_OPP_HEADER_CLASSES} onClick={() => toggle(i)}>
              <div className={PP_OPP_LEFT_CLASSES}>
                <span className={PP_OPP_NUM_CLASSES}>PK {i+1}</span>
                <span className={PP_OPP_TIME_CLASSES}>{opp.period} · {opp.startTime}</span>
              </div>
              <div className={PP_OPP_RIGHT_CLASSES}>
                <span className={ppOutcomeClasses(oVariant(opp))}>{oIcon(opp)} {oLabel(opp)}</span>
                <span className={PP_OPP_SOG_CLASSES}>{opp.sog} SOG vs</span>
                <span className={PP_OPP_CHEVRON_CLASSES}>{openIdx === i ? '▲' : '▼'}</span>
              </div>
            </div>
            {openIdx === i && (
              <div className={PP_OPP_DETAIL_CLASSES}>
                {opp.goalDetails.map((g, gi) => (
                  <div key={gi} className={PP_GOAL_ROW_CLASSES}>
                    <span className={PP_GOAL_ICON_CLASSES}>🚨</span>
                    <div><span className={PP_GOAL_SCORER_CLASSES}>{g.scorer}</span></div>
                    <span className={PP_GOAL_TIME_CLASSES}>{g.time}</span>
                  </div>
                ))}
                <div className={PP_DETAIL_STATS_CLASSES}>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.sog}</span><span className={PP_DETAIL_LABEL_CLASSES}>SOG vs</span></div>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.shots}</span><span className={PP_DETAIL_LABEL_CLASSES}>SA</span></div>
                  <div className={PP_DETAIL_STAT_CLASSES}><span className={PP_DETAIL_VAL_CLASSES}>{opp.xgAgainst}</span><span className={PP_DETAIL_LABEL_CLASSES}>xGA</span></div>
                </div>
                {opp.shotEvents.length > 0 && (
                  <div className={PP_MINI_RINK_CLASSES}>
                    <div className={PP_MINI_RINK_LABEL_CLASSES}>OPP shot locations</div>
                    <HockeyRink events={toHockeyRinkEvents(opp.shotEvents)} readOnly flipPerspective teamAbbr={abbr} teamColor={color} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Goalie Card ───────────────────────────────────────────────
function GoalieCard({ goalies, teamId, abbr, oppAbbr, color, oppColor }) {
  const our = goalies.filter(g => g.team_id === teamId);
  const opp = goalies.filter(g => g.team_id !== teamId);

  const GoalieRow2 = ({ g, teamAbbr, col }) => {
    const sv   = g.saves;
    const sa   = g.shots_against || (sv + (g.goals_against || 0));
    const svPct = sa > 0 ? (sv / sa).toFixed(3).replace('0.', '.') : '—';
    const gaa  = g.toi ? parseFloat(((g.goals_against || 0) / (parseFloat(g.toi) || 1) * 60).toFixed(2)) : null;
    return (
      <div className={GOALIE_CARD_CLASSES}>
        <div className={GOALIE_HEADER_CLASSES}>
          <span className={GOALIE_ABBR_CLASSES} style={{ color: col }}>{teamAbbr}</span>
          <span className={GOALIE_NAME_CLASSES}>{g.name}</span>
        </div>
        <div className={GOALIE_STATS_GRID_CLASSES}>
          <div className={GOALIE_STAT_COL_CLASSES}>
            <span className={GOALIE_STAT_LABEL_CLASSES}>SV/SA</span>
            <span className={goalieStatValClasses(false)}>{sv ?? '—'}/{sa ?? '—'}</span>
          </div>
          <div className={GOALIE_STAT_COL_CLASSES}>
            <span className={GOALIE_STAT_LABEL_CLASSES}>SV%</span>
            <span className={goalieStatValClasses(true)}>{svPct}</span>
          </div>
          {gaa != null && (
            <div className={GOALIE_STAT_COL_CLASSES}>
              <span className={GOALIE_STAT_LABEL_CLASSES}>GAA</span>
              <span className={goalieStatValClasses(false)}>{gaa}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="sec-label">Goalies</div>
      {our.map((g, i) => <GoalieRow2 key={i} g={g} teamAbbr={abbr} col={color} />)}
      {opp.map((g, i) => <GoalieRow2 key={i} g={g} teamAbbr={oppAbbr || 'OPP'} col={oppColor} />)}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────

export default function PWHLShotMapView() {
  const team   = PWHL_TEAM_CONFIG;
  const teamId = PWHL_TEAM_ID ? parseInt(PWHL_TEAM_ID, 10) : null;
  const abbr   = team?.abbr || null;
  const color  = team?.displayColor || 'var(--text-dim)';

  const location = useLocation();
  const [season,         setSeason]   = useState(PWHL_CURRENT_SEASON);
  const [selectedGameId, setSelected] = useState(location.state?.selectedGameId ?? null);
  const [drillStat,      setDrill]    = useState(null);
  const [viewingSummaryPeriod, setViewingSummaryPeriod] = useState(null);

  // useState's initial value only runs once, at first mount -- if this
  // component mounts before pwhlConfig.js's async live-season fetch
  // resolves, `season` would otherwise lock onto the fallback value
  // forever, even though PWHL_CURRENT_SEASON itself goes on to update
  // correctly. Same fix as PWHLPlayersView.jsx: catch up via the event
  // pwhlConfig.js dispatches on resolution, but only if the user hasn't
  // manually picked a season themselves.
  const userPickedSeason = useRef(false);
  useEffect(() => {
    function handleSeasonUpdate(e) {
      if (!userPickedSeason.current) setSeason(e.detail);
    }
    window.addEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
    return () => window.removeEventListener('eyewall:pwhl-season-updated', handleSeasonUpdate);
  }, []);

  // ── Dev replay injection ──────────────────────────────────────
  const devGame = usePWHLDevGame();

  // ── Live game detection ───────────────────────────────────────
  // Detect dev route — suppress /pwhl/today polling entirely on /pwhl/dev
  const isDevRoute = location.pathname === '/pwhl/dev';

  // Poll /pwhl/today every 60s to detect live games for the current team.
  // Skip entirely in dev route or when dev game is injected.
  const isLiveRef = useRef(false);
  const liveInterval = useMemo(() => isLiveRef.current ? 30_000 : 60_000, []);

  const { data: todayGames } = usePoll(
    () => (isDevRoute || devGame) ? Promise.resolve(null) : fetchPWHLToday(season),
    liveInterval,
    [season, !!devGame, isDevRoute]
  );

  // Find a live or pre-game game involving our team today
  const liveGame = useMemo(() => {
    if (devGame) return devGame.liveGame;
    if (!todayGames?.length || !teamId) return null;
    return todayGames.find(g =>
      (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
      (g.status === 'live' || g.status === 'pre')
    ) || null;
  }, [todayGames, teamId, devGame]);

  // Normalized shape for the shared LiveGameChip (Session 77).
  const liveGameChipData = useMemo(() => {
    if (!liveGame) return null;
    const isHome = liveGame.homeTeamId === teamId;
    return {
      opponentAbbr:  isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode,
      opponentColor: PWHL_TEAM_MAP[isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode]?.displayColor,
      myScore:  isHome ? liveGame.homeScore : liveGame.awayScore,
      oppScore: isHome ? liveGame.awayScore : liveGame.homeScore,
    };
  }, [liveGame, teamId]);

  const isLive = devGame ? devGame.liveGame?.status === 'live' : liveGame?.status === 'live';

  // Keep ref in sync for interval calculation
  useEffect(() => { isLiveRef.current = isLive; }, [isLive]);

  // Auto-select live game when it starts — don't override a manual selection
  // Skip in dev mode (dev replay controls the selection)
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (devGame) return;
    if (isLive && liveGame && !autoSelectedRef.current) {
      setSelected(liveGame.gameId);
      autoSelectedRef.current = true;
    }
    if (!isLive) autoSelectedRef.current = false;
  }, [isLive, liveGame, devGame]);

  // Poll live PBP every 30s when a live game is selected.
  // In dev mode, liveData comes from the injected context instead.
  const { data: liveDataReal } = usePoll(
    () => isLive && !devGame && selectedGameId === liveGame?.gameId
      ? fetchPWHLLive(selectedGameId)
      : Promise.resolve(null),
    30_000,
    [isLive, selectedGameId, liveGame?.gameId, !!devGame]
  );

  const liveData = devGame ? devGame.liveData : liveDataReal;

  // ── Derive situation from live events ─────────────────────────
  // Track goalie pull and PP from the most recent penalty/goalie_change events
  const liveSituation = useMemo(() => {
    if (!liveData?.events?.length) return null;
    const events  = liveData.events;
    // Goalie pull: find latest goalie_change with goalieIn = null for either team
    const goaliePulled = events.filter(e => e.eventType === 'goalie_change' && e.goalieIn === null);
    const latestPull   = goaliePulled[goaliePulled.length - 1] || null;
    // Goalie returned: last goalie_change with goalieOut = null
    const goalieReturn = events.filter(e => e.eventType === 'goalie_change' && e.goalieOut === null);
    const latestReturn = goalieReturn[goalieReturn.length - 1] || null;
    const pulledTeamId = latestPull && (!latestReturn || latestPull.timeSeconds > latestReturn.timeSeconds)
      ? latestPull.teamId : null;

    // Active penalties: penalties in last 2 minutes of game time
    const lastEvent    = events[events.length - 1];
    const nowSecs      = (lastEvent?.period - 1) * 1200 + lastEvent?.timeSeconds || 0;
    const pens         = events.filter(e => e.eventType === 'penalty' && e.isPowerPlay);
    const activePens   = pens.filter(p => {
      const penSecs = (p.period - 1) * 1200 + p.timeSeconds;
      return nowSecs - penSecs < 120;
    });
    const ourPP  = activePens.some(p => p.teamId !== teamId && p.teamId != null);
    const oppPP  = activePens.some(p => p.teamId === teamId);
    const ourEN  = pulledTeamId === teamId;
    const oppEN  = pulledTeamId !== null && pulledTeamId !== teamId;

    return { ourPP, oppPP, ourEN, oppEN };
  }, [liveData, teamId]);

  // Current period + clock from last live event (or dev override)
  const liveClock = useMemo(() => {
    if (devGame?.liveGame?._period) {
      return { period: devGame.liveGame._period, time: devGame.liveGame._time };
    }
    if (!liveData?.events?.length) return null;
    const last = liveData.events[liveData.events.length - 1];
    return { period: last.period, time: last.time };
  }, [liveData, devGame]);

  // ── Schedule / selected game / playoff detection ──────────────
  // Moved up from below the shot/roster fetches (where this used to live)
  // so isPlayoff is available before usePWHLGameEvents/usePWHLPeriodSummary
  // are called, a few lines down — both need it to label OT/SO correctly.
  const { data: schedule = null } = useFetch(
    () => teamId ? fetchPWHLSchedule(teamId, season) : Promise.resolve(null), [teamId, season]);

  // Completed games only, for chips
  const games = useMemo(() => {
    if (!schedule?.length) return [];
    return [...schedule].filter(g => g.game_state === 'Final').sort((a,b) => b.game_id - a.game_id);
  }, [schedule]);

  // Normalized shape for the shared GameChipsRow (Session 77) — raw PWHL
  // schedule rows use home_team_id/away_team_id/home_score/away_score;
  // GameChipsRow doesn't know about any sport's raw field names.
  const gameChipGames = useMemo(() => games.map(g => {
    const isHome  = g.home_team_id === teamId;
    const oppId   = isHome ? g.away_team_id : g.home_team_id;
    const oppAbbr = getPWHLTeamById(oppId)?.abbr || String(oppId);
    return {
      id: g.game_id,
      opponentAbbr: oppAbbr,
      opponentColor: PWHL_TEAM_MAP[oppAbbr]?.displayColor,
      myScore:  isHome ? g.home_score : g.away_score,
      oppScore: isHome ? g.away_score : g.home_score,
      isHome,
    };
  }), [games, teamId]);

  const selectedGame = useMemo(() => games.find(g => g.game_id === selectedGameId) || null, [games, selectedGameId]);
  const displayGame  = selectedGame || games[0] || null;

  // Is the selected/displayed game a playoffs game? PWHL regular-season
  // games can end in a shootout; playoff games never do (extra full OT
  // periods instead) — this decides period-label branching (OT vs SO) for
  // period 5+. Derived from the game's own season_id via the shared
  // regular<->playoff season_id map in pwhlConfig.js — no new Worker call
  // needed, season_id was already present in schedule data, just unused.
  const isPlayoff = isPWHLPlayoffSeason(displayGame?.season_id);

  // Period label helper — regular season period 5 is a shootout ('SO'),
  // playoffs never have one (full OT periods instead). Closure over
  // isPlayoff rather than a module-level function since it's called from
  // ~10 places throughout this component.
  const pLabel = useCallback((n) => {
    if (!n) return '—';
    if (n <= 3) return `P${n}`;
    if (n === 4) return 'OT';
    if (isPlayoff) return `OT${n - 3}`;
    return n === 5 ? 'SO' : `OT${n - 3}`;
  }, [isPlayoff]);

  // ── Game event popups ─────────────────────────────────────────
  // Pass raw liveData (not normalized) so the hook can read camelCase event fields
  const {
    goalPopup,     clearGoalPopup,
    hatTrickPopup, clearHatTrickPopup,
    penaltyPopup,  clearPenaltyPopup,
    winPopup,      clearWinPopup,
    puckDropPopup, clearPuckDropPopup,
  } = usePWHLGameEvents(
    isLive ? liveData : null,
    isLive,
    teamId,
    team?.abbr || '',
    isPlayoff
  );

  // Clear popups on game change
  const clearGoalRef    = useRef(null);
  const clearPenaltyRef = useRef(null);
  const clearWinRef     = useRef(null);
  const clearPuckRef    = useRef(null);
  useEffect(() => { clearGoalRef.current    = clearGoalPopup;    }, [clearGoalPopup]);
  useEffect(() => { clearPenaltyRef.current = clearPenaltyPopup; }, [clearPenaltyPopup]);
  useEffect(() => { clearWinRef.current     = clearWinPopup;     }, [clearWinPopup]);
  useEffect(() => { clearPuckRef.current    = clearPuckDropPopup; }, [clearPuckDropPopup]);

  useEffect(() => {
    clearGoalRef.current?.();
    clearPenaltyRef.current?.();
    clearWinRef.current?.();
    clearPuckRef.current?.();
  }, [selectedGameId]);

  // ── Debug panel (5 taps on score card, dev only) ──────────────
  const [debugOpen,         setDebugOpen]         = useState(false);
  const [debugTaps,         setDebugTaps]         = useState(0);
  const debugTapRef         = useRef(null);
  const [debugGoalPopup,    setDebugGoalPopup]    = useState(null);
  const [debugHatTrickPopup, setDebugHatTrickPopup] = useState(null);
  const [debugPenaltyPopup, setDebugPenaltyPopup] = useState(null);
  const [debugWinPopup,     setDebugWinPopup]     = useState(null);
  const [debugPuckPopup,    setDebugPuckPopup]    = useState(null);
  const [debugSituation,    setDebugSituation]    = useState(null);

  const handleDebugTap = () => {
    if (!import.meta.env.DEV) return;
    const next = debugTaps + 1;
    setDebugTaps(next);
    clearTimeout(debugTapRef.current);
    if (next >= 5) { setDebugOpen(o => !o); setDebugTaps(0); return; }
    debugTapRef.current = setTimeout(() => setDebugTaps(0), 2000);
  };

  const { data: rawShots  = null } = useFetch(
    () => teamId ? fetchPWHLShots(teamId, season)   : Promise.resolve(null), [teamId, season]);
  const { data: roster    = null } = useFetch(
    () => teamId ? fetchPWHLRoster(teamId)           : Promise.resolve(null), [teamId]);
  // "All N" (no live game, no selectedGameId) — season-aggregate SOG/
  // blocks/hits/penalties/faceoffs + PP%/PK% for the summary cards, since
  // per-game pbpStats (below) never populates without a selected game.
  const isAllN = !isLive && !selectedGameId;
  const { data: seasonSummary = null } = useFetch(
    () => isAllN && teamId ? fetchPWHLTeamSeasonSummary(teamId, season) : Promise.resolve(null),
    [isAllN, teamId, season]);
  const { data: pbpData   = null } = useFetch(
    () => selectedGameId && !isLive ? fetchPWHLPBP(selectedGameId) : Promise.resolve(null),
    [selectedGameId, isLive]);

  // Live data takes precedence over stored PBP when a live game is selected
  const activePbpData = isLive && liveData ? liveData : pbpData;

  // ── Period / game summaries ───────────────────────────────────
  const { summaries: periodSummaries, newSummary, dismissNewSummary, updateSummaryNarrative } =
    usePWHLPeriodSummary({
      liveData: isLive ? liveData : null,
      pbpData:  !isLive ? pbpData : null,
      isLive,
      gameId:   selectedGameId,
      teamId,
      isPlayoff,
    });

  const { gameSummary, updateGameNarrative } = usePWHLGameSummary({
    liveData: isLive ? liveData : null,
    pbpData:  !isLive ? pbpData : null,
    isLive,
    gameId:   selectedGameId,
    teamId,
  });

  // Derive live summary so narrative updates reflect immediately
  const viewingSummary = viewingSummaryPeriod === null ? null
    : viewingSummaryPeriod === 'game' ? gameSummary
    : periodSummaries.find(s => s.period === viewingSummaryPeriod) || null;

  // Sync summaries to PeriodSummaryContext (shared with NHL bell)
  const { setSummaries: setCtxSummaries, registerOpenHandler } = usePeriodSummaryContext();
  useEffect(() => {
    const all = gameSummary ? [gameSummary, ...periodSummaries] : periodSummaries;
    setCtxSummaries(all);
  }, [periodSummaries, gameSummary, setCtxSummaries]);
  useEffect(() => {
    registerOpenHandler((s) => setViewingSummaryPeriod(s.isGameSummary ? 'game' : s.period));
    return () => registerOpenHandler(null);
  }, [registerOpenHandler]);

  // Auto-open game summary when live game goes final
  const wasLiveRef = useRef(false);
  useEffect(() => { if (isLive) wasLiveRef.current = true; }, [isLive]);
  useEffect(() => {
    if (!wasLiveRef.current) return;
    if (!isLive && liveData?.gameStatus === 'final' && gameSummary && viewingSummaryPeriod === null) {
      setViewingSummaryPeriod('game');
    }
  }, [isLive, liveData?.gameStatus, gameSummary, viewingSummaryPeriod]);

  // Auto-show new period summary when it fires during a live game
  useEffect(() => {
    if (newSummary) setViewingSummaryPeriod(newSummary.isGameSummary ? 'game' : newSummary.period);
  }, [newSummary]);

  // Normalize live events to snake_case shape used by pbpByType and pbpStats
  // Live: { eventType, teamId, isPowerPlay, ... }
  // Stored: { event_type, team_id, is_power_play, ... }
  const normalizeLiveEvents = useCallback((events, homeTeamId, awayTeamId) => {
    if (!events?.length) return [];
    return events.map(e => {
      const type = e.eventType;

      // ── player_name: varies by event type ───────────────────
      let playerId   = null;
      let playerName = null;
      let secPlayerId   = null;
      let secPlayerName = null;

      if (type === 'hit') {
        // hit: { player (hitter), onPlayer (hittee) }
        playerId   = e.player?.id ?? null;
        playerName = e.player ? `${e.player.firstName} ${e.player.lastName}`.trim() : null;
        secPlayerId   = e.onPlayer?.id ?? null;
        secPlayerName = e.onPlayer ? `${e.onPlayer.firstName} ${e.onPlayer.lastName}`.trim() : null;
      } else if (type === 'penalty') {
        // penalty: { takenBy, servedBy }
        playerId   = e.takenBy?.id ?? null;
        playerName = e.takenBy ? `${e.takenBy.firstName} ${e.takenBy.lastName}`.trim() : null;
      } else if (type === 'faceoff') {
        // faceoff: { homePlayer, visitingPlayer, homeWin }
        // team_id = winner's team ID
        const winnerIsHome = e.homeWin;
        const winner  = winnerIsHome ? e.homePlayer    : e.visitingPlayer;
        const loser   = winnerIsHome ? e.visitingPlayer : e.homePlayer;
        playerId      = winner?.id ?? null;
        playerName    = winner ? `${winner.firstName} ${winner.lastName}`.trim() : null;
        secPlayerId   = loser?.id ?? null;
        secPlayerName = loser  ? `${loser.firstName} ${loser.lastName}`.trim()  : null;
      } else if (type === 'goal') {
        playerId   = e.scoredBy?.id ?? null;
        playerName = e.scoredBy ? `${e.scoredBy.firstName} ${e.scoredBy.lastName}`.trim() : null;
      } else if (type === 'shot' || type === 'blocked_shot') {
        playerId   = e.shooter?.id ?? null;
        playerName = e.shooter ? `${e.shooter.firstName} ${e.shooter.lastName}`.trim() : null;
      }

      // ── team_id: faceoffs derive from homeWin + team IDs ──
      let resolvedTeamId = e.teamId ?? null;
      if (type === 'faceoff' && homeTeamId != null) {
        resolvedTeamId = e.homeWin ? homeTeamId : (awayTeamId ?? null);
      }

      return {
        ...e,
        event_type:           type,
        team_id:              resolvedTeamId,
        is_power_play:        e.isPowerPlay   ?? false,
        player_id:            playerId,
        player_name:          playerName,
        secondary_player_id:  secPlayerId,
        secondary_player_name: secPlayerName,
        period_id:            e.period,
        time_seconds:         e.timeSeconds,
        description: e.description ? e.description.replace(/^(?:Ob|Maj|Min|Mis|Gm)-/i, '').replace(/-/g, ' ').trim() : null,
        penalty_minutes:      e.minutes       ?? null,
      };
    });
  }, []);

  // Destructure PBP payload — live and stored shapes are compatible after normalization
  const pbpEvents    = isLive
    ? normalizeLiveEvents(liveData?.events, liveData?.homeTeamId, liveData?.awayTeamId)
    : (activePbpData?.events ?? null);
  const oppShotRows  = activePbpData?.oppShots    ?? [];
  const pbpHomeId    = activePbpData?.homeTeamId  ?? liveData?.homeTeamId ?? null;
  const pbpAwayId    = activePbpData?.awayTeamId  ?? liveData?.awayTeamId ?? null;
  const faceoffStats = activePbpData?.faceoffStats ?? {};
  const goalieStats  = isLive
    ? (liveData?.goalieStats ?? [])
    : (activePbpData?.goalieStats ?? []);

  // In dev mode, auto-select the injected game ID
  useEffect(() => {
    if (devGame?.liveGame?.gameId && selectedGameId !== devGame.liveGame.gameId) {
      setSelected(devGame.liveGame.gameId);
    }
  }, [devGame?.liveGame?.gameId]);
  const liveShotEvents = useMemo(() => {
    if (!isLive || !liveData?.events?.length || !teamId) return [];
    const homeId = liveData.homeTeamId;
    return liveData.events
      .filter(e => e.eventType === 'shot' || e.eventType === 'blocked_shot' || e.eventType === 'goal')
      .map(ev => {
        const isOurTeam = ev.teamId === teamId;
        // For home team perspective: home attacks right in odd periods
        // adaptLiveShot receives isOurTeam relative to home perspective
        const isHome = teamId === homeId;
        return adaptLiveShot(ev, isHome ? isOurTeam : !isOurTeam);
      })
      .filter(Boolean);
  }, [isLive, liveData, teamId]);

  // Our shots from live feed
  const liveOurShots = useMemo(
    () => liveShotEvents.filter(e => e.isCanes),
    [liveShotEvents]
  );

  // Opp shots from live feed
  const liveOppShots = useMemo(
    () => liveShotEvents.filter(e => !e.isCanes),
    [liveShotEvents]
  );
  const handleSeasonChange = id => { userPickedSeason.current = true; setSeason(id); setSelected(null); setDrill(null); };
  const handleSelect       = id => { setSelected(p => p === id ? null : id); setDrill(null); };
  const handleAll          = ()  => { setSelected(null); setDrill(null); };

  // Reg/Playoffs toggle (Session 77) — PWHL models playoffs as a distinct
  // season_id, so toggling just swaps which paired id gets fetched via the
  // existing handleSeasonChange (no separate season-type state needed).
  // The year chip row always shows/selects the REGULAR id (that's the
  // "which year" identity); `selectedYear` maps a playoffs selection back
  // to its regular id purely for highlighting the right chip.
  const seasonType   = isPWHLPlayoffSeason(season) ? 'playoffs' : 'regular';
  const selectedYear = seasonType === 'playoffs' ? PWHL_REGULAR_SEASON_MAP[season] : season;
  const handleSeasonTypeChange = type => {
    if (type === seasonType) return;
    const nextSeason = type === 'playoffs' ? PWHL_PLAYOFF_SEASON_MAP[season] : PWHL_REGULAR_SEASON_MAP[season];
    if (nextSeason != null) handleSeasonChange(nextSeason);
  };
  // Picking a year chip preserves whichever seasonType is currently active
  // (e.g. picking "2024-25" while viewing Playoffs jumps straight to that
  // year's playoffs, not back to its regular season).
  const handleYearSelect = regId => {
    handleSeasonChange(seasonType === 'playoffs' ? (PWHL_PLAYOFF_SEASON_MAP[regId] ?? regId) : regId);
  };

  // Roster name map (our team only — used for our shots)
  const playerMap = useMemo(() => {
    if (!roster?.length) return {};
    return Object.fromEntries(roster.map(p => [p.player_id, `${p.first_name} ${p.last_name}`.trim()]));
  }, [roster]);

  // Our team's shot events (adapted for IceRink)
  const allOurShots = useMemo(() => {
    if (!rawShots?.length) return [];
    return rawShots.filter(r => r.x_norm != null && r.y_norm != null)
                   .map(r => adaptOurShot(r, playerMap));
  }, [rawShots, playerMap]);

  const ourShotEvents = useMemo(() => {
    if (isLive && selectedGameId === liveGame?.gameId) return liveOurShots;
    return selectedGameId ? allOurShots.filter(e => e.gameId === selectedGameId) : allOurShots;
  }, [allOurShots, selectedGameId, isLive, liveGame, liveOurShots]);

  // Opponent shot events for the selected game (adapted for IceRink, isCanes=false)
  const oppShotEvents = useMemo(() => {
    if (isLive && selectedGameId === liveGame?.gameId) return liveOppShots;
    if (!selectedGameId || !oppShotRows.length) return [];
    // Identify our team's shooter_ids so we can exclude them
    const ourIds = new Set((rawShots || []).filter(r => r.game_id === selectedGameId).map(r => r.shooter_id).filter(Boolean));
    return oppShotRows
      .filter(r => r.x_norm != null && r.y_norm != null && !ourIds.has(r.shooter_id))
      .map(adaptOppShot);
  }, [selectedGameId, oppShotRows, rawShots, isLive, liveGame, liveOppShots]);

  // Combined for IceRink (our shots + opp shots in game view)
  const rinkEvents = useMemo(
    () => selectedGameId ? [...ourShotEvents, ...oppShotEvents] : ourShotEvents,
    [ourShotEvents, oppShotEvents, selectedGameId]
  );

  const scoreBarData = useMemo(() => {
    // Live game score from live feed
    if (isLive && liveGame && selectedGameId === liveGame.gameId) {
      const isHome  = liveGame.homeTeamId === teamId;
      const myScore = isHome ? liveGame.homeScore : liveGame.awayScore;
      const opScore = isHome ? liveGame.awayScore : liveGame.homeScore;
      const oppCode = isHome ? liveGame.awayTeamCode : liveGame.homeTeamCode;
      return {
        isHome, myScore, oppScore: opScore, oppAbbr: oppCode, won: myScore > opScore,
        ot: false, shootout: false,
        homeTeamId: liveGame.homeTeamId, awayTeamId: liveGame.awayTeamId,
      };
    }
    // Completed game from schedule
    if (!displayGame || !teamId) return null;
    const isHome   = displayGame.home_team_id === teamId;
    const myScore  = isHome ? displayGame.home_score : displayGame.away_score;
    const oppScore = isHome ? displayGame.away_score : displayGame.home_score;
    const oppId    = isHome ? displayGame.away_team_id : displayGame.home_team_id;
    const oppAbbr  = getPWHLTeamById(oppId)?.abbr || String(oppId);
    return {
      isHome, myScore, oppScore, oppAbbr, won: myScore > oppScore,
      ot: displayGame.ot, shootout: displayGame.shootout,
      homeTeamId: displayGame.home_team_id, awayTeamId: displayGame.away_team_id,
    };
  }, [displayGame, teamId, isLive, liveGame, selectedGameId]);

  // ── Shot stats ────────────────────────────────────────────────

  const shotStats = useMemo(() => {
    if (!ourShotEvents.length) return null;
    const sog     = ourShotEvents.filter(e => e.type === 'shot-on-goal').length;
    const blocks  = ourShotEvents.filter(e => e.type === 'blocked-shot').length;
    const goals   = ourShotEvents.filter(e => e.type === 'goal').length;
    const oppSOG     = oppShotEvents.filter(e => e.type === 'shot-on-goal').length;
    const oppBlocked = oppShotEvents.filter(e => e.type === 'blocked-shot').length;
    return { sog, blocks, goals, total: sog + blocks + goals, oppSOG, oppBlocked };
  }, [ourShotEvents, oppShotEvents]);

  // Danger counts (our shots only)
  const dangerCounts = useMemo(() => {
    const shots = ourShotEvents.filter(e => e.isCanes);
    const hi  = shots.filter(e => distFromGoal(e.x, e.y) < 15);
    const mid = shots.filter(e => { const d = distFromGoal(e.x, e.y); return d >= 15 && d < 30; });
    const lo  = shots.filter(e => distFromGoal(e.x, e.y) >= 30);
    return { hi, mid, lo, hiN: hi.length, midN: mid.length, loN: lo.length, total: shots.length };
  }, [ourShotEvents]);

  // ── PBP stats ─────────────────────────────────────────────────

  const pbpStats = useMemo(() => {
    if (!pbpEvents?.length || !selectedGameId || !teamId || !scoreBarData) return null;
    const hits      = pbpByType(pbpEvents, 'hit');
    const penalties = pbpByType(pbpEvents, 'penalty');
    const faceoffs  = pbpByType(pbpEvents, 'faceoff');

    const carHits = hits.filter(e => e.team_id === teamId).length;
    const oppHits = hits.filter(e => e.team_id !== teamId && e.team_id != null).length;

    const carPens = penalties.filter(e => e.team_id === teamId);
    const oppPens = penalties.filter(e => e.team_id !== teamId && e.team_id != null);

    // Faceoffs: team_id = winner's team (resolved by Worker via roster)
    const oppTeamId = (scoreBarData.isHome ? pbpAwayId : pbpHomeId)
                   || (scoreBarData.isHome ? scoreBarData.awayTeamId : scoreBarData.homeTeamId);
    const carFOW  = faceoffs.filter(e => e.team_id === teamId).length;
    const carFOL  = faceoffs.filter(e => e.team_id === oppTeamId).length;
    const totalFO = carFOW + carFOL;
    const foPct   = totalFO > 0 ? (carFOW / totalFO * 100) : null;

    const ppOpps = oppPens.filter(e => e.is_power_play).length;
    const pkOpps = carPens.filter(e => e.is_power_play).length;

    return {
      hits:      { car: carHits, opp: oppHits },
      penalties: { car: carPens.length, opp: oppPens.length, carRows: carPens, oppRows: oppPens },
      faceoff:   { pct: foPct, won: carFOW, lost: carFOL, total: totalFO },
      pp:        { opps: ppOpps, pkOpps },
    };
  }, [pbpEvents, selectedGameId, teamId, scoreBarData, pbpHomeId, pbpAwayId]);

  // ── Top scorers (our shots only) ─────────────────────────────

  const topScorers = useMemo(() => {
    if (!selectedGameId || !ourShotEvents.length) return [];
    const by = {};
    ourShotEvents.filter(e => e.type === 'goal' && e.shooterName).forEach(e => {
      if (!by[e.shooterName]) by[e.shooterName] = { goals: 0, assists: 0 };
      by[e.shooterName].goals++;
    });
    return Object.entries(by)
      .sort((a,b) => b[1].goals - a[1].goals)
      .map(([name, s]) => ({ name, ...s, points: s.goals + s.assists }));
  }, [ourShotEvents, selectedGameId]);

  // ── Drill-down builder ────────────────────────────────────────

  const buildDrillDown = useCallback((statKey) => {
    const buildRows = (events, getName, getPeriod) => {
      const by = {};
      events.forEach(e => {
        const name = getName(e) || '—';
        const per  = getPeriod ? getPeriod(e) : pLabel(e.period_id);
        if (!by[name]) by[name] = { name, periods: {}, total: 0 };
        by[name].periods[per] = (by[name].periods[per] || 0) + 1;
        by[name].total++;
      });
      return Object.values(by).sort((a,b) => b.total - a.total);
    };

    // Identify our shooter IDs for this game (to split opp_shots)
    const ourShooterIds = new Set(
      (rawShots || []).filter(r => r.game_id === selectedGameId).map(r => r.shooter_id).filter(Boolean)
    );
    // In live mode oppShotRows is empty — use adapted liveOppShots instead
    const oppOnlyShots = (isLive && !oppShotRows.length)
      ? liveOppShots.map(s => ({
          shooter_id:   null,
          shooter_name: s.shooterName || null,
          event_type:   s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
          period_id:    s.period,
          time_seconds: s.timeInPeriod
            ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
            : 0,
          x_norm: s.x, y_norm: s.y,
        }))
      : oppShotRows.filter(r => !ourShooterIds.has(r.shooter_id));

    if (statKey === 'sog') {
      const carSOGEvts = ourShotEvents.filter(e => e.type === 'shot-on-goal' || e.type === 'goal');
      const oppSOGRows = oppOnlyShots.filter(r => r.event_type === 'shot' || r.event_type === 'goal');
      setDrill({
        label:   'Shots on Goal', type: 'shots',
        carRows: buildRows(carSOGEvts, e => e.shooterName, e => pLabel(e.period)),
        oppRows: buildRows(oppSOGRows, r => r.shooter_name || `#${r.shooter_id}`, r => pLabel(r.period_id)),
      });

    } else if (statKey === 'blocked') {
      const carBlkEvts = ourShotEvents.filter(e => e.type === 'blocked-shot');
      const oppBlkRows = oppOnlyShots.filter(r => r.event_type === 'blocked_shot');
      setDrill({
        label:   'Blocked Shots', type: 'shots',
        carRows: buildRows(carBlkEvts, e => e.shooterName, e => pLabel(e.period)),
        oppRows: buildRows(oppBlkRows, r => r.shooter_name || `#${r.shooter_id}`, r => pLabel(r.period_id)),
      });

    } else if (!pbpEvents?.length) {
      return;

    } else if (statKey === 'hits') {
      const carH = pbpByType(pbpEvents, 'hit').filter(e => e.team_id === teamId);
      const oppH = pbpByType(pbpEvents, 'hit').filter(e => e.team_id !== teamId && e.team_id != null);
      setDrill({
        label:   'Hits', type: 'shots',
        carRows: buildRows(carH, e => e.player_name || `#${e.player_id}`),
        oppRows: buildRows(oppH, e => e.player_name || `#${e.player_id}`),
      });

    } else if (statKey === 'penalties') {
      const carP = pbpStats?.penalties.carRows || [];
      const oppP = pbpStats?.penalties.oppRows || [];
      const toRows = evs => evs.map(e => ({
        name:        e.player_name || `#${e.player_id}`,
        description: e.description ? e.description.replace(/^(?:Ob|Maj|Min|Mis|Gm)-/i, '').replace(/-/g, ' ').trim() : 'Penalty',
        minutes:     e.penalty_minutes || 2,
        period:      pLabel(e.period_id),
        periods: {}, total: 1,
      }));
      setDrill({ label: 'Penalties', type: 'penalties', carRows: toRows(carP), oppRows: toRows(oppP) });

    } else if (statKey === 'faceoff') {
      // Prefer gameSummary faceoff data (per-player wins/attempts) over PBP reconstruction
      if (Object.keys(faceoffStats).length > 0) {
        const rows = Object.values(faceoffStats)
          .filter(p => p.attempts > 0)
          .sort((a,b) => b.attempts - a.attempts)
          .map(p => ({ name: p.name, totalWon: p.wins, totalLost: p.losses, total: p.attempts }));
        setDrill({ label: `Faceoffs`, rows, type: 'faceoff' });
      } else {
        // Fallback: reconstruct from PBP events
        const foEvs  = pbpByType(pbpEvents, 'faceoff');
        const oppTeamId = (scoreBarData?.isHome ? pbpAwayId : pbpHomeId)
                       || (scoreBarData?.isHome ? scoreBarData?.awayTeamId : scoreBarData?.homeTeamId);
        const by = {};
        foEvs.forEach(e => {
          const winIsCAR = e.team_id === teamId;
          const winIsOPP = e.team_id === oppTeamId;
          if (!winIsCAR && !winIsOPP) return;
          const wName = e.player_name           || (e.player_id           ? `#${e.player_id}`           : null);
          const lName = e.secondary_player_name || (e.secondary_player_id ? `#${e.secondary_player_id}` : null);
          if (wName) {
            if (!by[wName]) by[wName] = { name: wName, totalWon: 0, totalLost: 0, total: 0 };
            if (winIsCAR) by[wName].totalWon++; else by[wName].totalLost++;
            by[wName].total++;
          }
          if (lName) {
            if (!by[lName]) by[lName] = { name: lName, totalWon: 0, totalLost: 0, total: 0 };
            if (!winIsCAR) by[lName].totalLost++; else by[lName].totalWon++;
            by[lName].total++;
          }
        });
        const rows = Object.values(by).filter(r => r.total > 0).sort((a,b) => b.total - a.total);
        setDrill({ label: `${abbr} Faceoffs`, rows, type: 'faceoff' });
      }
    } else if (statKey === 'pp') {
      // Power play analysis: each of our PP opportunities (from opp penalties)
      const penalties = pbpByType(pbpEvents, 'penalty');
      const ourPPPens = penalties.filter(e => e.team_id !== teamId && e.team_id != null && e.is_power_play);
      // Our PP shots: shot events during PP penalty windows
      const ppOpps = ourPPPens.map((pen, idx) => {
        const _penStart = pen.period_id * 10000 + pen.time_seconds;
        // Shots within 2 min (120s) of this penalty in same period
        const ppShots = ourShotEvents.filter(s => {
          if (s.period !== pen.period_id) return false;
          const dt = s.timeInPeriod
            ? (parseInt(s.timeInPeriod.split(':')[0])*60 + parseInt(s.timeInPeriod.split(':')[1])) - pen.time_seconds
            : -1;
          return dt >= 0 && dt <= 125;
        });
        const goals = ppShots.filter(s => s.type === 'goal');
        const sog   = ppShots.filter(s => s.type === 'shot-on-goal' || s.type === 'goal');
        let xg = 0;
        ppShots.forEach(s => { xg += Math.max(Math.exp(-distFromGoal(s.x, s.y) / 15) * 0.55, 0.02); });
        const mm = String(Math.floor(pen.time_seconds/60)).padStart(2,'0');
        const ss2 = String(pen.time_seconds%60).padStart(2,'0');
        return {
          idx, period: pLabel(pen.period_id), startTime: `${mm}:${ss2}`,
          scored: goals.length > 0, goals: goals.map(g => ({ scorer: g.shooterName || '—', time: g.timeInPeriod, shotType: g.shotType, assists: [] })),
          sog: sog.length, shots: ppShots.length, xg: parseFloat(xg.toFixed(2)),
          shotTypeCounts: {}, quickEntry: ppShots.length > 0 && ppShots[0],
          shotEvents: ppShots.map(s => ({ ...s, isCanes: true })),
          duration: 120,
        };
      });
      const totalGoals = ppOpps.filter(o => o.scored).length;
      const totalSOG   = ppOpps.reduce((s,o) => s + o.sog, 0);
      const totalXG    = parseFloat(ppOpps.reduce((s,o) => s + o.xg, 0).toFixed(2));
      setDrill({
        label: `${abbr} Power Play Analysis`, type: 'ppanalysis',
        ppOpps, ppUnit1: [], ppUnit2: [],
        summary: { goals: totalGoals, opps: ppOpps.length, sog: totalSOG, xg: totalXG },
      });
    } else if (statKey === 'pk') {
      // Penalty kill analysis: each of our PK opportunities (from our penalties)
      const penalties = pbpByType(pbpEvents, 'penalty');
      const ourPKPens = penalties.filter(e => e.team_id === teamId && e.is_power_play);
      // In live mode oppShotRows is empty — use liveOppShots adapted to snake_case instead
      const pkOppShotSource = (isLive && !oppShotRows.length)
        ? liveOppShots.map(s => ({
            shooter_id:  null,
            shooter_name: s.shooterName || null,
            event_type:   s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
            period_id:    s.period,
            time_seconds: s.timeInPeriod
              ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
              : 0,
            x_norm: s.x,
            y_norm: s.y,
          }))
        : oppShotRows;
      const pkOpps = ourPKPens.map((pen, idx) => {
        // Opp shots during this PK window
        const pkOppShots = pkOppShotSource
          .filter(r => {
            const ourIds = new Set((rawShots||[]).filter(s=>s.game_id===selectedGameId).map(s=>s.shooter_id).filter(Boolean));
            if (ourIds.has(r.shooter_id)) return false;
            if (r.period_id !== pen.period_id) return false;
            const dt = r.time_seconds - pen.time_seconds;
            return dt >= 0 && dt <= 125;
          });
        const goals = pkOppShots.filter(r => r.event_type === 'goal');
        const sog   = pkOppShots.filter(r => r.event_type === 'shot' || r.event_type === 'goal');
        const _blocks = pkOppShots.filter(r => r.event_type === 'blocked_shot');
        let xgAgainst = 0;
        pkOppShots.forEach(r => {
          if (r.x_norm != null) {
            const adapted = adaptOppShot(r);
            xgAgainst += Math.max(Math.exp(-distFromGoal(adapted.x, adapted.y) / 15) * 0.55, 0.02);
          }
        });
        const mm = String(Math.floor(pen.time_seconds/60)).padStart(2,'0');
        const ss2 = String(pen.time_seconds%60).padStart(2,'0');
        return {
          idx, period: pLabel(pen.period_id), startTime: `${mm}:${ss2}`,
          allowed: goals.length > 0,
          goalDetails: goals.map(g => ({ scorer: g.shooter_name || '—', time: `${String(Math.floor(g.time_seconds/60)).padStart(2,'0')}:${String(g.time_seconds%60).padStart(2,'0')}`, shotType: null, assists: [] })),
          sog: sog.length, shots: pkOppShots.length,
          xgAgainst: parseFloat(xgAgainst.toFixed(2)),
          blockerList: [], shotTypeCounts: {},
          shotEvents: pkOppShots.filter(r=>r.x_norm!=null).map(adaptOppShot).map(s=>({...s,isCanes:false})),
          duration: 120,
        };
      });
      const totalGA      = pkOpps.filter(o => o.allowed).length;
      const totalSOGvs   = pkOpps.reduce((s,o) => s + o.sog, 0);
      const totalXGvs    = parseFloat(pkOpps.reduce((s,o) => s + o.xgAgainst, 0).toFixed(2));
      const totalBlocks2 = pkOpps.reduce((s,o) => s + o.blockerList.reduce((b,bl)=>b+bl.count,0), 0);
      setDrill({
        label: `${abbr} Penalty Kill Analysis`, type: 'pkanalysis',
        pkOpps, pkUnit1: [], pkUnit2: [],
        summary: { goalsAgainst: totalGA, opps: pkOpps.length, sogAgainst: totalSOGvs, xgAgainst: totalXGvs, blocks: totalBlocks2 },
      });
    }
  }, [pbpEvents, pbpStats, ourShotEvents, oppShotRows, rawShots, selectedGameId, teamId, abbr, scoreBarData, pbpHomeId, pbpAwayId]);

  const buildDangerDrill = useCallback((zone) => {
    const sets = {
      hi:  { shots: dangerCounts.hi,  label: '🔴 High Danger (<15 ft)' },
      mid: { shots: dangerCounts.mid, label: '🟡 Medium Danger (15–30 ft)' },
      lo:  { shots: dangerCounts.lo,  label: '⚪ Low Danger (>30 ft)' },
    };
    const { shots, label } = sets[zone];
    const by = {};
    shots.forEach(e => {
      const name = e.shooterName || '—';
      const per  = pLabel(e.period);
      if (!by[name]) by[name] = { name, periods: {}, total: 0 };
      by[name].periods[per] = (by[name].periods[per] || 0) + 1;
      by[name].total++;
    });
    setDrill({ label, rows: Object.values(by).sort((a,b) => b.total - a.total), type: 'shots' });
  }, [dangerCounts]);

  // ── Derived display ───────────────────────────────────────────

  const oppTeam     = scoreBarData ? PWHL_TEAM_MAP[scoreBarData.oppAbbr] : null;
  const oppColor    = oppTeam?.displayColor || 'var(--text-dim)';
  const seasonLabel = SEASONS.find(s => s.id === season)?.label || String(season);
  const _viewLabel   = selectedGameId && scoreBarData
    ? `vs ${scoreBarData.oppAbbr} · ${scoreBarData.won ? 'W' : 'L'} ${scoreBarData.myScore}–${scoreBarData.oppScore}`
    : seasonLabel;
  const hasPBP  = selectedGameId && (
    (isLive && liveData?.events?.length > 0) ||
    (Array.isArray(pbpEvents) && pbpEvents.length > 0)
  );
  const oppAbbr = scoreBarData?.oppAbbr;

  if (!abbr) return (
    <div className={PAGE_CLASSES}>
      <div className="card" style={{ textAlign:'center', padding:32 }}>
        <p style={{ color:'var(--text-dim)' }}>No PWHL team selected.</p>
      </div>
    </div>
  );

  return (
    <div className={PAGE_CLASSES}>

      {/* ── Score bar ── */}
      <div className={SCORE_CARD_CLASSES} onClick={handleDebugTap} style={{ userSelect: 'none' }}>
        <div className={SCORE_INNER_CLASSES}>
          <div className={SCORE_TEAM_WRAP_CLASSES}>
            <div className={SCORE_TEAM_CLASSES}>
              <TeamLogo abbr={abbr} sport="pwhl" size={30} color={color} />
              <span className={scoreAbbrClasses()} style={{ color }}>{abbr}</span>
              <span className={scoreAbbrClasses()} style={{ color:'var(--text-dim)', fontWeight:400, fontSize:'0.75rem' }}>
                {team.shortName}
              </span>
              {scoreBarData && <span className={scoreNumClasses()} style={{ color }}>{scoreBarData.myScore}</span>}
            </div>
            {(isLive && liveSituation?.ourPP) || debugSituation?.ourPP ? (
              <div className={`${PP_INDICATOR_BASE_CLASSES} ${CAR_PP_CLASSES}`}>⚡ Power Play</div>
            ) : null}
            {(isLive && liveSituation?.ourEN) || debugSituation?.ourEN ? (
              <div className={`${PP_INDICATOR_BASE_CLASSES} en-indicator car-en`}>🥅 {abbr} Empty Net</div>
            ) : null}
          </div>
          <div className={SCORE_CENTER_CLASSES}>
            {isLive && selectedGameId === liveGame?.gameId ? (
              <>
                <div className={SCORE_PERIOD_CLASSES}>
                  {liveClock ? pLabel(liveClock.period) : '—'}
                </div>
                <div className={SCORE_CLOCK_CLASSES} style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {liveClock?.time || '—'}
                </div>
                <div className={`${SCORE_STATE_CLASSES} ${PILL_RED_CLASSES}`} style={{ marginTop: 4 }}>
                  {devGame ? '🟡 DEV' : '🔴 LIVE'}
                </div>
              </>
            ) : scoreBarData ? (
              <>
                <div className={SCORE_PERIOD_CLASSES}>Final{scoreBarData.ot?' OT':scoreBarData.shootout?' SO':''}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                  {scoreBarData.won ? '✓ Win' : '✗ Loss'} · {scoreBarData.isHome ? 'Home' : 'Away'}
                </div>
              </>
            ) : (
              <>
                <div className={SCORE_PERIOD_CLASSES}>Shot Map</div>
                <div style={{ fontSize:10, color:'var(--text-dim)' }}>Historical</div>
              </>
            )}
          </div>
          {scoreBarData ? (
            <div className={SCORE_TEAM_WRAP_CLASSES}>
              <div className={SCORE_TEAM_CLASSES}>
                <span className={scoreNumClasses('muted')}>{scoreBarData.oppScore}</span>
                <span className={scoreAbbrClasses('muted')}>{scoreBarData.oppAbbr}</span>
                {oppTeam && (
                  <span className={scoreAbbrClasses()} style={{ color:'var(--text-dim)', fontWeight:400, fontSize:'0.75rem' }}>
                    {oppTeam.shortName}
                  </span>
                )}
                <TeamLogo abbr={scoreBarData.oppAbbr} sport="pwhl" size={30} color={oppColor} />
              </div>
              {(isLive && liveSituation?.oppPP) || debugSituation?.oppPP ? (
                <div className={`${PP_INDICATOR_BASE_CLASSES} ${OPP_PP_CLASSES}`}>⚡ {scoreBarData.oppAbbr} Power Play</div>
              ) : null}
              {(isLive && liveSituation?.oppEN) || debugSituation?.oppEN ? (
                <div className={`${PP_INDICATOR_BASE_CLASSES} en-indicator opp-en`}>🥅 {scoreBarData.oppAbbr} Empty Net</div>
              ) : null}
            </div>
          ) : <div style={{ width:40 }} />}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <SeasonTypeToggle value={seasonType} onChange={handleSeasonTypeChange} />
            <SeasonChipRow seasons={SEASONS} selected={selectedYear} onSelect={handleYearSelect} />
          </div>
        </div>
      </div>

      {/* ── Game selector ── */}
      {(liveGame || games.length > 0) && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {liveGame && (
            <LiveGameChip
              liveGame={liveGameChipData}
              sport="pwhl"
              selected={selectedGameId === liveGame.gameId}
              onSelect={() => { setSelected(liveGame.gameId); setDrill(null); }}
            />
          )}
          {games.length > 0 && (
            <GameChipsRow games={gameChipGames} sport="pwhl"
              selectedGameId={selectedGameId} onSelect={handleSelect} onAll={handleAll} />
          )}
        </div>
      )}

      {/* ── Live / Game Insights ── */}
      {hasPBP && (
        <PWHLLiveInsights
          pbpEvents={pbpEvents}
          ourShotEvents={ourShotEvents}
          oppShotEvents={oppShotEvents}
          teamId={teamId}
          abbr={abbr}
          oppAbbr={oppAbbr}
          myScore={scoreBarData?.myScore}
          oppScore={scoreBarData?.oppScore}
          isLive={isLive}
          liveData={liveData}
          isPlayoff={isPlayoff}
        />
      )}

      {/* ── Period / game summary buttons ── */}
      {hasPBP && periodSummaries.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', padding:'0 0 4px' }}>
          {periodSummaries.map(s => (
            <button key={s.period} className={rinkBtnClasses({ active: false })}
              style={{ fontSize:11, padding:'3px 10px' }}
              onClick={() => setViewingSummaryPeriod(s.period)}>
              {s.periodShort} Summary
            </button>
          ))}
          {gameSummary && (
            <button className={rinkBtnClasses({ active: false })}
              style={{ fontSize:11, padding:'3px 10px', fontWeight:600 }}
              onClick={() => setViewingSummaryPeriod('game')}>
              📊 Game Summary
            </button>
          )}
        </div>
      )}

      {/* ── Row 1: SOG, Blocks, Hits, Penalties ──
          "All N": Opp SOG/Blocks come from seasonSummary instead of
          shotStats.oppSOG/oppBlocked, which are always 0 here -- those
          derive from oppShotEvents, which requires a selectedGameId (see
          its useMemo above) and was never actually season-aware despite
          shotStats itself (the "car" side) already being correct for All
          N. Hits/Penalties similarly switch from the "Select a game"
          placeholder to seasonSummary once it's the same "All N" data. */}
      {shotStats && (
        <div className={metricsGridClasses(4)}>
          <MetCard label="Shots on Goal" value={shotStats.sog}
            sub={`${shotStats.goals}G · Opp ${(isAllN ? seasonSummary?.sog.opp : shotStats.oppSOG) ?? '—'}`}
            onClick={() => buildDrillDown('sog')} />
          <MetCard label="Blocks" value={shotStats.blocks}
            sub={`Opp ${(isAllN ? seasonSummary?.blocked.opp : shotStats.oppBlocked) ?? '—'}`}
            onClick={() => buildDrillDown('blocked')} />
          <MetCard label="Hits"
            value={isAllN ? (seasonSummary?.hits.car ?? '—') : hasPBP ? (pbpStats?.hits.car ?? '—') : '—'}
            sub={isAllN
              ? (seasonSummary ? `Opp ${seasonSummary.hits.opp}` : 'Loading…')
              : hasPBP && pbpStats ? `Opp ${pbpStats.hits.opp}` : selectedGameId ? 'Loading…' : 'Select a game'}
            color={!isAllN && hasPBP && pbpStats && pbpStats.hits.car > pbpStats.hits.opp ? 'green' : null}
            onClick={!isAllN && hasPBP ? () => buildDrillDown('hits') : null} />
          <MetCard label="Penalties"
            value={isAllN ? (seasonSummary?.penalties.car ?? '—') : hasPBP ? (pbpStats?.penalties.car ?? '—') : '—'}
            sub={isAllN
              ? (seasonSummary ? `Opp ${seasonSummary.penalties.opp}` : 'Loading…')
              : hasPBP && pbpStats ? `Opp ${pbpStats.penalties.opp}` : selectedGameId ? 'Loading…' : 'Select a game'}
            color={hasPBP && pbpStats && pbpStats.penalties.car < pbpStats.penalties.opp ? 'green' : null}
            onClick={hasPBP ? () => buildDrillDown('penalties') : null} />
        </div>
      )}

      {/* ── Row 2: Faceoff%, PP%, PK% — "All N" season aggregate ──
          Previously this whole row simply never rendered in All-N mode
          (gated on hasPBP && pbpStats, both per-game-only) -- seasonSummary
          (Session 80) is the first season-wide source for any of these. */}
      {isAllN && (
        <div className={metricsGridClasses(3)}>
          <MetCard label="Faceoff %"
            value={seasonSummary?.faceoff.pct != null ? `${seasonSummary.faceoff.pct.toFixed(1)}%` : '—'}
            sub={seasonSummary ? `${seasonSummary.faceoff.car}W – ${seasonSummary.faceoff.opp}L` : 'Loading…'}
            color={seasonSummary?.faceoff.pct != null && seasonSummary.faceoff.pct > 50 ? 'green' : null} />
          <MetCard label="PP %"
            value={seasonSummary?.ppPct != null ? `${(seasonSummary.ppPct * 100).toFixed(1)}%` : '—'}
            sub={seasonSummary?.gamesPlayed ? `${seasonSummary.gamesPlayed} GP` : 'season'} />
          <MetCard label="PK %"
            value={seasonSummary?.pkPct != null ? `${(seasonSummary.pkPct * 100).toFixed(1)}%` : '—'}
            sub={seasonSummary?.gamesPlayed ? `${seasonSummary.gamesPlayed} GP` : 'season'} />
        </div>
      )}

      {/* ── Row 2: Faceoff%, PP%, PK% (game only) ── */}
      {hasPBP && pbpStats && (
        <div className={metricsGridClasses(3)}>
          {(() => {
            // Filter faceoffStats to our team only — both teams are included
            const ourFO = Object.values(faceoffStats).filter(p => p.team_id === teamId);
            if (ourFO.length > 0) {
              const totalWon = ourFO.reduce((s, p) => s + p.wins, 0);
              const totalAtt = ourFO.reduce((s, p) => s + p.attempts, 0);
              const pct      = totalAtt > 0 ? (totalWon / totalAtt * 100) : null;
              return (
                <MetCard label="Faceoff %"
                  value={pct != null ? `${pct.toFixed(1)}%` : '—'}
                  sub={`${totalWon}W – ${totalAtt - totalWon}L`}
                  color={pct != null && pct > 50 ? 'green' : null}
                  onClick={() => buildDrillDown('faceoff')} />
              );
            }
            // Fallback: PBP-derived (accurate now that away_team_id fixed in pipeline)
            return (
              <MetCard label="Faceoff %"
                value={pbpStats.faceoff.pct != null ? `${pbpStats.faceoff.pct.toFixed(1)}%` : '—'}
                sub={`${pbpStats.faceoff.won}W – ${pbpStats.faceoff.lost}L`}
                color={pbpStats.faceoff.pct != null && pbpStats.faceoff.pct > 50 ? 'green' : null}
                onClick={() => buildDrillDown('faceoff')} />
            );
          })()}
          {(() => {
            const opps = pbpStats.pp.opps;
            if (opps === 0) return (
              <MetCard label="PP %" value="—" sub="No PP opps" />
            );
            // Count PP goals: goals scored by us during opponent penalty windows
            const penalties = pbpByType(pbpEvents || [], 'penalty');
            const oppPens   = penalties.filter(e => e.team_id !== teamId && e.team_id != null && e.is_power_play);
            let ppGoals = 0;
            for (const pen of oppPens) {
              ppGoals += ourShotEvents.filter(s => {
                if (s.type !== 'goal') return false;
                if (s.period !== pen.period_id) return false;
                const goalSecs = s.timeInPeriod
                  ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
                  : -1;
                return goalSecs >= pen.time_seconds && goalSecs <= pen.time_seconds + 125;
              }).length;
            }
            const ppPct = Math.round(ppGoals / opps * 100);
            return (
              <MetCard label="PP %"
                value={`${ppPct}%`}
                sub={`${ppGoals}/${opps} · ${opps} opp${opps !== 1 ? 's' : ''}`}
                color={ppPct >= 20 ? 'green' : null}
                onClick={() => buildDrillDown('pp')} />
            );
          })()}
          {(() => {
            const opps = pbpStats.pp.pkOpps;
            if (opps === 0) return (
              <MetCard label="PK %" value="—" sub="No PK opps" />
            );
            // Count goals allowed during our penalty windows
            const penalties  = pbpByType(pbpEvents || [], 'penalty');
            const ourPens    = penalties.filter(e => e.team_id === teamId && e.is_power_play);
            const ourIds     = new Set((rawShots||[]).filter(r=>r.game_id===selectedGameId).map(r=>r.shooter_id).filter(Boolean));
            const oppOnlyRows = oppShotRows.filter(r => !ourIds.has(r.shooter_id));
            let pkGoalsAgainst = 0;
            for (const pen of ourPens) {
              pkGoalsAgainst += oppOnlyRows.filter(r => {
                if (r.event_type !== 'goal') return false;
                if (r.period_id !== pen.period_id) return false;
                return r.time_seconds >= pen.time_seconds && r.time_seconds <= pen.time_seconds + 125;
              }).length;
            }
            const survived = opps - pkGoalsAgainst;
            const pkPct    = Math.round(survived / opps * 100);
            return (
              <MetCard label="PK %"
                value={`${pkPct}%`}
                sub={`${survived}/${opps} killed`}
                color={pkPct >= 80 ? 'green' : pkPct < 50 ? null : null}
                onClick={() => buildDrillDown('pk')} />
            );
          })()}
        </div>
      )}

      {/* ── Shot Attempts panel ── */}
      {selectedGameId && ourShotEvents.length > 0 && (() => {
        const ourIds = new Set((rawShots||[]).filter(s=>s.game_id===selectedGameId).map(s=>s.shooter_id).filter(Boolean));
        // In live mode oppShotRows is empty — adapt liveOppShots to snake_case shape
        const filteredOppShots = (isLive && !oppShotRows.length)
          ? liveOppShots.map(s => ({
              shooter_id:  null,
              shooter_name: s.shooterName || null,
              event_type:  s.type === 'goal' ? 'goal' : s.type === 'blocked-shot' ? 'blocked_shot' : 'shot',
              period_id:   s.period,
              time_seconds: s.timeInPeriod
                ? parseInt(s.timeInPeriod.split(':')[0]) * 60 + parseInt(s.timeInPeriod.split(':')[1])
                : 0,
              x_norm: s.x, y_norm: s.y,
            }))
          : oppShotRows.filter(r => !ourIds.has(r.shooter_id));
        return (
          <ShotAttemptsPanel
            ourShots={ourShotEvents}
            oppShotRows={filteredOppShots}
            abbr={abbr} oppAbbr={oppAbbr}
            color={color}
            goalieStats={goalieStats}
            teamId={teamId}
          />
        );
      })()}

      {/* ── Shot danger (clickable) ── */}
      {dangerCounts.total > 0 && (
        <div className={`card ${DANGER_QUALITY_CARD_CLASSES}`}>
          <div className="sec-label">{abbr} Shot Quality</div>
          <div className={DANGER_GRID_CLASSES}>
            <div className={DANGER_CELL_CLASSES} onClick={() => buildDangerDrill('hi')}>
              <div className={dangerNumClasses('high')}>{dangerCounts.hiN}</div>
              <div className={DANGER_LABEL_CLASSES}>🔴 High danger</div>
              <div className={DANGER_SUB_CLASSES}>&lt;15 ft</div>
            </div>
            <div className={DANGER_CELL_CLASSES} onClick={() => buildDangerDrill('mid')}>
              <div className={dangerNumClasses('med')}>{dangerCounts.midN}</div>
              <div className={DANGER_LABEL_CLASSES}>🟡 Medium</div>
              <div className={DANGER_SUB_CLASSES}>15–30 ft</div>
            </div>
            <div className={DANGER_CELL_CLASSES} onClick={() => buildDangerDrill('lo')}>
              <div className={dangerNumClasses('lo')}>{dangerCounts.loN}</div>
              <div className={DANGER_LABEL_CLASSES}>⚪ Low</div>
              <div className={DANGER_SUB_CLASSES}>&gt;30 ft</div>
            </div>
          </div>
        </div>
      )}

      {/* ── two-col: left = rink, right = scorers + team stats ── */}
      <div className={TWO_COL_CLASSES}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card">
            <div className="sec-label">{abbr} Shot Locations</div>
            {rawShots === null && (
              <div style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>Loading shots…</div>
            )}
            {rawShots !== null && rinkEvents.length === 0 && (
              <div style={{ textAlign:'center', padding:32, color:'var(--text-dim)' }}>
                No shot data for this {selectedGameId ? 'game' : 'season'}.
              </div>
            )}
            {rinkEvents.length > 0 && <HockeyRink events={toHockeyRinkEvents(rinkEvents)} teamAbbr={abbr} teamColor={color} />}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {selectedGameId && topScorers.length > 0 && (
            <div className="card">
              <div className="sec-label">{abbr} scoring — this game</div>
              {topScorers.map((p,i) => (
                <div key={i} className={SCORER_ROW_CLASSES}>
                  <span className={SCORER_NAME_CLASSES}>{p.name}</span>
                  <div className={SCORER_STATS_CLASSES}>
                    {p.goals   > 0 && <span className={scorerChipClasses('goal')}>{p.goals}G</span>}
                    {p.assists > 0 && <span className={scorerChipClasses('assist')}>{p.assists}A</span>}
                    <span className={scorerChipClasses('pts')}>{p.points}PTS</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedGameId && (shotStats || pbpStats) && (
            <TeamStatsCard
              pbpStats={pbpStats} shotStats={shotStats}
              abbr={abbr} oppAbbr={oppAbbr}
              color={color} oppColor={oppColor}
              faceoffStats={faceoffStats}
              teamId={teamId}
            />
          )}

          {/* Goalie card from gameSummary */}
          {selectedGameId && goalieStats.length > 0 && (
            <GoalieCard
              goalies={goalieStats}
              teamId={teamId}
              abbr={abbr}
              oppAbbr={oppAbbr}
              color={color}
              oppColor={oppColor}
            />
          )}
        </div>
      </div>

      <div style={{ fontSize:10, color:'var(--text-dim)', textAlign:'center', padding:'8px 16px' }}>
        {selectedGameId ? 'Tap any card or danger zone to drill down · ' : ''}
        Coordinates normalised to attacking direction · Source: HockeyTech / PWHL
      </div>

      {drillStat && (
        <StatDrillPopup drillStat={drillStat} onClose={() => setDrill(null)} abbr={abbr} oppAbbr={oppAbbr} color={color} />
      )}

      {/* ── Game event popups ── */}
      {puckDropPopup && <PWHLPuckDropPopup data={puckDropPopup}  onClose={clearPuckDropPopup} />}
      {goalPopup     && <PWHLGoalPopup     data={goalPopup}      onClose={clearGoalPopup}    />}
      {hatTrickPopup && <HatTrickPopup      data={hatTrickPopup}  onClose={clearHatTrickPopup} />}
      {penaltyPopup  && <PWHLPenaltyPopup  data={penaltyPopup}   onClose={clearPenaltyPopup} />}
      {winPopup      && <PWHLWinPopup      data={winPopup}       onClose={clearWinPopup}     />}

      {/* ── Debug popups ── */}
      {debugGoalPopup    && <PWHLGoalPopup     data={debugGoalPopup}    onClose={() => setDebugGoalPopup(null)}    />}
      {debugHatTrickPopup && <HatTrickPopup      data={debugHatTrickPopup} onClose={() => setDebugHatTrickPopup(null)} />}
      {debugPenaltyPopup && <PWHLPenaltyPopup  data={debugPenaltyPopup} onClose={() => setDebugPenaltyPopup(null)} />}
      {debugWinPopup     && <PWHLWinPopup      data={debugWinPopup}     onClose={() => setDebugWinPopup(null)}     />}
      {debugPuckPopup    && <PWHLPuckDropPopup  data={debugPuckPopup}    onClose={() => setDebugPuckPopup(null)}    />}

      {/* ── Period / Game Summary popup ── */}
      {viewingSummary && (
        <PWHLPeriodSummary
          summary={viewingSummary}
          onDismiss={() => { setViewingSummaryPeriod(null); dismissNewSummary(); }}
          onNarrativeReady={(period, narrative) => {
            if (viewingSummary.isGameSummary) updateGameNarrative(narrative);
            else updateSummaryNarrative(period, narrative);
          }}
          carAbbr={abbr}
          oppAbbr={oppAbbr || 'OPP'}
          homeAbbr={scoreBarData?.isHome ? abbr : (oppAbbr || 'OPP')}
        />
      )}

      {/* ── Debug panel (5 taps on score card, dev only) ── */}
      {import.meta.env.DEV && debugOpen && (
        <div className={DEBUG_PANEL_CLASSES} style={DEBUG_PANEL_BOTTOM_STYLE}>
          <div className={DEBUG_PANEL_HEADER_CLASSES}>
            <div>
              <div className={DEBUG_PANEL_TITLE_CLASSES}>🛠 PWHL Event Debug</div>
              <div className={DEBUG_PANEL_SUB_CLASSES}>Tap to fire game events</div>
            </div>
            <button className={DEBUG_CLOSE_BTN_CLASSES} onClick={() => setDebugOpen(false)}>✕</button>
          </div>
          <div className={DEBUG_PANEL_COLS_CLASSES}>
            <div>
              <div className={DEBUG_SECTION_LABEL_CLASSES}>Popups</div>
              <div className={DEBUG_PANEL_BTNS_CLASSES}>
                <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
                  scorer: 'Marie-Philip Poulin', assists: ['Laura Stacey', 'Kayla Kosowski'],
                  shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
                  isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P2', time: '14:32',
                })}>🚨 Goal</button>
                <button className={debugBtnClasses('goal')} onClick={() => setDebugGoalPopup({
                  scorer: 'Laura Stacey', assists: [],
                  shotType: 'Snap', isPowerPlay: true, isShortHanded: false,
                  isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P1', time: '08:11',
                })}>⚡ PP Goal</button>
                <button className={debugBtnClasses()} style={{ background: 'rgba(204,34,0,0.15)', color: 'var(--red-bright)' }}
                  onClick={() => setDebugPuckPopup({ gameId: 'debug' })}>🏒 Puck Drop</button>
                <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
                  id: 'debug-1', player: 'Blayre Turnbull',
                  desc: 'Tripping', severity: null, duration: 2, periodLabel: 'P2', time: '08:17',
                })}>⚡ PP Alert</button>
                <button className={debugBtnClasses('penalty')} onClick={() => setDebugPenaltyPopup({
                  id: 'debug-2', player: 'Sarah Nurse',
                  desc: 'Fighting', severity: 'Major', duration: 5, periodLabel: 'P3', time: '12:04',
                })}>🟠 Major</button>
                <button className={debugBtnClasses('win')} onClick={() => setDebugWinPopup({
                  teamAbbr: abbr || 'MTL',
                  score: `${abbr || 'MTL'} 3 – BOS 2`,
                })}>🏆 Win</button>
                <button className={debugBtnClasses()} style={{ background: 'rgba(200,169,81,0.15)', color: '#c8a951' }}
                  onClick={() => setDebugHatTrickPopup({
                    scorer: 'Marie-Philip Poulin', assists: ['Laura Stacey'],
                    shotType: 'Wrist', isPowerPlay: false, isShortHanded: false,
                    isEmptyNet: false, isPenaltyShot: false, periodLabel: 'P3', time: '11:22',
                    teamColor: color,
                  })}>🧢 Hat Trick</button>
              </div>
              <div className={DEBUG_SECTION_LABEL_CLASSES}>Situation</div>
              <div className={DEBUG_PANEL_BTNS_CLASSES}>
                <button className={debugBtnClasses('pp-car')}
                  onClick={() => { setDebugSituation({ ourPP: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🟢 Our PP
                </button>
                <button className={debugBtnClasses('pp-opp')}
                  onClick={() => { setDebugSituation({ oppPP: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🟡 Opp PP
                </button>
                <button className={debugBtnClasses()} style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }}
                  onClick={() => { setDebugSituation({ ourEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🥅 Our EN
                </button>
                <button className={debugBtnClasses()} style={{ background: 'rgba(250,190,30,0.1)', color: '#fbbf24' }}
                  onClick={() => { setDebugSituation({ oppEN: true }); setTimeout(() => setDebugSituation(null), 15000); }}>
                  🥅 Opp EN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
