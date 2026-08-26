// components/PeriodSummary.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TEAM_CONFIG } from '../utils/teamConfig';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from './ShareButtons';

// ── Tailwind class constants -- POPUP HALF (Phase 4, sub-PR 5a) ──
// PeriodSummary.css's ps-canvas-* export-image classes are a separate,
// structurally distinct half (dark-only, off-screen export canvas) --
// deferred to sub-PR 5b, left as literal classNames for now, PeriodSummary.css
// NOT deleted yet. Duplicated in PWHLPeriodSummary.jsx per established
// per-file convention.
//
// light-mode-overrides.css's "PeriodSummary.css — IN-APP popup/carousel
// section only" block turned out to have only ONE real, live override --
// .ps-carousel-dot(+.opp/.active.opp/.car) -- the other 7 selectors named
// there (ps-backdrop, ps-header-badge, etc) were confirmed dead via
// full-tree grep and removed from that file in this same sub-PR; see its
// own comment. ps-carousel-dot kept literal here so that override keeps
// applying.

const PS_OVERLAY_CLASSES = 'ps-overlay fixed inset-0 z-[600] [backdrop-filter:blur(4px)] flex items-center justify-center p-4 animate-[psOverlayIn_0.2s_ease] bg-[rgba(0,0,0,0.75)]';
const PS_CARD_CLASSES = 'ps-card w-full max-w-[460px] max-h-[88vh] overflow-y-auto bg-[var(--bg1)] rounded-[20px] pb-[env(safe-area-inset-bottom,16px)] animate-[psCardIn_0.3s_cubic-bezier(0.34,1.3,0.64,1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const PS_HEADER_CLASSES = 'ps-header flex items-center justify-between pt-4 px-[18px] sticky top-0 bg-[var(--bg1)] z-[2]';
const PS_PERIOD_BADGE_CLASSES = 'ps-period-badge text-[11px] font-extrabold tracking-[0.12em] uppercase text-[color:var(--red-bright)] bg-[rgba(var(--team-primary-rgb),0.12)] py-1 px-[10px] rounded-[20px]';
const PS_BTN_ICON_CLASSES = 'ps-btn-icon bg-[var(--bg3)] border-none rounded-[8px] py-[6px] px-2 text-[14px] cursor-pointer text-[color:var(--text-muted)] [transition:background_0.15s,color_0.15s] hover:bg-[var(--bg2)] hover:text-[color:var(--text)]';

const PS_SCORE_BANNER_CLASSES = 'ps-score-banner flex items-center justify-center gap-3 pt-[18px] px-[18px] pb-3 border-b-[0.5px] border-[var(--border)]';
const PS_TEAM_SCORE_CLASSES = 'ps-team-score flex flex-col items-center gap-[2px] min-w-[60px]';
const PS_TEAM_ABBR_BASE_CLASSES = 'ps-team-abbr text-[11px] font-bold tracking-[0.08em]';
const PS_TEAM_ABBR_DEFAULT_CLASSES = 'text-[color:var(--text-muted)]';
const PS_TEAM_ABBR_CAR_CLASSES = 'car text-[color:var(--red-bright)]';
function psTeamAbbrClasses(isCar) {
  return `${PS_TEAM_ABBR_BASE_CLASSES} ${isCar ? PS_TEAM_ABBR_CAR_CLASSES : PS_TEAM_ABBR_DEFAULT_CLASSES}`;
}
const PS_SCORE_NUM_CLASSES = 'ps-score-num text-[36px] font-extrabold text-[color:var(--text)] leading-none [font-variant-numeric:tabular-nums]';
const PS_SCORE_DIVIDER_CLASSES = 'text-[20px] text-[color:var(--text-dim)] mt-2';
const PS_TEAM_LOGO_CLASSES = 'ps-team-logo w-11 h-11 object-contain mb-1';

const PS_STAT_GRID_CLASSES = 'ps-stat-grid grid grid-cols-3 gap-2 pt-[14px] px-[14px]';
const PS_STAT_CELL_CLASSES = 'ps-stat-cell bg-[var(--bg2)] rounded-[10px] py-[10px] px-2 flex flex-col items-center gap-[2px]';
const PS_STAT_VAL_BASE_CLASSES = 'text-[18px] font-extrabold [font-variant-numeric:tabular-nums]';
const PS_STAT_VAL_DEFAULT_CLASSES = 'text-[color:var(--text)]';
const PS_STAT_VAL_GOOD_CLASSES = 'good text-[color:var(--green)]';
const PS_STAT_VAL_BAD_CLASSES = 'bad text-[color:var(--red-bright)]';
function psStatValClasses(color) {
  const variant = color === 'good' ? PS_STAT_VAL_GOOD_CLASSES : color === 'bad' ? PS_STAT_VAL_BAD_CLASSES : PS_STAT_VAL_DEFAULT_CLASSES;
  return `${PS_STAT_VAL_BASE_CLASSES} ${variant}`;
}
const PS_STAT_LABEL_CLASSES = 'text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--text-dim)]';

const PS_SECTION_LABEL_CLASSES = 'ps-section-label text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--text-dim)] pt-[14px] px-4 pb-[6px]';

// .ps-goals/.ps-goal-row confirmed dead (zero JSX consumers in either file --
// period-summary.cy.js's own conditional checks for them, confirming they've
// never existed here) -- not migrated, not replicated.
const PS_GOAL_INFO_CLASSES = 'flex items-center gap-[10px] py-[10px] px-3';
const PS_GOAL_HEADSHOT_CLASSES = 'w-9 h-9 rounded-full object-cover border-[1.5px] border-[var(--border-2)] flex-shrink-0';
const PS_GOAL_HEADSHOT_PLACEHOLDER_CLASSES = 'w-9 h-9 rounded-full bg-[var(--bg3)] flex-shrink-0 flex items-center justify-center text-[16px]';
const PS_GOAL_TEXT_CLASSES = 'flex-1 min-w-0';
const PS_GOAL_SCORER_BASE_CLASSES = 'ps-goal-scorer text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis';
const PS_GOAL_SCORER_DEFAULT_CLASSES = 'text-[color:var(--text)]';
const PS_GOAL_SCORER_CAR_CLASSES = 'car text-[color:var(--red-bright)]';
function psGoalScorerClasses(isCar) {
  return `${PS_GOAL_SCORER_BASE_CLASSES} ${isCar ? PS_GOAL_SCORER_CAR_CLASSES : PS_GOAL_SCORER_DEFAULT_CLASSES}`;
}
const PS_GOAL_META_CLASSES = 'text-[11px] text-[color:var(--text-muted)] mt-[1px]';
const PS_STRENGTH_BADGE_BASE_CLASSES = 'text-[9px] font-bold tracking-[0.06em] py-[2px] px-[6px] rounded-[4px] uppercase flex-shrink-0';
const PS_STRENGTH_BADGE_PP_CLASSES = 'bg-[rgba(240,160,48,0.15)] text-[color:var(--amber)]';
const PS_STRENGTH_BADGE_SH_CLASSES = 'bg-[rgba(74,144,226,0.15)] text-[color:var(--blue-bright)]';
const PS_STRENGTH_BADGE_EV_CLASSES = 'bg-[var(--bg3)] text-[color:var(--text-dim)]';
// 'en' (empty net) had zero CSS coverage in the original PeriodSummary.css --
// only .pp/.sh/.ev existed, so PWHL's strengthLabel() returning 'en' rendered
// an unstyled badge (base font-size/padding/radius only, no bg/color). Fixed
// here rather than replicated: 'en' gets the same treatment as 'sh' (both
// are "our opponent had an advantage" states, closest existing semantic match).
function psStrengthBadgeClasses(sl) {
  const variant = sl === 'pp' ? PS_STRENGTH_BADGE_PP_CLASSES
    : (sl === 'sh' || sl === 'en') ? PS_STRENGTH_BADGE_SH_CLASSES
    : PS_STRENGTH_BADGE_EV_CLASSES;
  return `${PS_STRENGTH_BADGE_BASE_CLASSES} ${variant}`;
}
const PS_GOAL_VIDEO_CLASSES = 'w-full [aspect-ratio:16/9] border-none block border-t-[0.5px] border-[var(--border)]';

const PS_PENALTIES_CLASSES = 'ps-penalties px-[14px] flex flex-col gap-1';
const PS_PENALTY_ROW_CLASSES = 'ps-penalty-row flex items-center gap-2 py-2 px-[10px] bg-[var(--bg2)] rounded-[8px] text-[12px] text-[color:var(--text-muted)]';
const PS_PENALTY_TEAM_BASE_CLASSES = 'ps-penalty-team text-[10px] font-bold py-[2px] px-[6px] rounded-[4px] flex-shrink-0';
const PS_PENALTY_TEAM_CAR_CLASSES = 'car bg-[rgba(var(--team-primary-rgb),0.15)] text-[color:var(--red-bright)]';
const PS_PENALTY_TEAM_OPP_CLASSES = 'opp bg-[var(--bg3)] text-[color:var(--text-dim)]';
function psPenaltyTeamClasses(isCar) {
  return `${PS_PENALTY_TEAM_BASE_CLASSES} ${isCar ? PS_PENALTY_TEAM_CAR_CLASSES : PS_PENALTY_TEAM_OPP_CLASSES}`;
}
const PS_PENALTY_INFO_CLASSES = 'flex flex-col gap-px flex-1 min-w-0';
const PS_PENALTY_PLAYER_CLASSES = 'ps-penalty-player text-[12px] font-bold text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis';
const PS_PENALTY_TYPE_CLASSES = 'text-[11px] text-[color:var(--text-dim)] capitalize';
const PS_PENALTIES_TOGGLE_CLASSES = 'ps-penalties-toggle w-full py-2 bg-transparent border-[0.5px] border-[var(--border)] rounded-[8px] text-[color:var(--text-dim)] text-[12px] font-semibold cursor-pointer [transition:background_0.15s,color_0.15s] mt-[2px] hover:bg-[var(--bg2)] hover:text-[color:var(--text-muted)]';

const PS_NARRATIVE_CLASSES = 'ps-narrative mx-[14px] [background:linear-gradient(135deg,rgba(var(--team-primary-rgb),0.06),rgba(74,144,226,0.04))] border-[0.5px] border-[rgba(var(--team-primary-rgb),0.2)] rounded-[12px] p-[14px]';
const PS_NARRATIVE_LABEL_CLASSES = 'text-[9px] font-bold tracking-[0.1em] uppercase text-[color:var(--red-bright)] mb-2 flex items-center gap-[6px]';
const PS_NARRATIVE_TEXT_CLASSES = 'ps-narrative-text text-[13px] text-[color:var(--text-muted)] leading-[1.6]';
const PS_NARRATIVE_LOADING_CLASSES = 'ps-narrative-loading flex items-center gap-2 text-[12px] text-[color:var(--text-dim)]';
const PS_NARRATIVE_DOT_CLASSES = 'w-[6px] h-[6px] bg-[var(--red-bright)] rounded-full animate-[psDotPulse_1.2s_ease-in-out_infinite]';

const PS_THREE_STARS_CLASSES = 'ps-three-stars px-[14px] flex gap-2';
const PS_STAR_CARD_CLASSES = 'ps-star-card flex-1 bg-[var(--bg2)] rounded-[10px] py-[10px] px-2 flex flex-col items-center gap-1 text-center';
const PS_STAR_RANK_CLASSES = 'text-[14px]';
const PS_STAR_HEADSHOT_CLASSES = 'w-10 h-10 rounded-full object-cover border-[1.5px] border-[var(--border-2)]';
const PS_STAR_NAME_CLASSES = 'ps-star-name text-[11px] font-bold text-[color:var(--text)]';
const PS_STAR_TEAM_CLASSES = 'text-[10px] text-[color:var(--text-dim)]';

const PS_SHARE_SECTION_CLASSES = 'ps-share-section py-3 px-[14px] pb-5 flex flex-col items-center gap-2';

const PS_CAROUSEL_CLASSES = 'ps-carousel px-[14px]';
const PS_CAROUSEL_NAV_CLASSES = 'ps-carousel-nav flex items-center justify-between mb-2';
const PS_CAROUSEL_ARROW_CLASSES = 'ps-carousel-arrow bg-[var(--bg3)] border-none rounded-[8px] w-8 h-8 text-[18px] text-[color:var(--text-muted)] cursor-pointer flex items-center justify-center [transition:background_0.15s,color_0.15s] disabled:opacity-25 disabled:cursor-default enabled:hover:bg-[var(--bg2)] enabled:hover:text-[color:var(--text)]';
const PS_CAROUSEL_DOTS_CLASSES = 'ps-carousel-dots flex gap-[6px] items-center';
// .ps-carousel-dot combines car/opp (bg color) with active (bg color when
// active + scale transform) -- both dimensions set bg unconditionally in the
// original CSS's compound selectors, so this needs a full 4-way lookup table
// rather than concatenating independent Tailwind utilities (lesson #9).
const PS_CAROUSEL_DOT_BASE_CLASSES = 'ps-carousel-dot w-2 h-2 rounded-full cursor-pointer [transition:transform_0.15s,background_0.15s]';
const PS_CAROUSEL_DOT_VARIANTS = {
  'car-inactive': 'car bg-[rgba(var(--team-primary-rgb),0.4)]',
  'opp-inactive': 'opp bg-[rgba(255,255,255,0.15)]',
  'car-active':   'active car scale-[1.4] bg-[var(--red-bright)]',
  'opp-active':   'active opp scale-[1.4] bg-[rgba(255,255,255,0.5)]',
};
function psCarouselDotClasses(isCar, isActive) {
  const key = `${isCar ? 'car' : 'opp'}-${isActive ? 'active' : 'inactive'}`;
  return `${PS_CAROUSEL_DOT_BASE_CLASSES} ${PS_CAROUSEL_DOT_VARIANTS[key]}`;
}
const PS_CAROUSEL_COUNTER_CLASSES = 'ps-carousel-counter text-center text-[11px] text-[color:var(--text-dim)] mt-2 mb-1';

const PS_GOAL_CARD_CLASSES = 'ps-goal-card bg-[var(--bg2)] rounded-[12px] overflow-hidden';

const PS_PERIOD_BREAKDOWN_CLASSES = 'ps-period-breakdown px-[14px] flex flex-col gap-2';
const PS_PERIOD_ROW_CLASSES = 'ps-period-row flex items-center gap-[10px]';
const PS_PERIOD_ROW_LABEL_CLASSES = 'text-[11px] font-bold text-[color:var(--text-dim)] w-5 flex-shrink-0';
const PS_PERIOD_ROW_BAR_WRAP_CLASSES = 'flex-1 h-[6px] bg-[var(--bg3)] rounded-[3px] overflow-hidden';
const PS_PERIOD_ROW_BAR_BASE_CLASSES = 'h-full rounded-[3px] [transition:width_0.4s_ease]';
const PS_PERIOD_ROW_BAR_GOOD_CLASSES = 'good bg-[var(--green)]';
const PS_PERIOD_ROW_BAR_BAD_CLASSES = 'bad bg-[var(--red-bright)]';
const PS_PERIOD_ROW_BAR_NEUTRAL_CLASSES = 'neutral bg-[var(--text-dim)]';
function psPeriodRowBarClasses(pct) {
  const variant = pct >= 55 ? PS_PERIOD_ROW_BAR_GOOD_CLASSES : pct <= 45 ? PS_PERIOD_ROW_BAR_BAD_CLASSES : PS_PERIOD_ROW_BAR_NEUTRAL_CLASSES;
  return `${PS_PERIOD_ROW_BAR_BASE_CLASSES} ${variant}`;
}
const PS_PERIOD_ROW_PCT_BASE_CLASSES = 'ps-period-row-pct text-[12px] font-bold w-[38px] text-right flex-shrink-0';
const PS_PERIOD_ROW_PCT_DEFAULT_CLASSES = 'text-[color:var(--text-muted)]';
const PS_PERIOD_ROW_PCT_GOOD_CLASSES = 'good text-[color:var(--green)]';
const PS_PERIOD_ROW_PCT_BAD_CLASSES = 'bad text-[color:var(--red-bright)]';
function psPeriodRowPctClasses(pct) {
  const variant = pct >= 55 ? PS_PERIOD_ROW_PCT_GOOD_CLASSES : pct <= 45 ? PS_PERIOD_ROW_PCT_BAD_CLASSES : PS_PERIOD_ROW_PCT_DEFAULT_CLASSES;
  return `${PS_PERIOD_ROW_PCT_BASE_CLASSES} ${variant}`;
}
const PS_PERIOD_ROW_SOG_CLASSES = 'text-[11px] text-[color:var(--text-dim)] w-[60px] text-right flex-shrink-0';

const PS_HAT_TRICKS_CLASSES = 'flex flex-col items-center gap-[6px] my-[6px]';
const PS_HAT_TRICK_CHIP_CLASSES = 'inline-flex items-center gap-[6px] [background:linear-gradient(90deg,var(--team-primary)_0%,color-mix(in_srgb,var(--team-primary)_60%,transparent)_100%)] text-white text-[13px] font-semibold py-[6px] px-[14px] rounded-[20px] tracking-[0.02em] whitespace-nowrap';

// ── Tailwind class constants -- CANVAS HALF (Phase 4, sub-PR 5b) ──
// PeriodSummary.css deleted after this sub-PR (both halves now migrated).
// No Cypress markers and no light-mode-overrides.css dependency for any
// class here -- confirmed via full-tree grep against every spec file, and
// the canvas is explicitly "intentionally kept dark" per the original
// light-mode-overrides.css comment (now removed, see index.css/that file's
// history). 20 of PeriodSummary.css's original 58 ps-canvas-* classes were
// confirmed dead (an older single-column canvas layout superseded by the
// "redesigned" two-column one below) and are not migrated: ps-canvas-ai-band
// (+label/+text), ps-canvas-brand(-row), ps-canvas-divider, ps-canvas-goal-dot,
// ps-canvas-goal-row, ps-canvas-goal-text, ps-canvas-goal-time,
// ps-canvas-goals-label, ps-canvas-logo, ps-canvas-narrative(-label/-text),
// ps-canvas-score, ps-canvas-score-num, ps-canvas-team(-abbr), ps-canvas-team-logo.
// Several classes were defined twice in the original CSS (a base value, then
// a later "lighter theme"/"additions" section overriding it) -- only the
// FINAL resolved value is used here, not the superseded one.

const PS_SHARE_CANVAS_CLASSES = 'fixed left-[-9999px] top-0 w-[1080px] h-[1080px] bg-[#1a1a2e] font-[family-name:var(--font-main,system-ui)] pointer-events-none z-[-1]';
const PS_CANVAS_HEADER_CLASSES = 'flex items-center justify-between pt-6 px-[52px] pb-3';
const PS_CANVAS_LOGO_LARGE_CLASSES = 'w-32 h-32 object-contain';
const PS_CANVAS_PERIOD_CLASSES = 'text-[13px] font-extrabold tracking-[0.15em] uppercase text-[color:var(--team-canvas)] bg-[rgba(var(--team-canvas-rgb),0.15)] py-[6px] px-4 rounded-[20px]';

const PS_CANVAS_SCORE_AI_ROW_CLASSES = 'flex items-stretch px-[52px] border-b-[0.5px] border-[rgba(255,255,255,0.08)] min-h-[280px]';
const PS_CANVAS_SCORE_COMPACT_V2_CLASSES = 'flex flex-col items-center justify-center gap-[2px] flex-shrink-0 w-[160px] py-[14px]';
const PS_CANVAS_SCORE_COMPACT_TEAM_BASE_CLASSES = 'text-[16px] font-extrabold tracking-[0.1em]';
const PS_CANVAS_SCORE_COMPACT_TEAM_DEFAULT_CLASSES = 'text-[rgba(255,255,255,0.4)]';
const PS_CANVAS_SCORE_COMPACT_TEAM_CAR_CLASSES = 'text-[color:var(--team-canvas)]';
function psCanvasScoreCompactTeamClasses(isCar) {
  return `${PS_CANVAS_SCORE_COMPACT_TEAM_BASE_CLASSES} ${isCar ? PS_CANVAS_SCORE_COMPACT_TEAM_CAR_CLASSES : PS_CANVAS_SCORE_COMPACT_TEAM_DEFAULT_CLASSES}`;
}
const PS_CANVAS_SCORE_COMPACT_NUM_CLASSES = 'text-[58px] font-black text-white leading-none [font-variant-numeric:tabular-nums]';
const PS_CANVAS_SCORE_COMPACT_DIV_CLASSES = 'text-[22px] text-[rgba(255,255,255,0.2)] leading-none my-[2px]';
const PS_CANVAS_SCORE_AI_DIVIDER_CLASSES = 'w-[0.5px] bg-[rgba(255,255,255,0.08)] my-[14px] mx-6 flex-shrink-0';
const PS_CANVAS_NARRATIVE_FULL_CLASSES = 'flex-1 flex flex-col justify-center py-[14px]';
const PS_CANVAS_NARRATIVE_FULL_LABEL_CLASSES = 'text-[11px] font-extrabold tracking-[0.12em] uppercase text-[color:var(--team-canvas)] mb-2';
const PS_CANVAS_NARRATIVE_FULL_TEXT_CLASSES = 'text-[16px] leading-[1.65] text-[rgba(255,255,255,0.7)]';

const PS_CANVAS_STATS_CLASSES = 'grid grid-cols-3 gap-[10px] py-[10px] px-[52px]';
const PS_CANVAS_STAT_CLASSES = 'bg-[rgba(255,255,255,0.07)] border-[0.5px] border-[rgba(255,255,255,0.1)] rounded-[10px] p-2 flex flex-col items-center gap-[3px]';
const PS_CANVAS_STAT_VAL_BASE_CLASSES = 'text-[22px] font-extrabold';
const PS_CANVAS_STAT_VAL_DEFAULT_CLASSES = 'text-[#f0f0f0]';
const PS_CANVAS_STAT_VAL_GOOD_CLASSES = 'text-[#4ade80]';
const PS_CANVAS_STAT_VAL_BAD_CLASSES = 'text-[color:var(--team-canvas)]';
function psCanvasStatValClasses(color) {
  const variant = color === 'good' ? PS_CANVAS_STAT_VAL_GOOD_CLASSES : color === 'bad' ? PS_CANVAS_STAT_VAL_BAD_CLASSES : PS_CANVAS_STAT_VAL_DEFAULT_CLASSES;
  return `${PS_CANVAS_STAT_VAL_BASE_CLASSES} ${variant}`;
}
const PS_CANVAS_STAT_LABEL_CLASSES = 'text-[12px] font-bold tracking-[0.12em] uppercase text-[rgba(255,255,255,0.3)]';

const PS_CANVAS_GOALS_CLASSES = 'px-[52px] pb-[10px] flex flex-col gap-[6px]';
const PS_CANVAS_SECTION_LABEL_CLASSES = 'text-[12px] font-bold tracking-[0.12em] uppercase text-[rgba(255,255,255,0.3)] mb-2';
const PS_CANVAS_GOALS_TWO_COL_CLASSES = 'flex gap-4';
const PS_CANVAS_GOALS_COL_CLASSES = 'flex-1 flex flex-col gap-[5px]';
const PS_CANVAS_GOALS_COL_HEADER_BASE_CLASSES = 'text-[12px] font-extrabold tracking-[0.12em] uppercase mb-1 pb-1 border-b-[0.5px] border-[rgba(255,255,255,0.08)]';
const PS_CANVAS_GOALS_COL_HEADER_DEFAULT_CLASSES = 'text-[rgba(255,255,255,0.3)]';
const PS_CANVAS_GOALS_COL_HEADER_CAR_CLASSES = 'text-[color:var(--team-canvas)]';
function psCanvasGoalsColHeaderClasses(isCar) {
  return `${PS_CANVAS_GOALS_COL_HEADER_BASE_CLASSES} ${isCar ? PS_CANVAS_GOALS_COL_HEADER_CAR_CLASSES : PS_CANVAS_GOALS_COL_HEADER_DEFAULT_CLASSES}`;
}
const PS_CANVAS_GOAL_COMPACT_CLASSES = 'flex justify-between items-center gap-[6px]';
const PS_CANVAS_GOAL_COMPACT_NAME_CLASSES = 'text-[16px] font-bold text-[rgba(255,255,255,0.85)] whitespace-nowrap overflow-hidden text-ellipsis flex-1';
const PS_CANVAS_GOAL_COMPACT_META_CLASSES = 'text-[13px] text-[rgba(255,255,255,0.35)] whitespace-nowrap flex-shrink-0';

const PS_CANVAS_INSIGHTS_CLASSES = 'px-[52px] pb-5 flex flex-col gap-[6px]';
const PS_CANVAS_INSIGHT_CHIP_CLASSES = 'text-[16px] text-[rgba(255,255,255,0.55)] bg-[rgba(255,255,255,0.04)] rounded-[8px] py-2 px-[14px] flex items-center gap-[6px]';

const PS_CANVAS_STRENGTH_BASE_CLASSES = 'text-[11px] font-bold tracking-[0.06em] py-[2px] px-[5px] rounded-[3px] uppercase';
const PS_CANVAS_STRENGTH_PP_CLASSES = 'bg-[rgba(240,160,48,0.2)] text-[#f0a030]';
const PS_CANVAS_STRENGTH_SH_CLASSES = 'bg-[rgba(74,144,226,0.2)] text-[#4a90e2]';
const PS_CANVAS_STRENGTH_EV_CLASSES = 'bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.3)]';
// 'en' (empty net) fix -- same gap and same fix as psStrengthBadgeClasses
// above (the popup-side equivalent): PeriodSummary.css never defined
// .ps-canvas-strength.en, so empty-net goal badges on the export canvas
// rendered unstyled too. Given the same treatment as 'sh'.
function psCanvasStrengthClasses(sl) {
  const variant = sl === 'pp' ? PS_CANVAS_STRENGTH_PP_CLASSES
    : (sl === 'sh' || sl === 'en') ? PS_CANVAS_STRENGTH_SH_CLASSES
    : PS_CANVAS_STRENGTH_EV_CLASSES;
  return `${PS_CANVAS_STRENGTH_BASE_CLASSES} ${variant}`;
}

const PS_CANVAS_THREE_STARS_CLASSES = 'px-[52px] pb-[6px]';
const PS_CANVAS_STARS_ROW_CLASSES = 'flex gap-4';
const PS_CANVAS_STAR_CLASSES = 'flex-1 bg-[rgba(255,255,255,0.04)] border-[0.5px] border-[rgba(255,255,255,0.07)] rounded-[12px] p-[10px] flex flex-col items-center gap-1 text-center';
const PS_CANVAS_STAR_RANK_CLASSES = 'text-[17px]';
const PS_CANVAS_STAR_IMG_CLASSES = 'w-[52px] h-[52px] rounded-full object-cover border-[1.5px] border-[rgba(255,255,255,0.1)]';
const PS_CANVAS_STAR_NAME_CLASSES = 'text-[14px] font-bold text-[rgba(255,255,255,0.8)]';
const PS_CANVAS_STAR_TEAM_CLASSES = 'text-[12px] text-[rgba(255,255,255,0.35)]';
const PS_CANVAS_STAR_INITIALS_CLASSES = 'w-12 h-12 rounded-full bg-[rgba(var(--team-canvas-rgb),0.2)] border-[1.5px] border-[rgba(var(--team-canvas-rgb),0.4)] flex items-center justify-center text-[19px] font-extrabold text-white';

const PS_CANVAS_FOOTER_CLASSES = 'absolute bottom-5 left-[52px] right-[52px] flex items-center justify-between';
const PS_CANVAS_FOOTER_BRAND_CLASSES = 'text-[14px] font-bold tracking-[0.12em] text-[rgba(255,255,255,0.2)]';
const PS_CANVAS_FOOTER_TAG_CLASSES = 'text-[14px] text-[rgba(255,255,255,0.2)]';

// Brightcove embed — autoplay=false prevents simultaneous playback
const BRIGHTCOVE_URL = (id) =>
  `https://players.brightcove.net/6415718365001/EXtG1xJ7H_default/index.html?videoId=${id}&autoplay=false`;

// Supabase fetch — inline to avoid circular imports with supabaseClient
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://mqgasjzywoibdgxjjkux.supabase.co';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || 'sb_publishable_e_zwr1UA7GnHq4OuQSas5Q_kO8bQ_Ct';

async function fetchGameSummaryFromDB(gameId, team) {
  if (!gameId || !team) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/game_summaries?game_id=eq.${gameId}&team=eq.${team}&select=summary_text,card_text&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows?.[0]?.summary_text) return null;
    return { text: rows[0].summary_text, cardText: rows[0].card_text || null };
  } catch { return null; }
}

function strengthLabel(strength) {
  if (!strength) return 'ev';
  const s = String(strength).toLowerCase();
  if (s === 'pp' || s === '1451' || s === '1541') return 'pp';
  if (s === 'sh' || s === '0451' || s === '0541') return 'sh';
  return 'ev';
}

function corsiColor(pct) {
  if (pct >= 55) return 'good';
  if (pct <= 45) return 'bad';
  return '';
}

// Fetch narrative — DB-first for game summaries, then Worker, then direct AI.
// Period summaries are not stored in DB (only full game summaries are), so
// periods always go straight to Worker → direct AI.
async function generateNarrative(summary, carAbbr, oppAbbr, isPlayoff = false) {
  const workerUrl = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_WORKER_URL
    : null;

  const periodKey = summary.isGameSummary ? 'game' : String(summary.period);

  // ── Path 0: DB lookup (game summaries only) ───────────────────
  if (summary.isGameSummary && summary.gameId) {
    const dbResult = await fetchGameSummaryFromDB(summary.gameId, carAbbr);
    if (dbResult?.text) return { narrative: dbResult.text, cardNarrative: dbResult.cardText };
  }

  // Build the stats payload the Worker needs to generate the prompt
  const statsPayload = {
    carAbbr,
    oppAbbr,
    isPlayoff,
    periodLabel:    summary.periodLabel,
    corsiForPct:    summary.corsiForPct,
    carSOG:         summary.carSOG,
    oppSOG:         summary.oppSOG,
    carGoals:       summary.carGoals,
    oppGoals:       summary.oppGoals,
    carHits:        summary.carHits,
    carFOPct:       summary.carFOPct,
    carHDCF:        summary.carHDCF,
    oppHDCF:        summary.oppHDCF,
    penaltyCount:   summary.penalties?.length ?? 0,
    carPenaltyCount: summary.penalties?.filter(p => p.isCar).length ?? 0,
    bestPeriod:     summary.bestPeriod,
    worstPeriod:    summary.worstPeriod,
    primaryGoalieName:  summary.primaryGoalieName || null,
    goals: (summary.goals || []).map(g => ({
      isCar:      g.isCar,
      scorerName: g.scorerName,
      time:       g.time,
      period:     g.period,
      strength:   g.strength,
    })),
  };
  // ── Path 1: Worker endpoint (production) ─────────────────────
  if (workerUrl && summary.gameId) {
    try {
      const res = await fetch(
        `${workerUrl}/summary/narrative?gameId=${summary.gameId}&period=${periodKey}&carAbbr=${encodeURIComponent(carAbbr)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(statsPayload),
        }
      );
      if (!res.ok) throw new Error(`Worker ${res.status}`);
      const data = await res.json();
      if (data.narrative) return { narrative: data.narrative, cardNarrative: data.cardNarrative || null };
    } catch (e) {
      console.warn('Worker narrative failed, falling back to direct AI:', e.message);
    }
  }

  // No Worker URL configured — narrative unavailable
  return null; // callers check for null
}

// ── Goal Carousel ─────────────────────────────────────────────
// ── Hat trick detection ──────────────────────────────────────
// Natural hat trick: 3 consecutive goals in the FULL game goals list
// by the same player with no other goals in between (from either team).
function detectHatTricks(goals) {
  if (!goals?.length) return [];
  const counts  = {};
  const info    = {};
  goals.forEach((g, idx) => {
    const id = g.scorerId != null ? String(g.scorerId) : g.scorerName;
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
    if (!info[id]) info[id] = { scorerName: g.scorerName, isCar: g.isCar, indices: [] };
    info[id].indices.push(idx);  // track actual array index, not indexOf()
  });
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([id]) => {
      const { scorerName, isCar, indices } = info[id];
      // Natural: find any 3 consecutive hat trick goals where every goal
      // between the first and third (inclusive) belongs to this scorer.
      let isNatural = false;
      for (let i = 0; i <= indices.length - 3; i++) {
        const start = indices[i];
        const end   = indices[i + 2];
        const slice = goals.slice(start, end + 1);
        const sliceId = (g) => g.scorerId != null ? String(g.scorerId) : g.scorerName;
        if (slice.every(g => sliceId(g) === id)) {
          isNatural = true;
          break;
        }
      }
      return { scorerName, isCar, isNatural };
    });
}

function GoalCarousel({ goals, carAbbr }) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(null);

  const prev = useCallback(() => { setIdx(i => Math.max(0, i - 1)); }, []);
  const next = useCallback(() => { setIdx(i => Math.min(goals.length - 1, i + 1)); }, [goals.length]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  };

  if (!goals.length) return null;
  const g = goals[idx];
  const sl = strengthLabel(g.strength);

  return (
    <div className={PS_CAROUSEL_CLASSES} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Nav arrows */}
      <div className={PS_CAROUSEL_NAV_CLASSES}>
        <button className={PS_CAROUSEL_ARROW_CLASSES} onClick={prev} disabled={idx === 0}>‹</button>
        <div className={PS_CAROUSEL_DOTS_CLASSES}>
          {goals.map((_, i) => (
            <div
              key={i}
              className={psCarouselDotClasses(goals[i].isCar, i === idx)}
              onClick={() => { setIdx(i); }}
            />
          ))}
        </div>
        <button className={PS_CAROUSEL_ARROW_CLASSES} onClick={next} disabled={idx === goals.length - 1}>›</button>
      </div>

      {/* Goal card */}
      <div className={PS_GOAL_CARD_CLASSES}>
        <div className={PS_GOAL_INFO_CLASSES}>
          {g.scorerHeadshot ? (
            <img className={PS_GOAL_HEADSHOT_CLASSES} src={g.scorerHeadshot} alt={g.scorerName || ''} onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div className={PS_GOAL_HEADSHOT_PLACEHOLDER_CLASSES}>🏒</div>
          )}
          <div className={PS_GOAL_TEXT_CLASSES}>
            <div className={psGoalScorerClasses(g.isCar)}>
              {g.scorerName || (g.isCar ? carAbbr : 'OPP')}
            </div>
            <div className={PS_GOAL_META_CLASSES}>
              {g.time}
              {g.assists?.length > 0 && <> · {g.assists.map(a => a.name?.default).filter(Boolean).join(', ')}</>}
              {g.shotType && <> · {g.shotType}</>}
            </div>
          </div>
          <div className={psStrengthBadgeClasses(sl)}>{sl.toUpperCase()}</div>
        </div>

        {/* Video — rendered directly since carousel shows one at a time */}
        {g.discreteClip && (
          <iframe
            className={PS_GOAL_VIDEO_CLASSES}
            src={BRIGHTCOVE_URL(g.discreteClip)}
            allow="fullscreen"
            allowFullScreen
            title={t('periodSummary.goals.videoTitle', { scorer: g.scorerName || t('periodSummary.goals.playerFallback'), time: g.time })}
          />
        )}
      </div>

      {/* Goal counter */}
      <div className={PS_CAROUSEL_COUNTER_CLASSES}>{idx + 1} / {goals.length}</div>
    </div>
  );
}

// ── Share canvas (1080×1080, off-screen) ─────────────────────
// Shared stat definitions — used by both the popup grid and the share canvas
// so they're always in sync
function getPeriodStats(summary, carAbbr, t) {
  return [
    { val: `${summary.corsiForPct}%`,  label: t('periodSummary.stats.corsiForPct', { abbr: carAbbr }),    color: corsiColor(summary.corsiForPct) },
    { val: `${summary.carSOG}–${summary.oppSOG}`, label: t('gameStatsPopup.teamStats.shotsOnGoal') },
    { val: `${summary.fenwickForPct}%`, label: t('periodSummary.stats.fenwickForPct', { abbr: carAbbr }), color: corsiColor(summary.fenwickForPct) },
    { val: summary.carHits,             label: t('periodSummary.stats.hits', { abbr: carAbbr }) },
    { val: summary.carFOPct != null ? `${summary.carFOPct}%` : '—', label: t('periodSummary.stats.faceoffWinPct') },
    { val: `${summary.carHDCF ?? 0}–${summary.oppHDCF ?? 0}`, label: t('periodSummary.stats.highDangerChances'),
      color: (summary.carHDCF ?? 0) > (summary.oppHDCF ?? 0) ? 'good' : (summary.carHDCF ?? 0) < (summary.oppHDCF ?? 0) ? 'bad' : '' },
  ];
}

function ShareCanvas({ summary, carAbbr, oppAbbr, homeAbbr, canvasRef, cardNarrative }) {
  const { t } = useTranslation();
  const carIsHome = homeAbbr === carAbbr;
  const carScore = carIsHome ? summary.homeScore : summary.awayScore;
  const oppScore = carIsHome ? summary.awayScore : summary.homeScore;
  const stats = getPeriodStats(summary, carAbbr, t);
  const dominatedBy = summary.corsiForPct >= 55 ? carAbbr : summary.corsiForPct <= 45 ? oppAbbr : null;
  const carPenalties = summary.penalties.filter(p => p.isCar).length;
  const oppPenalties = summary.penalties.filter(p => !p.isCar).length;
  const carGoals = summary.goals.filter(g => g.isCar);
  const oppGoals = summary.goals.filter(g => !g.isCar);
  const isGame = summary.isGameSummary;

  return (
    <div className={PS_SHARE_CANVAS_CLASSES} ref={canvasRef}>

      {/* Header */}
      <div className={PS_CANVAS_HEADER_CLASSES}>
        <img src="/eyewall-logo.svg" alt="EyeWall" className={PS_CANVAS_LOGO_LARGE_CLASSES}
          onError={e => { e.target.style.display='none'; }} />
        <span className={PS_CANVAS_PERIOD_CLASSES}>{t('periodSummary.header', { period: summary.periodLabel })}</span>
      </div>

      {/* Score + AI narrative — score compact left, narrative fills right */}
      <div className={PS_CANVAS_SCORE_AI_ROW_CLASSES}>
        <div className={PS_CANVAS_SCORE_COMPACT_V2_CLASSES}>
          <div className={psCanvasScoreCompactTeamClasses(true)}>{carAbbr}</div>
          <div className={PS_CANVAS_SCORE_COMPACT_NUM_CLASSES}>{carScore ?? '–'}</div>
          <div className={PS_CANVAS_SCORE_COMPACT_DIV_CLASSES}>–</div>
          <div className={PS_CANVAS_SCORE_COMPACT_NUM_CLASSES}>{oppScore ?? '–'}</div>
          <div className={psCanvasScoreCompactTeamClasses(false)}>{oppAbbr}</div>
        </div>
        <div className={PS_CANVAS_SCORE_AI_DIVIDER_CLASSES} />
        <div className={PS_CANVAS_NARRATIVE_FULL_CLASSES}>
          <div className={PS_CANVAS_NARRATIVE_FULL_LABEL_CLASSES}>{t('gameStatsPopup.summary.badge')}</div>
          <div className={PS_CANVAS_NARRATIVE_FULL_TEXT_CLASSES}>
            {cardNarrative || summary.cardNarrative || summary.aiNarrative || t('periodSummary.ai.generatingCanvas')}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className={PS_CANVAS_STATS_CLASSES}>
        {stats.map((s, i) => (
          <div key={i} className={PS_CANVAS_STAT_CLASSES}>
            <div className={psCanvasStatValClasses(s.color)}>{s.val}</div>
            <div className={PS_CANVAS_STAT_LABEL_CLASSES}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals — two column for game, single column for period */}
      {detectHatTricks(summary.goals).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0', justifyContent: 'center' }}>
          {detectHatTricks(summary.goals).map((ht, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--team-canvas)', color: '#fff',
              fontSize: 13, fontWeight: 600, padding: '6px 12px',
              borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              🎩 {ht.isNatural ? t('milestonesFeed.type.naturalHatTrick') : t('milestonesFeed.type.hatTrick')}{ht.scorerName ? ` — ${ht.scorerName}` : ''}
            </div>
          ))}
        </div>
      )}

      {summary.goals.length > 0 && (
        <div className={PS_CANVAS_GOALS_CLASSES}>
          <div className={PS_CANVAS_SECTION_LABEL_CLASSES}>
            {isGame ? t('periodSummary.goals.thisGame') : t('periodSummary.goals.thisPeriod')}
          </div>
          {isGame ? (
            <div className={PS_CANVAS_GOALS_TWO_COL_CLASSES}>
              {/* CAR column */}
              <div className={PS_CANVAS_GOALS_COL_CLASSES}>
                <div className={psCanvasGoalsColHeaderClasses(true)}>{carAbbr}</div>
                {carGoals.map((g, i) => (
                  <div key={i} className={PS_CANVAS_GOAL_COMPACT_CLASSES}>
                    <span className={PS_CANVAS_GOAL_COMPACT_NAME_CLASSES}>
                      {g.scorerName?.split(' ').pop() || carAbbr}
                    </span>
                    <span className={PS_CANVAS_GOAL_COMPACT_META_CLASSES}>
                      P{g.period} {g.time}
                      {strengthLabel(g.strength) !== 'ev' && (
                        <span className={psCanvasStrengthClasses(strengthLabel(g.strength))}>
                          {' '}{strengthLabel(g.strength).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* OPP column */}
              <div className={PS_CANVAS_GOALS_COL_CLASSES}>
                <div className={psCanvasGoalsColHeaderClasses(false)}>{oppAbbr}</div>
                {oppGoals.map((g, i) => (
                  <div key={i} className={PS_CANVAS_GOAL_COMPACT_CLASSES}>
                    <span className={PS_CANVAS_GOAL_COMPACT_NAME_CLASSES}>
                      {g.scorerName?.split(' ').pop() || oppAbbr}
                    </span>
                    <span className={PS_CANVAS_GOAL_COMPACT_META_CLASSES}>
                      P{g.period} {g.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Period cards: two-column compact layout — matches game card style */
            <div className={PS_CANVAS_GOALS_TWO_COL_CLASSES}>
              <div className={PS_CANVAS_GOALS_COL_CLASSES}>
                <div className={psCanvasGoalsColHeaderClasses(true)}>{carAbbr}</div>
                {summary.goals.filter(g => g.isCar).slice(0, 5).map((g, i) => (
                  <div key={i} className={PS_CANVAS_GOAL_COMPACT_CLASSES}>
                    <span className={PS_CANVAS_GOAL_COMPACT_NAME_CLASSES}>
                      {g.scorerName?.split(' ').pop() || carAbbr}
                    </span>
                    <span className={PS_CANVAS_GOAL_COMPACT_META_CLASSES}>
                      {g.time}
                      {strengthLabel(g.strength) !== 'ev' && (
                        <span className={psCanvasStrengthClasses(strengthLabel(g.strength))}>
                          {' '}{strengthLabel(g.strength).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className={PS_CANVAS_GOALS_COL_CLASSES}>
                <div className={psCanvasGoalsColHeaderClasses(false)}>{oppAbbr}</div>
                {summary.goals.filter(g => !g.isCar).slice(0, 5).map((g, i) => (
                  <div key={i} className={PS_CANVAS_GOAL_COMPACT_CLASSES}>
                    <span className={PS_CANVAS_GOAL_COMPACT_NAME_CLASSES}>
                      {g.scorerName?.split(' ').pop() || oppAbbr}
                    </span>
                    <span className={PS_CANVAS_GOAL_COMPACT_META_CLASSES}>{g.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insights — period only (game has AI narrative above instead) */}
      {!isGame && (
        <div className={PS_CANVAS_INSIGHTS_CLASSES}>
          {dominatedBy && (
            <div className={PS_CANVAS_INSIGHT_CHIP_CLASSES}>
              <span className={dominatedBy === carAbbr ? 'good' : 'bad'}>
                {dominatedBy === carAbbr ? '↑' : '↓'}
              </span>
              {' '}{t('periodSummary.possession.dominated', { team: dominatedBy })}
            </div>
          )}
          {(carPenalties > 0 || oppPenalties > 0) && (
            <div className={PS_CANVAS_INSIGHT_CHIP_CLASSES}>
              {t('periodSummary.penalties.insight', { abbr: carAbbr, carCount: carPenalties, oppCount: oppPenalties, oppAbbr })}
            </div>
          )}
          {summary.carTK != null && (
            <div className={PS_CANVAS_INSIGHT_CHIP_CLASSES}>
              {summary.carTK > summary.carGV ? '✓' : '✗'} {t('periodSummary.takeawaysGiveaways', { tk: summary.carTK, gv: summary.carGV })}
            </div>
          )}
        </div>
      )}

      {/* Three stars — game summary only */}
      {isGame && summary.threeStars?.length > 0 && (
        <div className={PS_CANVAS_THREE_STARS_CLASSES}>
          <div className={PS_CANVAS_SECTION_LABEL_CLASSES}>{t('periodSummary.threeStars')}</div>
          <div className={PS_CANVAS_STARS_ROW_CLASSES}>
            {summary.threeStars.slice(0, 3).map((s, i) => {
              const name = s.name?.default || '—';
              // Proxy headshot through /nhl-assets/ to avoid CORS during html-to-image export
              const headshot = s.headshot
                ? s.headshot.replace('https://assets.nhle.com', '/nhl-assets')
                : null;
              return (
                <div key={i} className={PS_CANVAS_STAR_CLASSES}>
                  <div className={PS_CANVAS_STAR_RANK_CLASSES}>{'⭐'.repeat(3 - i)}</div>
                  {headshot ? (
                    <img src={headshot} alt={name} className={PS_CANVAS_STAR_IMG_CLASSES}
                      onError={e => { e.target.style.display='none'; }} />
                  ) : (
                    <div className={PS_CANVAS_STAR_INITIALS_CLASSES}>
                      {name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                    </div>
                  )}
                  <div className={PS_CANVAS_STAR_NAME_CLASSES}>{name}</div>
                  <div className={PS_CANVAS_STAR_TEAM_CLASSES}>{s.teamAbbrev?.default || ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={PS_CANVAS_FOOTER_CLASSES}>
        <span className={PS_CANVAS_FOOTER_BRAND_CLASSES}>eyewallanalytics.com</span>
        <span className={PS_CANVAS_FOOTER_TAG_CLASSES}>{TEAM_CONFIG.hashtags?.[0] || `#${TEAM_CONFIG.abbr}`}</span>
      </div>
    </div>
  );
}

// ── Collapsible penalties section ───────────────────────────
const PENALTY_COLLAPSE_AT = 3;
function PenaltiesSection({ penalties, carAbbr, oppAbbr }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? penalties : penalties.slice(0, PENALTY_COLLAPSE_AT);
  const hasMore = penalties.length > PENALTY_COLLAPSE_AT;
  return (
    <>
      <div className={PS_SECTION_LABEL_CLASSES}>{t('periodSummary.penalties.sectionLabel', { count: penalties.length })}</div>
      <div className={PS_PENALTIES_CLASSES}>
        {visible.map((p, i) => (
          <div key={i} className={PS_PENALTY_ROW_CLASSES}>
            <span className={psPenaltyTeamClasses(p.isCar)}>
              {p.isCar ? carAbbr : oppAbbr}
            </span>
            <div className={PS_PENALTY_INFO_CLASSES}>
              <span className={PS_PENALTY_PLAYER_CLASSES}>{p.playerName || t('periodSummary.penalties.unknown')}</span>
              <span className={PS_PENALTY_TYPE_CLASSES}>
                {p.type || t('periodSummary.penalties.typeFallback')}{p.duration ? ` · ${t('periodSummary.penalties.durationSuffix', { count: p.duration })}` : ''}
                {p.period ? ` · P${p.period}` : ''}
              </span>
            </div>
            <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-dim)',flexShrink:0}}>{p.time}</span>
          </div>
        ))}
        {hasMore && (
          <button className={PS_PENALTIES_TOGGLE_CLASSES} onClick={() => setExpanded(e => !e)}>
            {expanded ? t('periodSummary.penalties.showLess') : t('periodSummary.penalties.showMore', { count: penalties.length - PENALTY_COLLAPSE_AT })}
          </button>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────
export default function PeriodSummary({
  summary,
  onDismiss,
  onNarrativeReady,
  carAbbr = TEAM_CONFIG.abbr,
  oppAbbr = 'OPP',
  homeAbbr = TEAM_CONFIG.abbr,
  _awayAbbr = 'OPP',
  readOnly = false,
  isPlayoff = false,
}) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [cardNarrative, setCardNarrative] = useState(summary?.cardNarrative || null);

  // Generate AI narrative on mount — Worker generates once and caches in KV for all users.
  useEffect(() => {
    if (!summary || summary.aiNarrative) return;
    if (!summary.isGameSummary && !summary.aiLoading) return;
    generateNarrative(summary, carAbbr, oppAbbr, isPlayoff).then(result => {
      if (!result) return;
      const text = typeof result === 'string' ? result : result.narrative;
      const card = typeof result === 'string' ? null : result.cardNarrative;
      if (text && onNarrativeReady) onNarrativeReady(summary.period, text);
      if (card) setCardNarrative(card);
    });
   
  }, [summary?.period]);

  const carIsHome = homeAbbr === carAbbr;
  const carScore  = carIsHome ? summary?.homeScore : summary?.awayScore;
  const oppScore  = carIsHome ? summary?.awayScore : summary?.homeScore;

  const xCaption = summary ? [
    t('periodSummary.xCaption.line1', { period: summary.periodLabel, abbr: carAbbr, car: carScore ?? '\u2013', opp: oppScore ?? '\u2013', oppAbbr }),
    t('periodSummary.xCaption.line2', { cf: summary.corsiForPct, carSog: summary.carSOG, oppSog: summary.oppSOG, carGoals: summary.carGoals, oppGoals: summary.oppGoals }),
    summary.aiNarrative || '',
    `#${carAbbr} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n') : '';

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef,
      filename: `EyeWall-${carAbbr}-${summary?.periodShort ?? 'Summary'}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
      },
    });

  if (!summary) return null;

  return (
    <>
      <div className={PS_OVERLAY_CLASSES} onClick={readOnly ? undefined : onDismiss}>
        <div className={PS_CARD_CLASSES} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className={PS_HEADER_CLASSES}>
            <span className={PS_PERIOD_BADGE_CLASSES}>{t('periodSummary.header', { period: summary.periodShort })}</span>
            <button className={PS_BTN_ICON_CLASSES} onClick={onDismiss} title={t('common.close')} aria-label={t('common.close')}>✕</button>
          </div>

          {/* Score */}
          <div className={PS_SCORE_BANNER_CLASSES}>
            <div className={PS_TEAM_SCORE_CLASSES}>
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${carAbbr}_dark.svg`}
                alt={carAbbr}
                className={PS_TEAM_LOGO_CLASSES}
                onError={e => { e.target.style.display='none'; }}
              />
              <div className={psTeamAbbrClasses(true)}>{carAbbr}</div>
              <div className={PS_SCORE_NUM_CLASSES}>{carScore ?? '–'}</div>
            </div>
            <div className={PS_SCORE_DIVIDER_CLASSES}>–</div>
            <div className={PS_TEAM_SCORE_CLASSES}>
              <img
                src={`https://assets.nhle.com/logos/nhl/svg/${oppAbbr}_dark.svg`}
                alt={oppAbbr}
                className={PS_TEAM_LOGO_CLASSES}
                onError={e => { e.target.style.display='none'; }}
              />
              <div className={psTeamAbbrClasses(false)}>{oppAbbr}</div>
              <div className={PS_SCORE_NUM_CLASSES}>{oppScore ?? '–'}</div>
            </div>
          </div>

          {/* Stat grid — same source as canvas for consistency */}
          <div className={PS_STAT_GRID_CLASSES}>
            {getPeriodStats(summary, carAbbr, t).map((s, i) => (
              <div key={i} className={PS_STAT_CELL_CLASSES}>
                <div className={psStatValClasses(s.color)}>{s.val}</div>
                <div className={PS_STAT_LABEL_CLASSES}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Narrative */}
          <div className={PS_SECTION_LABEL_CLASSES}>{t('periodSummary.ai.label')}</div>
          <div className={PS_NARRATIVE_CLASSES}>
            <div className={PS_NARRATIVE_LABEL_CLASSES}>{t('periodSummary.ai.periodAnalysis')}</div>
            {summary.aiLoading && !summary.aiNarrative ? (
              <div className={PS_NARRATIVE_LOADING_CLASSES}>
                <div className={PS_NARRATIVE_DOT_CLASSES} />
                {t('periodSummary.ai.generating')}
              </div>
            ) : (
              <div className={PS_NARRATIVE_TEXT_CLASSES}>{summary.aiNarrative || t('periodSummary.ai.unavailable')}</div>
            )}
          </div>

          {/* Hat trick highlights */}
          {detectHatTricks(summary.goals).length > 0 && (
            <div className={PS_HAT_TRICKS_CLASSES}>
              {detectHatTricks(summary.goals).map((ht, i) => (
                <div key={i} className={PS_HAT_TRICK_CHIP_CLASSES}>
                  🎩 {ht.isNatural ? t('milestonesFeed.type.naturalHatTrick') : t('milestonesFeed.type.hatTrick')}
                  {ht.scorerName ? ` — ${ht.scorerName}` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Goals carousel */}
          {summary.goals.length > 0 && (
            <>
              <div className={PS_SECTION_LABEL_CLASSES}>{t('periodSummary.goals.sectionLabel', { count: summary.goals.length })}</div>
              <GoalCarousel goals={summary.goals} carAbbr={carAbbr} />
            </>
          )}

          {/* Penalties — collapsed if more than 3 */}
          {summary.penalties.length > 0 && (
            <PenaltiesSection penalties={summary.penalties} carAbbr={carAbbr} oppAbbr={oppAbbr} />
          )}

          {/* Period breakdown — game summary only */}
          {summary.isGameSummary && summary.periodStats?.length > 0 && (
            <>
              <div className={PS_SECTION_LABEL_CLASSES}>{t('periodSummary.periodBreakdown')}</div>
              <div className={PS_PERIOD_BREAKDOWN_CLASSES}>
                {summary.periodStats.map(ps => (
                  <div key={ps.period} className={PS_PERIOD_ROW_CLASSES}>
                    <span className={PS_PERIOD_ROW_LABEL_CLASSES}>P{ps.period}</span>
                    <div className={PS_PERIOD_ROW_BAR_WRAP_CLASSES}>
                      <div
                        className={psPeriodRowBarClasses(ps.corsiForPct)}
                        style={{ width: `${ps.corsiForPct}%` }}
                      />
                    </div>
                    <span className={psPeriodRowPctClasses(ps.corsiForPct)}>
                      {ps.corsiForPct}%
                    </span>
                    <span className={PS_PERIOD_ROW_SOG_CLASSES}>{t('periodSummary.sogSuffix', { car: ps.carSOG, opp: ps.oppSOG })}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Three stars — game summary only */}
          {summary.isGameSummary && summary.threeStars?.length > 0 && (
            <>
              <div className={PS_SECTION_LABEL_CLASSES}>{t('periodSummary.threeStars')}</div>
              <div className={PS_THREE_STARS_CLASSES}>
                {summary.threeStars.slice(0, 3).map((s, i) => (
                  <div key={i} className={PS_STAR_CARD_CLASSES}>
                    <div className={PS_STAR_RANK_CLASSES}>{'⭐'.repeat(3 - i)}</div>
                    <img className={PS_STAR_HEADSHOT_CLASSES} src={s.headshot || ''} alt={s.name?.default || ''} onError={e => { e.target.style.display='none'; }} />
                    <div className={PS_STAR_NAME_CLASSES}>{s.name?.default || '—'}</div>
                    <div className={PS_STAR_TEAM_CLASSES}>{s.teamAbbrev?.default || ''}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Share */}
          <div className={PS_SHARE_SECTION_CLASSES}>
            <ShareButtons
              onSave={handleSave}
              onShareX={handleShareX}
              onNativeShare={handleNativeShare}
              canNativeShare={canNativeShare}
              saving={saving}
              sharing={sharing}
            />
          </div>

        </div>
      </div>

      {/* Off-screen canvas for image export — only mounted on first export click */}
      {canvasMounted && (
        <ShareCanvas
          summary={summary}
          carAbbr={carAbbr}
          oppAbbr={oppAbbr}
          homeAbbr={homeAbbr}
          canvasRef={canvasRef}
          cardNarrative={cardNarrative}
        />
      )}
    </>
  );
}
