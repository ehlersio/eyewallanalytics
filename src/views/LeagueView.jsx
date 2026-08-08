// LeagueView.jsx
// Place in src/views/ alongside LeagueView.css

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { capture } from '../utils/analytics';
import { useFetch } from '../hooks/useFetch';
import Sparkline from '../components/Sparkline';
import {
  getStandings,
  getScoringLeaders,
  getGoalLeaders,
  getGoalieLeaders,
  getPlayoffBracket,
  getPlayoffSeries,
  getPlayoffSeriesGames,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import { getTeamSeasonData, getPowerRankingsNarrative, getPowerRankingsHistory } from '../utils/supabaseClient';
import { ALL_TEAMS } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from '../components/TeamLogo';
import PlayerPopup from '../components/PlayerPopup';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from '../components/ShareButtons';
import './LeagueView.css';
import '../components/PredictionCanvas.css';
import DraftTab from '../components/DraftTab';

// .pp-close (Session 97, Phase 3, sub-PR 3) -- was PlayersView.css's,
// used here only via importing PlayerPopup (which imported that file as a
// side effect). PlayersView.css is deleted now that every real consumer
// has migrated; migrated this one direct usage too rather than leave it
// stranded on dead CSS. Kept as a literal marker -- league.cy.js and
// milestones.cy.js select on .pp-close directly.
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'

// ── Tailwind class constants -- SHELL + STANDINGS + DRAFT SKELETON
// (Phase 4, LeagueView.css sub-PR 1) --
// Leaders/Bracket/SeriesModal/PowerRankings classes (.lv-leaders-*, .bkt-*,
// .series-modal__*, .pr-*) are still plain CSS via LeagueView.css, migrated
// in later sub-PRs; that file stays imported until the last one.
// LoadingRows/ErrorState/SeasonNotStartedState/ScrollTopButton are shared
// across ALL tabs (not just Standings/Draft), so migrating them here fully
// retires their classes for every tab at once -- later sub-PRs won't need
// to touch them again.
// Several rules involving descendant selectors or CSS-custom-property
// values consumed elsewhere are deliberately kept as real, unlayered CSS in
// LeagueView.css rather than force-fit into Tailwind (same judgment as
// PeriodSummary.css's --team-canvas/--bkt-line patterns): the row-divider
// and "you"-row accent background (.lv-row:not(:last-child) .lv-td,
// .lv-row--you .lv-td, .lv-row--you .lv-td--team). .lv-row/.lv-td/
// .lv-row--you/.lv-td--rank/.lv-td--team are kept as literal marker classes
// on the migrated elements so those rules keep applying -- same pattern as
// TeamView.css's .adv-stat-row/.cap-row.
//
// Generalized property-race check (base + modifier both set the same CSS
// property -- previously found as background-only, now confirmed to also
// hit color/text-align/justify-content elsewhere in this file): found and
// fixed 3 more instances here -- .league-tab/--active (color+background+
// border-color), .lv-filter-btn/--active (color+background+border-color),
// .lv-th/--team (text-align). All split into non-overlapping per-state
// variants, none left in a shared base.
const LEAGUE_VIEW_CLASSES = 'league-view flex flex-col pt-[14px] px-[14px]'
const LEAGUE_CONTENT_CLASSES = 'league-content pb-6'
const LEAGUE_TABS_CLASSES = 'league-tabs flex flex-wrap mb-[14px] pb-[10px] border-b-[0.5px] border-[var(--border)] max-[600px]:flex-nowrap max-[600px]:overflow-x-auto max-[600px]:[-webkit-overflow-scrolling:touch] max-[600px]:[scrollbar-width:none] max-[600px]:gap-1 max-[600px]:[&::-webkit-scrollbar]:hidden'

const LEAGUE_TAB_BASE_CLASSES = 'league-tab py-[6px] px-4 rounded-[20px] text-[13px] font-medium border-[0.5px] flex items-center cursor-pointer [transition:all_0.15s] max-[600px]:shrink-0 max-[600px]:py-[5px] max-[600px]:px-3 max-[600px]:text-[12px]'
const LEAGUE_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-transparent'
const LEAGUE_TAB_ACTIVE_CLASSES = 'league-tab--active text-[color:var(--red-bright)] bg-[var(--red-dim)] border-[var(--red-border)]'
function leagueTabClasses(isActive) {
  return `${LEAGUE_TAB_BASE_CLASSES} ${isActive ? LEAGUE_TAB_ACTIVE_CLASSES : LEAGUE_TAB_INACTIVE_CLASSES}`
}

const LV_FILTER_ROW_CLASSES = 'flex gap-[6px] mb-4 flex-wrap'
const LV_FILTER_BTN_BASE_CLASSES = 'lv-filter-btn text-[12px] py-1 px-[10px] rounded-[var(--radius-sm)] border-[0.5px] cursor-pointer [transition:background_0.1s,color_0.1s]'
const LV_FILTER_BTN_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] bg-transparent border-[var(--border)]'
const LV_FILTER_BTN_ACTIVE_CLASSES = 'lv-filter-btn--active text-[color:var(--text)] bg-[var(--bg2)] border-[var(--border-2)] font-medium'
function lvFilterBtnClasses(isActive) {
  return `${LV_FILTER_BTN_BASE_CLASSES} ${isActive ? LV_FILTER_BTN_ACTIVE_CLASSES : LV_FILTER_BTN_INACTIVE_CLASSES}`
}

const LV_LEGEND_CLASSES = 'lv-legend flex gap-4 mb-[14px] flex-wrap'
const LV_LEGEND_ITEM_CLASSES = 'flex items-center gap-[6px] text-[11px] text-[color:var(--text-dim)]'
const LV_LEGEND_BAR_PLAYOFF_CLASSES = 'w-[3px] h-[14px] rounded-[1px] shrink-0 bg-[var(--green)]'
const LV_LEGEND_BAR_WC_CLASSES = 'w-[3px] h-[14px] rounded-[1px] shrink-0 bg-[#5B8FD4]'

const LV_CONF_SECTION_CLASSES = 'mb-6'
const LV_CONF_LABEL_CLASSES = 'lv-conf-label text-[10px] font-bold text-[color:var(--text-dim)] tracking-[0.08em] uppercase font-[family-name:var(--font-display)] mb-2'
const LV_DIV_GRID_CLASSES = 'grid grid-cols-2 gap-3 max-[600px]:grid-cols-1'
const LV_DIV_CARD_BASE_CLASSES = 'lv-div-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden'
const LV_DIV_CARD_WIDE_CLASSES = '[grid-column:1/-1]'
const LV_DIV_CARD_WC_CLASSES = 'lv-div-card--wc mt-3'
const LV_DIV_CARD_HEADER_CLASSES = 'text-[12px] font-semibold text-[color:var(--text-muted)] py-2 px-3 border-b-[0.5px] border-[var(--border)] bg-[var(--bg2)]'

const LV_TABLE_CLASSES = 'lv-table w-full border-collapse text-[12px]'
const LV_TH_BASE_CLASSES = 'lv-th text-[11px] font-bold text-[color:var(--text-dim)] py-[5px] px-2 border-b-[0.5px] border-[var(--border)] whitespace-nowrap bg-[var(--bg2)]'
const LV_TH_DEFAULT_CLASSES = 'text-right'
const LV_TH_TEAM_CLASSES = 'text-left'
function lvThClasses(isTeam) {
  return `${LV_TH_BASE_CLASSES} ${isTeam ? LV_TH_TEAM_CLASSES : LV_TH_DEFAULT_CLASSES}`
}

// .lv-td (bare, no modifier) is kept as a literal marker purely so
// .lv-row:not(:last-child) .lv-td's real-CSS divider (see file header
// comment) keeps resolving -- it's not itself a Cypress marker.
const LV_TD_SHARED_CLASSES = 'lv-td py-[5px] pr-[4px] whitespace-nowrap'
function lvTdClasses(variant) {
  switch (variant) {
    case 'rank': return `${LV_TD_SHARED_CLASSES} lv-td--rank pl-[4px] text-center text-[11px] min-w-[18px] text-[color:var(--text-dim)] font-sans`
    case 'team': return `${LV_TD_SHARED_CLASSES} lv-td--team pl-[6px] text-left max-w-[90px] text-[color:var(--text)] font-sans`
    case 'pts':  return `${LV_TD_SHARED_CLASSES} pl-[4px] text-right font-bold text-[color:var(--text)] font-[family-name:var(--font-mono)]`
    default:     return `${LV_TD_SHARED_CLASSES} pl-[4px] text-right text-[color:var(--text-muted)] font-[family-name:var(--font-mono)]`
  }
}

const LV_TEAM_CELL_CLASSES = 'flex items-center gap-[5px]'
const LV_TEAM_ABBREV_CLASSES = 'lv-team-abbrev font-[family-name:var(--font-display)] font-bold tracking-[0.02em]'
const LV_CLINCH_BADGE_CLASSES = 'lv-clinch-badge text-[9px] font-medium text-[color:var(--text-dim)] tracking-[0.04em]'

const LV_MAGIC_BADGE_BASE_CLASSES = 'lv-magic-badge text-[9px] font-semibold tracking-[0.02em] py-[1px] px-[3px] rounded-[3px] font-[family-name:var(--font-display)]'
const LV_MAGIC_BADGE_CLINCH_CLASSES = 'lv-magic-badge--clinch text-[color:var(--green)] bg-[color-mix(in_srgb,var(--green)_15%,transparent)]'
const LV_MAGIC_BADGE_ELIM_CLASSES = 'lv-magic-badge--elim text-[color:var(--red-bright)] bg-[color-mix(in_srgb,var(--red-bright)_12%,transparent)]'
function lvMagicBadgeClasses(modifier) {
  return `${LV_MAGIC_BADGE_BASE_CLASSES} ${modifier === 'clinch' ? LV_MAGIC_BADGE_CLINCH_CLASSES : LV_MAGIC_BADGE_ELIM_CLASSES}`
}

// l10-dot--w/-o/-l are built dynamically (`l10-dot--${r}`) in the original
// CSS/JSX -- not literal markers individually (only the bare l10-dot/
// l10-dots base classes are Cypress-required), so no per-suffix literal
// needed here, just the right color per state.
const L10_DOTS_CLASSES = 'l10-dots inline-flex gap-[2px] items-center'
const L10_DOT_BASE_CLASSES = 'l10-dot w-[7px] h-[7px] rounded-full inline-block'
const L10_DOT_W_CLASSES = 'bg-[var(--green)]'
const L10_DOT_O_CLASSES = 'bg-[#5B8FD4]'
const L10_DOT_L_CLASSES = 'bg-[var(--border-2)]'
function l10DotClasses(r) {
  const variant = r === 'w' ? L10_DOT_W_CLASSES : r === 'o' ? L10_DOT_O_CLASSES : L10_DOT_L_CLASSES
  return `${L10_DOT_BASE_CLASSES} ${variant}`
}

const LV_SKELETON_WRAP_CLASSES = 'lv-skeleton-wrap flex flex-col gap-2 py-1'
const LV_SKELETON_ROW_CLASSES = 'h-[14px] bg-[var(--bg2)] rounded-[var(--radius-sm)] animate-[lv-pulse_1.4s_ease-in-out_infinite]'
const LV_ERROR_CLASSES = 'lv-error flex items-center gap-2 text-[13px] text-[color:var(--text-muted)] py-6'
const LV_SEASON_EMPTY_CLASSES = 'lv-season-empty text-[color:var(--text-dim)] text-[13px] py-10 px-4 text-center'

// .lv-empty/.lv-empty-msg are bracket-only in NHL (out of scope, untouched
// literal strings below) -- PWHL reuses them across 4 tabs including
// Standings, migrated there instead.

const LV_SCROLL_TOP_CLASSES = 'fixed bottom-[72px] right-4 z-[200] py-[7px] px-[14px] rounded-[20px] text-[12px] font-semibold text-[color:var(--text-muted)] bg-[var(--bg2,#1e1e1e)] border-[0.5px] border-[var(--border)] cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.4)] [transition:opacity_0.15s,color_0.15s] hover:text-[color:var(--text)] hover:border-[var(--text-dim)]'

// ── Tailwind class constants -- LEADERS (Phase 4, LeagueView.css sub-PR 2) --
// Checked against the same 3 things sub-PR 1 found real issues in: light
// mode (found one real divider needing an override, same shape as the
// Standings one -- .lv-leaders-row--clickable's hover/active white tints
// were considered too, but left alone, matching the rest of the app's
// established pattern of never overriding transient hover states);
// generalized property-race collisions (none found -- .lv-leaders-row base
// sets no background/color that --you/--clickable also set, and
// --clickable's own races are all :hover/:active-pseudo-scoped, which
// lesson #9 already carves out as safe); interpolated-suffix dead-code
// false positives (none -- --you/--clickable are both static ternaries,
// not `` `prefix--${var}` `` interpolation, so nothing to trip up a literal
// grep here).
//
// .lv-leaders-row--you is a DIRECT class on the row (not a descendant
// selector like Standings' .lv-row--you .lv-td), so unlike that one it
// migrates cleanly to a plain Tailwind arbitrary-value utility instead of
// staying real CSS -- the --row-accent custom property it reads is set via
// inline style on the SAME element.
const LV_LEADERS_GRID_CLASSES = 'grid grid-cols-2 gap-3 max-[600px]:grid-cols-1'
const LV_LEADERS_CARD_CLASSES = 'lv-leaders-card bg-[var(--bg1)] border-[0.5px] border-[var(--border)] rounded-[var(--radius)] overflow-hidden'
const LV_LEADERS_CARD_HEADER_CLASSES = 'text-[12px] font-semibold text-[color:var(--text-muted)] py-2 px-3 border-b-[0.5px] border-[var(--border)] bg-[var(--bg2)] flex justify-between items-center'
const LV_LEADERS_CARD_STAT_LABEL_CLASSES = 'font-bold text-[color:var(--text-dim)] text-[11px] font-[family-name:var(--font-display)]'

const LV_LEADERS_ROW_BASE_CLASSES = 'lv-leaders-row flex items-center py-[6px] px-3 text-[12px] border-b-[0.5px] border-[rgba(255,255,255,0.04)] gap-[6px] last:border-b-0'
const LV_LEADERS_ROW_CLICKABLE_CLASSES = 'lv-leaders-row--clickable cursor-pointer [transition:background_0.12s_ease] hover:bg-[rgba(255,255,255,0.05)] hover:rounded-[4px] active:bg-[rgba(255,255,255,0.09)] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-[var(--red-bright)] focus-visible:-outline-offset-[1px] focus-visible:rounded-[4px]'
const LV_LEADERS_ROW_YOU_CLASSES = 'lv-leaders-row--you bg-[color-mix(in_srgb,var(--row-accent,var(--green))_8%,transparent)]'
function lvLeadersRowClasses(isClickable, isYou) {
  const clickable = isClickable ? ` ${LV_LEADERS_ROW_CLICKABLE_CLASSES}` : ''
  const you = isYou ? ` ${LV_LEADERS_ROW_YOU_CLASSES}` : ''
  return `${LV_LEADERS_ROW_BASE_CLASSES}${clickable}${you}`
}

const LV_LEADERS_RANK_CLASSES = 'text-[color:var(--text-dim)] min-w-[16px] text-[11px]'
const LV_LEADERS_NAME_CLASSES = 'lv-leaders-name flex-1 text-[color:var(--text)] whitespace-nowrap overflow-hidden text-ellipsis'
const LV_LEADERS_TEAM_CLASSES = 'lv-leaders-team text-[11px] min-w-[28px] text-right font-[family-name:var(--font-display)] font-bold'
const LV_LEADERS_STAT_CLASSES = 'lv-leaders-stat font-bold text-[color:var(--text)] min-w-[36px] text-right font-[family-name:var(--font-mono)]'

// ── Tailwind class constants -- BRACKET + SERIES MODAL (Phase 4,
// LeagueView.css sub-PR 3) -- tightly-coupled pairing per the original
// split plan (the modal is only ever reachable from a bracket-card click).
//
// Re-checked against the same 3 things: light mode found ONE more real
// spot (.series-modal__game-row:nth-child(even)'s zebra-stripe background,
// same rgba(255,255,255,X)-invisible-on-light shape as every other
// persistent background in this migration -- .bkt-card--clickable's and
// .series-modal__game-row's OWN hover-adjacent tints were considered and
// left alone, matching the established "never override transient hover
// states" pattern). Property-race collisions: confirmed the 2 already
// flagged in the original investigation (.series-modal__team-score/--home
// on justify-content, .series-modal__score/--win on color/font-weight),
// PLUS the already-known .bkt-card/--empty/--primary (background AND
// border -- --primary changes border-width 0.5px->1px too, not just
// color, so border is split out of the base entirely, same treatment),
// PLUS one NEW instance this pass turned up: .bkt-abbr/--dim races on
// `opacity` (base 0.4, --dim 0.3) -- a property this migration hadn't hit
// a race on before. Interpolated-suffix dead-code false positives: none
// -- every modifier here (--empty/--primary/--clickable/--dim/--home/
// --win) is a static ternary/array-join in both JSX files.
//
// --bkt-line (the connector-line custom property, consumed via
// stroke="var(--bkt-line)" on inline SVG lines in both JSX files) and
// .popup-backdrop--centered's mobile-forced-centering override (can't
// safely convert to Tailwind -- .popup-backdrop is a SHARED unlayered
// class used by 13 other files across the app, defined in index.css, and
// per lesson #1 unlayered CSS always beats a layered Tailwind utility
// regardless of specificity) both stay real, unlayered CSS in
// LeagueView.css, untouched by this sub-PR. .bkt-root/.popup-backdrop--
// centered are kept as literal markers on the migrated elements so these
// rules keep applying. Same judgment as lesson #14's row-divider/accent-
// background patterns, just for a shared-global-class collision instead
// of a descendant-selector shape.
//
// .series-modal__header .pp-close's 14px positioning (overriding
// PP_CLOSE_CLASSES's default 12px via the same unlayered-beats-layered
// mechanism) is likewise kept as real CSS -- .series-modal__header stays
// a literal marker for it.
//
// Migrated the NHL Bracket .lv-empty/.lv-empty-msg call site here (the
// only NHL consumer), plus PWHL's now-orphaned Leaders .lv-empty call site
// (sub-PR 2 already shipped and won't revisit it) -- left PWHL's
// PowerRankings .lv-empty call site alone, that tab is still coming up in
// sub-PR 4.
const BKT_CARD_BASE_CLASSES = 'bkt-card w-full rounded-[var(--radius-sm)] p-[6px_8px] box-border'
const BKT_CARD_DEFAULT_CLASSES = 'bg-[var(--bg1)] border-[0.5px] border-[var(--border)]'
const BKT_CARD_PRIMARY_CLASSES = 'bkt-card--primary bg-[var(--bg2)] border'
const BKT_CARD_EMPTY_CLASSES = 'bkt-card--empty bg-transparent border-[0.5px] border-transparent min-h-[56px]'
const BKT_CARD_FINAL_CLASSES = 'bkt-card--final w-[110px]'
const BKT_CARD_CLICKABLE_CLASSES = 'bkt-card--clickable cursor-pointer [transition:background_0.12s_ease,border-color_0.12s_ease] hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-[var(--red-bright)] focus-visible:outline-offset-[1px]'
function bktCardClasses({ variant = 'default', isFinal = false, isClickable = false } = {}) {
  const v = variant === 'empty' ? BKT_CARD_EMPTY_CLASSES : variant === 'primary' ? BKT_CARD_PRIMARY_CLASSES : BKT_CARD_DEFAULT_CLASSES
  const final = isFinal ? ` ${BKT_CARD_FINAL_CLASSES}` : ''
  const clickable = isClickable ? ` ${BKT_CARD_CLICKABLE_CLASSES}` : ''
  return `${BKT_CARD_BASE_CLASSES} ${v}${final}${clickable}`
}

const BKT_ROOT_CLASSES = 'bkt-root w-full overflow-x-auto pb-2'
const BKT_BRACKET_CLASSES = 'bkt-bracket flex items-stretch min-w-[760px]'
const BKT_ROUND_COL_CLASSES = 'bkt-round-col flex-1 flex flex-col min-w-[96px]'
const BKT_ROUND_LABEL_CLASSES = 'bkt-round-label text-[10px] font-bold text-[color:var(--text-dim)] uppercase tracking-[0.07em] text-center px-1 mb-2 whitespace-nowrap font-[family-name:var(--font-display)]'
const BKT_ROUND_SERIES_CLASSES = 'flex flex-col flex-1 justify-around gap-[6px]'
const BKT_SERIES_SLOT_CLASSES = 'flex-1 flex items-center'
const BKT_TEAM_ROW_CLASSES = 'bkt-team-row flex items-center gap-[6px] py-[2px]'

const BKT_ABBR_BASE_CLASSES = 'bkt-abbr font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--text)] min-w-[28px] tracking-[0.02em]'
const BKT_ABBR_DEFAULT_CLASSES = 'opacity-40'
const BKT_ABBR_DIM_CLASSES = 'bkt-abbr--dim opacity-30'
function bktAbbrClasses(isEliminated) {
  return `${BKT_ABBR_BASE_CLASSES} ${isEliminated ? BKT_ABBR_DIM_CLASSES : BKT_ABBR_DEFAULT_CLASSES}`
}
// .bkt-abbr--lit (opacity:1) is confirmed dead -- never applied in either
// JSX file (the non-eliminated branch is just the empty string, not this
// class) -- not migrated.

const BKT_DOTS_CLASSES = 'bkt-dots flex gap-[3px]'
const BKT_DOT_CLASSES = 'bkt-dot w-[7px] h-[7px] rounded-full border border-[var(--border-2)] bg-transparent shrink-0'
// .bkt-dot--won is confirmed dead -- the win-dot fill is applied via
// inline style={{background,borderColor}} using TEAM_COLORS, not this
// class -- not migrated.

const BKT_SERIES_LABEL_CLASSES = 'bkt-series-label text-[9px] text-[color:var(--text-dim)] mt-[3px] whitespace-nowrap overflow-hidden text-ellipsis'
const BKT_CONNECTOR_CLASSES = 'bkt-connector w-5 shrink-0 self-stretch'
const BKT_FINAL_COL_CLASSES = 'bkt-final-col flex-[0_0_130px] flex flex-col items-center'
const BKT_FINAL_CENTER_CLASSES = 'flex-1 flex items-center justify-center'
const BKT_WINNER_LINE_CLASSES = 'bkt-winner-line text-[10px] font-semibold text-[color:var(--text-dim)] font-[family-name:var(--font-display)] mt-[6px] pt-[5px] border-t-[0.5px] border-[var(--border)] tracking-[0.03em]'

const LV_EMPTY_CLASSES = 'py-8 text-center'
const LV_EMPTY_MSG_CLASSES = 'text-[13px] text-[color:var(--text-dim)]'

const SERIES_MODAL_CLASSES = 'series-modal bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-[var(--radius)] p-0 w-[min(420px,92vw)] max-h-[80vh] overflow-y-auto relative max-[600px]:w-[calc(100vw-32px)] max-[600px]:max-h-[85vh]'
const SERIES_MODAL_HEADER_CLASSES = 'series-modal__header flex flex-col items-center gap-[6px] pt-5 px-12 pb-3 border-b-[0.5px] border-[var(--border)] relative'
const SERIES_MODAL_TEAMS_CLASSES = 'flex items-center gap-3'
const SERIES_MODAL_ABBREV_CLASSES = 'series-modal__abbrev font-[family-name:var(--font-display)] text-[22px] font-extrabold tracking-[0.02em] min-w-[44px] text-center'
const SERIES_MODAL_DOTS_WRAP_CLASSES = 'flex flex-col items-center gap-1'
const SERIES_MODAL_DASH_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const SERIES_MODAL_RESULT_CLASSES = 'text-[13px] font-semibold text-[color:var(--text-muted)]'
const SERIES_MODAL_ROUND_LABEL_CLASSES = 'text-[10px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-dim)] text-center pt-2 px-4'
const SERIES_MODAL_GAMES_CLASSES = 'series-modal__games p-[12px_16px_16px] flex flex-col gap-1'
const SERIES_MODAL_LOADING_CLASSES = 'series-modal__loading py-2'
const SERIES_MODAL_EMPTY_CLASSES = 'series-modal__empty text-[13px] text-[color:var(--text-dim)] text-center py-4'
const SERIES_MODAL_GAME_ROW_CLASSES = 'series-modal__game-row grid [grid-template-columns:24px_52px_1fr_16px_1fr_28px] items-center gap-1 p-[7px_8px] rounded-[6px] text-[13px] even:bg-[rgba(255,255,255,0.03)]'
const SERIES_MODAL_GAME_NUM_CLASSES = 'text-[10px] font-bold text-[color:var(--text-dim)] tracking-[0.04em]'
const SERIES_MODAL_GAME_DATE_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'

const SERIES_MODAL_TEAM_SCORE_BASE_CLASSES = 'flex items-center gap-[6px]'
const SERIES_MODAL_TEAM_SCORE_DEFAULT_CLASSES = 'justify-end'
const SERIES_MODAL_TEAM_SCORE_HOME_CLASSES = 'series-modal__team-score--home justify-start'
function seriesModalTeamScoreClasses(isHome) {
  return `${SERIES_MODAL_TEAM_SCORE_BASE_CLASSES} ${isHome ? SERIES_MODAL_TEAM_SCORE_HOME_CLASSES : SERIES_MODAL_TEAM_SCORE_DEFAULT_CLASSES}`
}
const SERIES_MODAL_TEAM_ABBREV_CLASSES = 'font-[family-name:var(--font-display)] text-[12px] tracking-[0.03em]'

const SERIES_MODAL_SCORE_BASE_CLASSES = 'series-modal__score font-[family-name:var(--font-mono)] text-[15px] min-w-[18px] text-center'
const SERIES_MODAL_SCORE_DEFAULT_CLASSES = 'font-medium text-[color:var(--text-muted)]'
const SERIES_MODAL_SCORE_WIN_CLASSES = 'series-modal__score--win font-extrabold text-[color:var(--text)]'
function seriesModalScoreClasses(isWin) {
  return `${SERIES_MODAL_SCORE_BASE_CLASSES} ${isWin ? SERIES_MODAL_SCORE_WIN_CLASSES : SERIES_MODAL_SCORE_DEFAULT_CLASSES}`
}
const SERIES_MODAL_SEPARATOR_CLASSES = 'text-[color:var(--text-dim)] text-center text-[13px]'
const SERIES_MODAL_EXTRA_CLASSES = 'text-[10px] font-bold text-[color:var(--text-dim)] tracking-[0.04em] text-right'

const PRIMARY = TEAM_CONFIG.abbr;

// Season used to be captured here as a module-level const (TEAM_CONFIG.season
// read once at import time) -- that froze at whatever value existed when this
// module first loaded and never picked up the Worker's live season
// resolution landing afterward. Each component below that needs the current
// season now reads it via useSport().currentSeason instead, which IS
// reactive (see SportContext.jsx) since it re-renders on the same
// eyewall:nhl-season-updated event teamConfig.js dispatches.
function seasonLabelFor(season) {
  return `${season.slice(0, 4)}–${season.slice(6)}`;
}

const CLINCH_COLOR = {
  z:   '#1D9E75',
  y:   '#1D9E75',
  x:   '#1D9E75',
  p:   'var(--amber)',
  e:   'var(--red-bright)',
  wc1: '#5B8FD4',
  wc2: '#5B8FD4',
};

// ─── L10 dots ────────────────────────────────────────────────────────────────

function L10Dots({ wins, losses, otl }) {
  const results = [
    ...Array(wins).fill('w'),
    ...Array(otl).fill('o'),
    ...Array(losses).fill('l'),
  ].slice(0, 10);

  return (
    <span className={L10_DOTS_CLASSES} aria-label={`Last 10: ${wins}-${losses}-${otl}`}>
      {results.map((r, i) => (
        <span key={i} className={l10DotClasses(r)} />
      ))}
    </span>
  );
}

// ─── Standings table ──────────────────────────────────────────────────────────

const COL_HEADERS = ['#', 'Team', 'GP', 'W', 'L', 'OTL', 'PTS', 'L10', 'STRK'];

// Once the NHL's own clinchIndicator is populated for a team (live, via
// /cache/standings), it's ground truth and wins outright — see
// eyewall-pipeline's playoff_race.py docstring. Only fall back to our
// nightly-computed magic/tragic numbers pre-clinch/pre-elimination, and
// only show whichever of the two is closer (smaller): that's the team's
// actual near-term storyline — clinching soon, or in real elimination
// danger — rather than showing both and burying the meaningful one.
function magicTragicBadge(seasonData) {
  if (!seasonData) return null;
  const { magicNumber, tragicNumber } = seasonData;
  if (magicNumber == null && tragicNumber == null) return null;
  if (magicNumber != null && (tragicNumber == null || magicNumber <= tragicNumber)) {
    return {
      text:      `M${magicNumber}`,
      title:     `Magic number: ${magicNumber} — combined regulation wins / rival losses needed to clinch a playoff spot`,
      modifier:  'clinch',
    };
  }
  return {
    text:      `E${tragicNumber}`,
    title:     `Elimination number: ${tragicNumber} — combined rival wins / regulation losses until eliminated`,
    modifier:  'elim',
  };
}

function StandingsRow({ entry, rank, teamSeasonData }) {
  const abbrev    = entry.teamAbbrev?.default ?? entry.teamAbbrev;
  const isPrimary = abbrev === PRIMARY;
  const clinchColor = CLINCH_COLOR[entry.clinchIndicator] ?? null;
  const magicBadge  = entry.clinchIndicator ? null : magicTragicBadge(teamSeasonData?.[abbrev]);

  return (
    <tr
      className={`lv-row${isPrimary ? ' lv-row--you' : ''}`}
      style={isPrimary ? { '--row-accent': PRIMARY_COLOR } : undefined}
    >
      <td className={lvTdClasses('rank')}>{rank}</td>
      <td
        className={lvTdClasses('team')}
        style={clinchColor ? { borderLeft: `2.5px solid ${clinchColor}` } : undefined}
      >
        <span className={LV_TEAM_CELL_CLASSES}>
          <span className={LV_TEAM_ABBREV_CLASSES} style={{ color: TEAM_COLORS[abbrev] ?? 'var(--text)' }}>{abbrev}</span>
          {entry.clinchIndicator && (
            <span className={LV_CLINCH_BADGE_CLASSES}>{entry.clinchIndicator.toUpperCase()}</span>
          )}
          {magicBadge && (
            <span className={lvMagicBadgeClasses(magicBadge.modifier)} title={magicBadge.title}>
              {magicBadge.text}
            </span>
          )}
        </span>
      </td>
      <td className={lvTdClasses()}>{entry.gamesPlayed}</td>
      <td className={lvTdClasses()}>{entry.wins}</td>
      <td className={lvTdClasses()}>{entry.losses}</td>
      <td className={lvTdClasses()}>{entry.otLosses}</td>
      <td className={lvTdClasses('pts')}>{entry.points}</td>
      <td className={lvTdClasses()}>
        <L10Dots wins={entry.l10Wins ?? 0} losses={entry.l10Losses ?? 0} otl={entry.l10OtLosses ?? 0} />
      </td>
      <td className={lvTdClasses()}>
        {(() => {
          if (!entry.streakCode || !entry.streakCount) return '—';
          const code = entry.streakCode === 'W' ? 'W' : 'L';
          const color = code === 'W' ? 'var(--green)' : 'var(--red-bright)';
          return <span style={{ color, fontWeight: 600 }}>{code}{entry.streakCount}</span>;
        })()}
      </td>
    </tr>
  );
}

function StandingsTable({ rows, caption, teamSeasonData }) {
  return (
    <table className={LV_TABLE_CLASSES} aria-label={caption}>
      <thead>
        <tr>
          {COL_HEADERS.map((h) => (
            <th key={h} className={lvThClasses(h === 'Team')}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((entry, i) => (
          <StandingsRow key={entry.teamAbbrev?.default ?? i} entry={entry} rank={i + 1} teamSeasonData={teamSeasonData} />
        ))}
      </tbody>
    </table>
  );
}

import { groupByDivision, groupByConference, buildWildCard } from '../utils/leagueUtils';
import { isStandingsStale } from '../utils/standingsUtils';

// ─── Standings Panel ──────────────────────────────────────────────────────────

function StandingsPanel({ entries, teamSeasonData }) {
  const [filter, setFilter] = useState('division');

  const byDivision   = useMemo(() => groupByDivision(entries),  [entries]);
  const byConference = useMemo(() => groupByConference(entries), [entries]);
  const byLeague     = useMemo(() => [...entries].sort((a, b) => a.leagueSequence - b.leagueSequence), [entries]);
  const wildCard     = useMemo(() => buildWildCard(entries),     [entries]);

  const FILTERS = [
    { id: 'division',   label: 'By division' },
    { id: 'conference', label: 'By conference' },
    { id: 'league',     label: 'League' },
    { id: 'wildcard',   label: 'Wild card' },
  ];

  if (entries.length === 0) {
    return <SeasonNotStartedState />;
  }

  return (
    <div>
      <div className={LV_FILTER_ROW_CLASSES} role="group" aria-label="Standings view">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={lvFilterBtnClasses(filter === f.id)}
            onClick={() => { setFilter(f.id); capture('league_standings_filter', { filter: f.id }); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={LV_LEGEND_CLASSES}>
        <span className={LV_LEGEND_ITEM_CLASSES}>
          <span className={LV_LEGEND_BAR_PLAYOFF_CLASSES} /> Clinched / in playoff position
        </span>
        <span className={LV_LEGEND_ITEM_CLASSES}>
          <span className={LV_LEGEND_BAR_WC_CLASSES} /> Wild card position
        </span>
      </div>

      {filter === 'division' && ['Eastern', 'Western'].map((confName) => {
        const divs = Object.entries(byDivision).filter(([, v]) => v.conf === confName);
        return (
          <section key={confName} className={LV_CONF_SECTION_CLASSES}>
            <h3 className={LV_CONF_LABEL_CLASSES}>{confName} Conference</h3>
            <div className={LV_DIV_GRID_CLASSES}>
              {divs.map(([divName, { rows }]) => (
                <div key={divName} className={LV_DIV_CARD_BASE_CLASSES}>
                  <div className={LV_DIV_CARD_HEADER_CLASSES}>{divName}</div>
                  <StandingsTable rows={rows} caption={`${divName} Division standings`} teamSeasonData={teamSeasonData} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {filter === 'conference' && Object.entries(byConference).map(([confName, rows]) => (
        <section key={confName} className={LV_CONF_SECTION_CLASSES}>
          <h3 className={LV_CONF_LABEL_CLASSES}>{confName} Conference</h3>
          <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
            <StandingsTable rows={rows} caption={`${confName} Conference standings`} teamSeasonData={teamSeasonData} />
          </div>
        </section>
      ))}

      {filter === 'league' && (
        <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
          <StandingsTable rows={byLeague} caption="League standings" teamSeasonData={teamSeasonData} />
        </div>
      )}

      {filter === 'wildcard' && Object.entries(wildCard).map(([confName, { divLeaders, wcPool }]) => (
        <section key={confName} className={LV_CONF_SECTION_CLASSES}>
          <h3 className={LV_CONF_LABEL_CLASSES}>{confName} Conference</h3>
          <div className={LV_DIV_GRID_CLASSES}>
            {Object.entries(divLeaders).map(([divName, rows]) => (
              <div key={divName} className={LV_DIV_CARD_BASE_CLASSES}>
                <div className={LV_DIV_CARD_HEADER_CLASSES}>{divName} — Division leaders</div>
                <StandingsTable rows={rows} caption={`${divName} division leaders`} teamSeasonData={teamSeasonData} />
              </div>
            ))}
          </div>
          <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES} ${LV_DIV_CARD_WC_CLASSES}`}>
            <div className={LV_DIV_CARD_HEADER_CLASSES}>Wild card race</div>
            <StandingsTable rows={wcPool} caption={`${confName} wild card`} teamSeasonData={teamSeasonData} />
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Leaders Panel ────────────────────────────────────────────────────────────

function LeadersCard({ title, statLabel, rows, formatStat, onPlayerClick }) {
  return (
    <div className={LV_LEADERS_CARD_CLASSES}>
      <div className={LV_LEADERS_CARD_HEADER_CLASSES}>
        <span>{title}</span>
        <span className={LV_LEADERS_CARD_STAT_LABEL_CLASSES}>{statLabel}</span>
      </div>
      {rows.map((p, i) => {
        const abbrev    = p.teamAbbrev ?? '—';
        const firstName = p.firstName?.default ?? p.name?.split(' ')[0] ?? '—';
        const lastName  = p.lastName?.default  ?? p.name?.split(' ').slice(1).join(' ') ?? '';
        const name      = `${firstName} ${lastName}`.trim();
        const isPrimary = abbrev === PRIMARY;
        const stat      = p.value ?? 0;
        const teamColor = TEAM_COLORS[abbrev] ?? 'var(--text-dim)';
        const pid       = p.playerId ?? p.id ?? null;

        const playerObj = pid ? {
          id:         pid,
          firstName:  { default: firstName },
          lastName:   { default: lastName },
          teamAbbrev: abbrev,
        } : null;

        return (
          <div
            key={pid ?? i}
            className={lvLeadersRowClasses(!!pid, isPrimary)}
            style={isPrimary ? { '--row-accent': PRIMARY_COLOR } : undefined}
            onClick={playerObj ? () => onPlayerClick?.(playerObj) : undefined}
            role={playerObj ? 'button' : undefined}
            tabIndex={playerObj ? 0 : undefined}
            onKeyDown={playerObj ? (e => e.key === 'Enter' && onPlayerClick?.(playerObj)) : undefined}
          >
            <span className={LV_LEADERS_RANK_CLASSES}>{i + 1}</span>
            <span className={LV_LEADERS_NAME_CLASSES}>{name}</span>
            <span className={LV_LEADERS_TEAM_CLASSES} style={{ color: teamColor }}>{abbrev}</span>
            <span className={LV_LEADERS_STAT_CLASSES}>{formatStat ? formatStat(stat) : stat}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeadersPanel({ scoring, goals, gaa, svp }) {
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  const hasAnyData = [scoring, goals, gaa, svp].some((rows) => (rows ?? []).length > 0);
  if (!hasAnyData) {
    return <SeasonNotStartedState>Stat leaders will appear once games begin.</SeasonNotStartedState>;
  }

  return (
    <>
      <div className={LV_LEADERS_GRID_CLASSES}>
        <LeadersCard title="Points"           statLabel="PTS" rows={scoring ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard title="Goals"            statLabel="G"   rows={goals   ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard
          title="Goals against avg."
          statLabel="GAA"
          rows={gaa ?? []}
          formatStat={(v) => Number(v).toFixed(2)}
          onPlayerClick={setSelectedPlayer}
        />
        <LeadersCard
          title="Save percentage"
          statLabel="SV%"
          rows={svp ?? []}
          formatStat={(v) => Number(v).toFixed(3).replace('0.', '.')}
          onPlayerClick={setSelectedPlayer}
        />
      </div>

      {selectedPlayer && (
        <PlayerPopup
          player={selectedPlayer}
          inPlayoffs={false}
          standings={[]}
          onClose={() => setSelectedPlayer(null)}
          isLeagueContext={true}
        />
      )}
    </>
  );
}

// ─── Bracket Panel (Phase 2) ──────────────────────────────────────────────────

// WCAG AA-compliant team display colors, sourced from teamConfig.js (displayColor).
// These are pre-verified to meet ≥4.5:1 contrast on --bg2 (#101827).
const TEAM_COLORS = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t.displayColor]));

// Primary team display color for YOU-row highlights and bracket card accent.
const PRIMARY_COLOR = TEAM_CONFIG.displayColor;

// Last completed playoff bracket — shown during offseason when the API
// returns no data. Verified against the real 2025-26 results (NHL's
// /playoff-series/carousel/20252026) as part of the 2026-27 season flip —
// already accurate, no data change needed. Update again once the 2026-27
// playoffs actually conclude (MP_SEASON no longer exists as a separate
// concept to bump alongside — season resolution is live now, see
// teamConfig.js).
const OFFSEASON_BRACKET = {
  east: [
    { round: 1, series: [
      { top: 'CAR', bottom: 'OTT', topWins: 4, bottomWins: 0 },
      { top: 'PHI', bottom: 'PIT', topWins: 4, bottomWins: 2 },
      { top: 'MTL', bottom: 'TBL', topWins: 4, bottomWins: 3 },
      { top: 'BUF', bottom: 'BOS', topWins: 4, bottomWins: 2 },
    ]},
    { round: 2, series: [
      { top: 'CAR', bottom: 'PHI', topWins: 4, bottomWins: 0 },
      { top: 'MTL', bottom: 'BUF', topWins: 4, bottomWins: 3 },
    ]},
    { round: 3, series: [
      { top: 'CAR', bottom: 'MTL', topWins: 4, bottomWins: 1 },
    ]},
  ],
  west: [
    { round: 1, series: [
      { top: 'VGK', bottom: 'UTA', topWins: 4, bottomWins: 2 },
      { top: 'ANA', bottom: 'EDM', topWins: 4, bottomWins: 2 },
      { top: 'MIN', bottom: 'DAL', topWins: 4, bottomWins: 2 },
      { top: 'COL', bottom: 'LAK', topWins: 4, bottomWins: 0 },
    ]},
    { round: 2, series: [
      { top: 'VGK', bottom: 'ANA', topWins: 4, bottomWins: 2 },
      { top: 'COL', bottom: 'MIN', topWins: 4, bottomWins: 1 },
    ]},
    { round: 3, series: [
      { top: 'VGK', bottom: 'COL', topWins: 4, bottomWins: 0 },
    ]},
  ],
  final: { top: 'CAR', bottom: 'VGK', topWins: 4, bottomWins: 2 },
};


/**
 * Normalise one raw series from either known NHL API shape into
 *   { top, bottom, topWins, bottomWins }
 *
 * Shape A: { topSeedTeam, bottomSeedTeam, topSeedWins, bottomSeedWins }
 * Shape B: { matchupTeams: [{ team: { abbrev }, wins }, ...] }
 */
function normaliseSeries(raw) {
  if (!raw) return null;
  if (Array.isArray(raw.matchupTeams)) {
    const [a, b] = raw.matchupTeams;
    return {
      top:        a?.team?.abbrev ?? a?.team ?? '—',
      bottom:     b?.team?.abbrev ?? b?.team ?? '—',
      topWins:    a?.wins ?? 0,
      bottomWins: b?.wins ?? 0,
    };
  }
  return {
    top:        raw.topSeedTeam?.abbrev    ?? raw.topSeedTeam?.default    ?? raw.topSeedTeam    ?? '—',
    bottom:     raw.bottomSeedTeam?.abbrev ?? raw.bottomSeedTeam?.default ?? raw.bottomSeedTeam ?? '—',
    topWins:    raw.topSeedWins    ?? 0,
    bottomWins: raw.bottomSeedWins ?? 0,
  };
}

/**
 * Parse NHL API bracketData into { east, west, final }.
 * Logs raw shape in dev so you can verify field names on first load.
 * Returns null if shape is unrecognised or data is absent (offseason empty state).
 */
function parseBracketData(raw) {
  if (!raw) return null;
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[BracketPanel] bracketData shape:', JSON.stringify(raw, null, 2));
  }
  try {
    if (!Array.isArray(raw.rounds)) return null;
    const east = [];
    const west = [];
    let final  = null;

    raw.rounds.forEach((round) => {
      const r = round.roundNumber ?? round.round;
      if (r === 4) {
        final = normaliseSeries(round.series?.[0]);
        return;
      }
      const eastSeries = [];
      const westSeries = [];
      (round.series ?? []).forEach((s) => {
        const norm = normaliseSeries(s);
        const conf = (s.conference?.abbrev ?? s.conferenceAbbrev ?? '').toUpperCase();
        // Assign by conference abbrev; fall back to East if unknown
        if (conf.startsWith('W')) westSeries.push(norm);
        else eastSeries.push(norm);
      });
      if (eastSeries.length) east.push({ round: r, series: eastSeries });
      if (westSeries.length) west.push({ round: r, series: westSeries });
    });

    if (east.length || west.length || final) return { east, west, final };
    return null;
  } catch {
    return null;
  }
}

// ── Dot row ──

function WinDots({ wins, color }) {
  return (
    <span className={BKT_DOTS_CLASSES} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={BKT_DOT_CLASSES}
          style={i < wins && color ? { background: color, borderColor: color } : undefined}
        />
      ))}
    </span>
  );
}

// ── Series card ──

function TeamAbbr({ abbrev, _isWinner, isEliminated }) {
  const color = TEAM_COLORS[abbrev];
  return (
    <span
      className={bktAbbrClasses(isEliminated)}
      style={!isEliminated && color ? { color } : undefined}
    >
      {abbrev}
    </span>
  );
}

function SeriesCard({ series, onSeriesClick }) {
  if (!series) return <div className={bktCardClasses({ variant: 'empty' })} />;

  const { top, bottom, topWins, bottomWins } = series;
  const isPrimary  = top === PRIMARY || bottom === PRIMARY;
  const isComplete = topWins === 4 || bottomWins === 4;
  const hasGames   = topWins + bottomWins > 0;
  const dash       = '\u2013';

  let label = null;
  if (hasGames) {
    if      (topWins    === 4)          label = `${top} wins 4${dash}${bottomWins}`;
    else if (bottomWins === 4)          label = `${bottom} wins 4${dash}${topWins}`;
    else if (topWins    === bottomWins) label = `Tied ${topWins}${dash}${bottomWins}`;
    else if (topWins    >  bottomWins)  label = `${top} leads ${topWins}${dash}${bottomWins}`;
    else                                label = `${bottom} leads ${bottomWins}${dash}${topWins}`;
  }

  return (
    <div
      className={bktCardClasses({ variant: isPrimary ? 'primary' : 'default', isClickable: hasGames })}
      style={isPrimary ? { borderColor: PRIMARY_COLOR } : undefined}
      onClick={hasGames && onSeriesClick ? () => onSeriesClick(series) : undefined}
      role={hasGames && onSeriesClick ? 'button' : undefined}
      tabIndex={hasGames && onSeriesClick ? 0 : undefined}
      onKeyDown={hasGames && onSeriesClick ? (e => e.key === 'Enter' && onSeriesClick(series)) : undefined}
    >
      <div className={BKT_TEAM_ROW_CLASSES}>
        <TeamAbbr abbrev={top} isEliminated={isComplete && topWins !== 4} />
        <WinDots wins={topWins} color={TEAM_COLORS[top]} />
      </div>
      <div className={BKT_TEAM_ROW_CLASSES}>
        <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
        <WinDots wins={bottomWins} color={TEAM_COLORS[bottom]} />
      </div>
      {label && <div className={BKT_SERIES_LABEL_CLASSES}>{label}</div>}
    </div>
  );
}

// ── Connector SVG (scales with flex height via preserveAspectRatio="none") ──

function Connector({ count, direction, straight }) {
  // straight=true: single horizontal line (used for Conf Finals ↔ Cup Final)
  // otherwise: bracket pairs — each slot is a notional 100-unit height
  const xIn  = direction === 'left' ? 20 : 0;
  const xOut = direction === 'left' ? 0  : 20;
  const xMid = 10;
  const stroke = 'var(--bkt-line)';
  const sw = '1';

  if (straight) {
    return (
      <svg
        className={BKT_CONNECTOR_CLASSES}
        viewBox="0 0 20 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1={xIn} y1={50} x2={xOut} y2={50} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }

  const pairs = Math.ceil(count / 2);
  const totalH = count * 100;

  return (
    <svg
      className={BKT_CONNECTOR_CLASSES}
      viewBox={`0 0 20 ${totalH}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {Array.from({ length: pairs }).map((_, i) => {
        const topY = i * 2 * 100 + 50;
        const botY = (i * 2 + 1) * 100 + 50;
        const midY = (topY + botY) / 2;
        return (
          <g key={i}>
            <line x1={xIn}  y1={topY} x2={xMid} y2={topY} stroke={stroke} strokeWidth={sw} />
            <line x1={xIn}  y1={botY} x2={xMid} y2={botY} stroke={stroke} strokeWidth={sw} />
            <line x1={xMid} y1={topY} x2={xMid} y2={botY} stroke={stroke} strokeWidth={sw} />
            <line x1={xMid} y1={midY} x2={xOut} y2={midY} stroke={stroke} strokeWidth={sw} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Round column ──

const ROUND_LABELS = { 1: 'First round', 2: 'Second round', 3: 'Conf. finals' };

function RoundCol({ round, label, onSeriesClick }) {
  return (
    <div className={BKT_ROUND_COL_CLASSES}>
      <div className={BKT_ROUND_LABEL_CLASSES}>{label ?? ROUND_LABELS[round.round] ?? `Round ${round.round}`}</div>
      <div className={BKT_ROUND_SERIES_CLASSES}>
        {round.series.map((s, i) => (
          <div key={i} className={BKT_SERIES_SLOT_CLASSES}>
            <SeriesCard series={s} onSeriesClick={onSeriesClick} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cup Final center ──

function CupFinalCol({ series, onSeriesClick }) {
  if (!series) return null;
  const { top, bottom, topWins, bottomWins } = series;
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;
  const isComplete  = topWins === 4 || bottomWins === 4;
  const hasGames    = topWins + bottomWins > 0;

  return (
    <div className={BKT_FINAL_COL_CLASSES}>
      <div className={BKT_ROUND_LABEL_CLASSES}>Stanley Cup Final</div>
      <div className={BKT_FINAL_CENTER_CLASSES}>
        <div
          className={bktCardClasses({ isFinal: true, isClickable: hasGames })}
          onClick={hasGames && onSeriesClick ? () => onSeriesClick(series) : undefined}
          role={hasGames && onSeriesClick ? 'button' : undefined}
          tabIndex={hasGames && onSeriesClick ? 0 : undefined}
          onKeyDown={hasGames && onSeriesClick ? (e => e.key === 'Enter' && onSeriesClick(series)) : undefined}
        >
          <div className={BKT_TEAM_ROW_CLASSES}>
            <TeamAbbr abbrev={top} isEliminated={isComplete && topWins !== 4} />
            <WinDots wins={topWins} color={TEAM_COLORS[top]} />
          </div>
          <div className={BKT_TEAM_ROW_CLASSES}>
            <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
            <WinDots wins={bottomWins} color={TEAM_COLORS[bottom]} />
          </div>
          {winner && (
            <div className={BKT_WINNER_LINE_CLASSES} style={{ color: TEAM_COLORS[winner] ?? 'var(--text)' }}>
              {winner} champion 🏆
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Series Modal ──

function SeriesModal({ series, carouselRounds, season, onClose }) {
  const { top, bottom, topWins, bottomWins } = series;
  const dash = '\u2013';

  // Find matching series in carousel to get seriesLetter + roundNumber
  const carouselSeries = React.useMemo(() => {
    if (!carouselRounds?.length) return null;
    for (const round of carouselRounds) {
      for (const s of (round.series || [])) {
        const a = s.topSeed?.abbrev;
        const b = s.bottomSeed?.abbrev;
        if ((a === top && b === bottom) || (a === bottom && b === top) ||
            (a === top && b === bottom) || (b === top && a === bottom)) {
          return { ...s, roundNumber: round.roundNumber };
        }
      }
    }
    return null;
  }, [carouselRounds, top, bottom]);

  const seriesLetter = carouselSeries?.seriesLetter ?? null;
  const roundNumber  = carouselSeries?.roundNumber  ?? null;

  const { data: games, loading: gamesLoading } = useFetch(
    () => seriesLetter && roundNumber
      ? getPlayoffSeriesGames(season, seriesLetter, roundNumber)
      : Promise.resolve([]),
    [seriesLetter, roundNumber, season]
  );

  const topColor    = TEAM_COLORS[top]    ?? 'var(--text)';
  const bottomColor = TEAM_COLORS[bottom] ?? 'var(--text)';
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function periodLabel(periodType) {
    if (periodType === 'OT')  return 'OT';
    if (periodType === 'SO')  return 'SO';
    return '';
  }

  return (
    <div className="popup-backdrop popup-backdrop--centered" onClick={onClose}>
      <div className={SERIES_MODAL_CLASSES} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={SERIES_MODAL_HEADER_CLASSES}>
          <div className={SERIES_MODAL_TEAMS_CLASSES}>
            <span className={SERIES_MODAL_ABBREV_CLASSES} style={{ color: topColor }}>{top}</span>
            <div className={SERIES_MODAL_DOTS_WRAP_CLASSES}>
              <WinDots wins={topWins} color={topColor} />
              <span className={SERIES_MODAL_DASH_CLASSES}>{dash}</span>
              <WinDots wins={bottomWins} color={bottomColor} />
            </div>
            <span className={SERIES_MODAL_ABBREV_CLASSES} style={{ color: bottomColor }}>{bottom}</span>
          </div>
          {winner && (
            <div className={SERIES_MODAL_RESULT_CLASSES} style={{ color: TEAM_COLORS[winner] }}>
              {winner} wins 4{dash}{winner === top ? bottomWins : topWins} 🏆
            </div>
          )}
          {!winner && topWins + bottomWins > 0 && (
            <div className={SERIES_MODAL_RESULT_CLASSES}>
              {topWins > bottomWins ? `${top} leads` : topWins < bottomWins ? `${bottom} leads` : 'Tied'} {Math.max(topWins, bottomWins)}{dash}{Math.min(topWins, bottomWins)}
            </div>
          )}
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label="Close series">✕</button>
        </div>

        {/* Round label */}
        {carouselSeries && (
          <div className={SERIES_MODAL_ROUND_LABEL_CLASSES}>
            {carouselSeries.seriesLabel ?? `Series ${seriesLetter}`}
          </div>
        )}

        {/* Game-by-game */}
        <div className={SERIES_MODAL_GAMES_CLASSES}>
          {gamesLoading && (
            <div className={SERIES_MODAL_LOADING_CLASSES}>
              {[70, 85, 70, 85].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 32, width: `${w}%`, marginBottom: 6, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {!gamesLoading && games?.length === 0 && (
            <div className={SERIES_MODAL_EMPTY_CLASSES}>Game data unavailable for this series.</div>
          )}

          {!gamesLoading && games?.map((g, i) => {
            const awayWon = g.awayScore > g.homeScore;
            const homeWon = g.homeScore > g.awayScore;
            const extra   = periodLabel(g.periodType);
            const awayColor = TEAM_COLORS[g.awayAbbrev] ?? 'var(--text)';
            const homeColor = TEAM_COLORS[g.homeAbbrev] ?? 'var(--text)';
            return (
              <div key={g.gameId} className={SERIES_MODAL_GAME_ROW_CLASSES}>
                <span className={SERIES_MODAL_GAME_NUM_CLASSES}>G{i + 1}</span>
                <span className={SERIES_MODAL_GAME_DATE_CLASSES}>{fmtDate(g.gameDate)}</span>
                <span className={seriesModalTeamScoreClasses(false)}>
                  <span className={SERIES_MODAL_TEAM_ABBREV_CLASSES} style={{ color: awayColor, fontWeight: awayWon ? 700 : 400 }}>{g.awayAbbrev}</span>
                  <span className={seriesModalScoreClasses(awayWon)}>{g.awayScore}</span>
                </span>
                <span className={SERIES_MODAL_SEPARATOR_CLASSES}>–</span>
                <span className={seriesModalTeamScoreClasses(true)}>
                  <span className={seriesModalScoreClasses(homeWon)}>{g.homeScore}</span>
                  <span className={SERIES_MODAL_TEAM_ABBREV_CLASSES} style={{ color: homeColor, fontWeight: homeWon ? 700 : 400 }}>{g.homeAbbrev}</span>
                </span>
                {extra && <span className={SERIES_MODAL_EXTRA_CLASSES}>{extra}</span>}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// ── Main BracketPanel ──

function BracketPanel({ data }) {
  const { currentSeason: SEASON } = useSport();
  const [selectedSeries, setSelectedSeries] = useState(null);

  const bracket = useMemo(() => {
    return parseBracketData(data) ?? OFFSEASON_BRACKET;
  }, [data]);

  // Fetch carousel for seriesLetter lookup — only when bracket tab is active
  const { data: carouselRounds } = useFetch(
    () => getPlayoffSeries(SEASON),
    [SEASON]
  );

  if (!bracket) {
    return (
      <div className={LV_EMPTY_CLASSES}>
        <p className={LV_EMPTY_MSG_CLASSES}>Playoff bracket will appear here once the postseason begins.</p>
      </div>
    );
  }

  const { east, west, final } = bracket;

  return (
    <>
      <div className={BKT_ROOT_CLASSES}>
        <div className={BKT_BRACKET_CLASSES}>

          {/* East rounds — left side, connectors flow right */}
          {east.map((round, ri) => (
            <React.Fragment key={`e${ri}`}>
              <RoundCol round={round} onSeriesClick={setSelectedSeries} />
              {ri < east.length - 1 && (
                <Connector count={round.series.length} direction="right" />
              )}
            </React.Fragment>
          ))}

          {/* Connector: Conf Finals → Cup Final (straight horizontal) */}
          <Connector count={1} direction="right" straight />

          {/* Cup Final */}
          <CupFinalCol series={final} onSeriesClick={setSelectedSeries} />

          {/* Connector: Cup Final → Conf Finals (straight horizontal) */}
          <Connector count={1} direction="left" straight />

          {/* West rounds — right side, reversed so deepest round is innermost */}
          {[...west].reverse().map((round, ri) => {
            const originalIndex = west.length - 1 - ri;
            return (
              <React.Fragment key={`w${originalIndex}`}>
                {ri > 0 && (
                  <Connector count={round.series.length} direction="left" />
                )}
                <RoundCol round={round} onSeriesClick={setSelectedSeries} />
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {selectedSeries && (
        <SeriesModal
          series={selectedSeries}
          carouselRounds={carouselRounds}
          season={SEASON}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className={LV_SKELETON_WRAP_CLASSES} aria-busy="true" aria-label="Loading">
      {[85, 90, 85, 95, 85, 90, 85, 90].map((w, i) => (
        <div key={i} className={LV_SKELETON_ROW_CLASSES} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className={LV_ERROR_CLASSES}>
      <span>⚠</span>
      <p>{message ?? 'Something went wrong. Try refreshing.'}</p>
    </div>
  );
}

// Shared across Standings, Stats Leaders, and Power Rankings — all three go
// blank once the season is live-flipped but before any games have been
// played (rosters/schedule exist, but standings/stats/rankings genuinely
// have zero rows). Distinct from ErrorState: this isn't a failure, so no
// warning icon and a calmer tone.
function SeasonNotStartedState({ children }) {
  const { currentSeason } = useSport();
  return (
    <div className={LV_SEASON_EMPTY_CLASSES}>
      <p>{children ?? `The ${seasonLabelFor(currentSeason)} season hasn't started yet — check back once games begin.`}</p>
    </div>
  );
}

// ─── Power Rankings ───────────────────────────────────────────────────────────

/**
 * Rank all 32 teams using five weighted, normalised components plus a
 * roster talent prior (WAR) that tapers off as the season progresses.
 *
 * Components (full season, alpha = 1.0):
 *   Points %       25%  — season-long win rate
 *   L10 points %   25%  — recent form (drives weekly movement)
 *   Goal diff/GP   20%  — scoring margin strength
 *   5v5 xGF%       20%  — true possession quality (MoneyPuck, nightly)
 *   Special teams  10%  — avg of PP% and PK%
 *
 * Roster WAR blending (early season):
 *   alpha = min(maxGP / 20, 1.0) — reaches 1.0 by game 20
 *   rosterWeight = 0.15 * (1 - alpha) — tapers from 15% → 0%
 *   Other weights scale proportionally to fill the remaining 85%→100%.
 */
function computePowerRankings(standings, xgData) {
  if (!standings?.length) return [];

  const maxGP = Math.max(...standings.map(t => t.gamesPlayed || 0));
  const alpha = Math.min(maxGP / 20, 1.0);
  const wWar  = 0.15 * (1 - alpha);
  const scale = 1 - wWar;

  const W = {
    pts: 0.25 * scale,
    l10: 0.25 * scale,
    gd:  0.20 * scale,
    xgf: 0.20 * scale,
    sp:  0.10 * scale,
    war: wWar,
  };

  const teams = standings.map(t => {
    const abbr = t.teamAbbrev?.default ?? t.teamAbbrev;
    const gp   = t.gamesPlayed || 1;

    const l10w  = t.l10Wins     ?? 0;
    const l10l  = t.l10Losses   ?? 0;
    const l10ot = t.l10OtLosses ?? 0;
    const l10gp = (l10w + l10l + l10ot) || 10;

    const rawPp = t.powerPlayPct   ?? t.ppPct ?? 0;
    const rawPk = t.penaltyKillPct ?? t.pkPct ?? 0;
    const ppPct = rawPp > 1 ? rawPp / 100 : rawPp;
    const pkPct = rawPk > 1 ? rawPk / 100 : rawPk;

    return {
      abbr,
      gp,
      wins:      t.wins     ?? 0,
      losses:    t.losses   ?? 0,
      otLosses:  t.otLosses ?? 0,
      ptsPct:    (t.points ?? 0) / (gp * 2),
      l10PtsPct: ((l10w * 2) + l10ot) / (l10gp * 2),
      gdPG:      ((t.goalFor ?? t.goalsFor ?? 0) - (t.goalAgainst ?? t.goalsAgainst ?? 0)) / gp,
      xgfPct:    xgData?.[abbr]?.xgfPct    ?? null,
      rosterWar: xgData?.[abbr]?.rosterWar ?? null,
      spPct:     (ppPct + pkPct) / 2,
      ppPct,
      pkPct,
      l10: `${l10w}-${l10l}-${l10ot}`,
    };
  });

  function normalise(key) {
    const vals  = teams.map(t => t[key]).filter(v => v != null);
    if (!vals.length) return () => 0.5;
    const min   = Math.min(...vals);
    const range = Math.max(...vals) - min || 1;
    return (v) => v == null ? 0.5 : (v - min) / range;
  }

  const normPts = normalise('ptsPct');
  const normL10 = normalise('l10PtsPct');
  const normGD  = normalise('gdPG');
  const normXGF = normalise('xgfPct');
  const normSP  = normalise('spPct');
  const normWar = normalise('rosterWar');

  // Per-component league rank for display (1 = best)
  function leagueRank(key) {
    const sorted = [...teams].sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
    const map = {};
    sorted.forEach((t, i) => { map[t.abbr] = i + 1; });
    return map;
  }
  const rankPts = leagueRank('ptsPct');
  const rankL10 = leagueRank('l10PtsPct');
  const rankGD  = leagueRank('gdPG');
  const rankXGF = leagueRank('xgfPct');
  const rankSP  = leagueRank('spPct');

  return teams
    .map(t => ({
      ...t,
      score:
        normPts(t.ptsPct)    * W.pts +
        normL10(t.l10PtsPct) * W.l10 +
        normGD(t.gdPG)       * W.gd  +
        normXGF(t.xgfPct)    * W.xgf +
        normSP(t.spPct)      * W.sp  +
        normWar(t.rosterWar) * W.war,
      leagueRanks: {
        pts: rankPts[t.abbr],
        l10: rankL10[t.abbr],
        gd:  rankGD[t.abbr],
        xgf: rankXGF[t.abbr],
        sp:  rankSP[t.abbr],
      },
    }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}

// ─── Movement arrow ───────────────────────────────────────────────────────────

function MovementArrow({ current, prior }) {
  if (prior == null) return null;
  const diff = prior - current; // positive = moved up
  if (diff === 0) return <span className="pr-mvmt pr-mvmt--flat">—</span>;
  if (diff > 0)   return <span className="pr-mvmt pr-mvmt--up">▲{diff}</span>;
  return              <span className="pr-mvmt pr-mvmt--down">▼{Math.abs(diff)}</span>;
}

// ─── Rank Sparkline ───────────────────────────────────────────────────────────

function RankSparkline({ history, primaryColor }) {
  if (!history?.length) {
    return (
      <div className="pr-sparkline-empty">
        <span>Rank trend data accumulates nightly</span>
      </div>
    );
  }

  // Single point: no trend to show, no line/area -- Sparkline centers a dot.
  const single = history.length === 1;
  const latest   = history[history.length - 1];
  const earliest = history[0];
  const diff     = single ? 0 : earliest.rank - latest.rank;

  const trendColor = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red-bright)' : 'var(--text-dim)';
  const trendLabel = single ? null
    : diff === 0 ? '—'
    : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="pr-sparkline" style={{ minWidth: 140 }}>
      <div className="pr-sparkline-header">
        <span className="pr-sparkline-label">Rank trend</span>
        {trendLabel && (
          <span className="pr-sparkline-trend" style={{ color: trendColor }}>
            {trendLabel}
            <span className="pr-sparkline-period"> ({history.length}d)</span>
          </span>
        )}
      </div>
      <Sparkline
        className="pr-sparkline-svg"
        points={history.map(r => ({ value: r.rank }))}
        color={primaryColor}
        width={240} height={80} padding={16}
        invertY // lower rank number (better) plots higher on the chart
        showEndpoints
        formatEndpointLabel={v => `#${v}`}
      />
      <div className="pr-sparkline-dates">
        <span>{fmtDate(earliest.generated_date)}</span>
        {!single && <span>{fmtDate(latest.generated_date)}</span>}
      </div>
    </div>
  );
}

// ─── Rankings Panel ───────────────────────────────────────────────────────────

function RankingsPanel({ standings, standingsLoading, xgData, xgLoading, narrative, history }) {
  const [showHow,    setShowHow]    = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const ranked  = computePowerRankings(standings, xgData);
  // standingsLoading/xgLoading in flight vs. fetch done but genuinely zero
  // rows (season live-flipped, no games played yet) are different states —
  // conflating them here used to mean an empty season showed this loading
  // skeleton forever instead of a "not started yet" message.
  const loading = standingsLoading || xgLoading;
  const empty   = !loading && !standings?.length;

  // Find this team's rank + prior for movement
  const myData    = ranked.find(t => t.abbr === PRIMARY);
  const priorRank = narrative?.prior_rank ?? null;

  const xCaption = [
    `${PRIMARY} Power Rankings — #${myData?.rank ?? '?'} in the NHL`,
    narrative?.narrative || '',
    `#${PRIMARY} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n');

  const { saving, sharing, handleSave, handleShareX, handleNativeShare, canNativeShare } =
    useShareCard({
      canvasRef:  { current: null }, // power rankings uses getElementById
      filename: `EyeWall-PowerRankings-${PRIMARY}.png`,
      xCaption,
      mountCanvas: async () => {
        if (!canvasMounted) {
          setCanvasMounted(true);
          await new Promise(r => setTimeout(r, 120));
        }
        // Override canvasRef.current after mount
      },
      getNode: () => document.getElementById('pr-export-canvas'),
    });

  const handleSaveWithCapture = async () => {
    await handleSave();
    capture('power_rankings_card_exported', { team: PRIMARY, rank: myData?.rank });
  };

  if (loading) {
    return (
      <div className="lv-skeleton-wrap" aria-busy="true">
        {[85, 90, 85, 95, 85, 90, 85, 90, 85, 95].map((w, i) => (
          <div key={i} className="lv-skeleton-row" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (empty) {
    return <SeasonNotStartedState>Power rankings will appear once games begin.</SeasonNotStartedState>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Narrative + sparkline card — shows when either exists */}
      {(narrative?.narrative || history?.length) ? (
        <div className="lv-div-card lv-div-card--wide pr-narrative-card" style={{ marginTop: 4 }}>
          <div className="pr-narrative-card-top">
            {narrative?.narrative && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pr-narrative-label">⚡ EyeWall AI — {PRIMARY} Rankings Report</div>
                <p className="pr-narrative-text">{narrative.narrative}</p>
                {narrative.generated_date && (
                  <span className="pr-narrative-date">
                    Updated {new Date(narrative.generated_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            <RankSparkline history={history} primaryColor={PRIMARY_COLOR} />
          </div>
        </div>
      ) : null}

      {/* Rankings table */}
      <div className="lv-div-card lv-div-card--wide">
        <div className="pr-table-header-row">
          <span className="pr-col-rank">#</span>
          <span className="pr-col-mvmt" />
          <span className="pr-col-team">Team</span>
          <span className="pr-col-stat">Pts%</span>
          <span className="pr-col-stat">L10</span>
          <span className="pr-col-stat">xGF%</span>
          <span className="pr-col-stat">GD/GP</span>
        </div>

        {ranked.map(t => {
          const isPrimary = t.abbr === PRIMARY;
          // Show movement arrow only for the primary team (we only have their prior rank)
          const showArrow = isPrimary && priorRank != null;
          return (
            <div
              key={t.abbr}
              className={`pr-row${isPrimary ? ' pr-row--you' : ''}`}
              style={isPrimary ? {
                '--row-accent': PRIMARY_COLOR,
                borderLeft: `3px solid ${PRIMARY_COLOR}`,
                background: `color-mix(in srgb, ${PRIMARY_COLOR} 8%, var(--surface))`,
              } : {}}
            >
              <span className="pr-col-rank">
                <span className={`pr-rank-num${t.rank <= 8 ? ' pr-rank--top' : t.rank >= 25 ? ' pr-rank--bot' : ''}`}>
                  {t.rank}
                </span>
              </span>
              <span className="pr-col-mvmt">
                {showArrow && <MovementArrow current={t.rank} prior={priorRank} />}
              </span>
              <span className="pr-col-team">
                <TeamLogo abbr={t.abbr} size={16} />
                <span className="pr-abbr" style={{ color: TEAM_COLORS[t.abbr] ?? 'var(--text)' }}>
                  {t.abbr}
                </span>
              </span>
              <span className="pr-col-stat">{(t.ptsPct * 100).toFixed(1)}%</span>
              <span className="pr-col-stat">{t.l10}</span>
              <span className="pr-col-stat">
                {t.xgfPct != null ? `${(t.xgfPct * 100).toFixed(1)}%` : '—'}
              </span>
              <span className={`pr-col-stat${t.gdPG > 0 ? ' pr-gd--pos' : t.gdPG < 0 ? ' pr-gd--neg' : ''}`}>
                {t.gdPG > 0 ? '+' : ''}{t.gdPG.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Export / share */}
      <ShareButtons
        onSave={handleSaveWithCapture}
        onShareX={handleShareX}
        onNativeShare={handleNativeShare}
        canNativeShare={canNativeShare}
        saving={saving}
        sharing={sharing || !myData}
      />

      {/* How is this calculated? */}
      <div className="lv-div-card lv-div-card--wide">
        <button className="pr-how-toggle" onClick={() => setShowHow(v => !v)} aria-expanded={showHow}>
          <span>How is this calculated?</span>
          <span className="pr-how-chevron">{showHow ? '▲' : '▼'}</span>
        </button>

        {showHow && (
          <div className="pr-how-body">
            <p className="pr-how-text">
              Rankings are computed from five components plus a roster talent prior
              that tapers off as the season progresses. Each component is normalised
              relative to the rest of the league (best team = 1.0, worst = 0.0) before
              weighting, so rankings reflect where a team stands <em>right now</em>.
            </p>

            {[
              {
                label: 'Points %', weight: '25%',
                desc: 'Points earned divided by maximum possible (games played × 2). The primary measure of season-long success.',
                source: 'NHL standings',
              },
              {
                label: 'L10 Points %', weight: '25%',
                desc: 'Same formula applied to the last 10 games only. This is what moves rankings week to week — a hot team climbs, a cold team falls regardless of earlier results.',
                source: 'NHL standings',
              },
              {
                label: 'Goal Differential / GP', weight: '20%',
                desc: 'Goals scored minus goals allowed per game. Teams that win convincingly rank higher than teams that constantly squeak by one goal.',
                source: 'NHL standings',
              },
              {
                label: '5v5 xGF%', weight: '20%',
                desc: 'Expected goals for % at even strength — the share of shot quality a team generates versus allows at 5-on-5. Filters out goaltending and shooting luck that inflate or deflate raw goal totals.',
                source: 'MoneyPuck (updated nightly)',
              },
              {
                label: 'Special Teams', weight: '10%',
                desc: 'Average of power play % and penalty kill %. Weighted lower than even-strength play because special teams frequency and opponent quality vary.',
                source: 'NHL standings',
              },
              {
                label: 'Roster WAR', weight: '0–15%',
                desc: 'Sum of the top-18 skaters\' Wins Above Replacement plus the starter\'s Goals Saved Above Expected. Weighted at 15% at game 0, tapering to 0% by game 20. Ensures pre-season and early-season rankings reflect roster quality rather than a handful of fluky results.',
                source: 'MoneyPuck / EyeWall RAPM model (updated nightly)',
              },
            ].map(c => (
              <div key={c.label} className="pr-how-item">
                <div className="pr-how-item-header">
                  <span className="pr-how-item-label">{c.label}</span>
                  <span className="pr-how-weight">{c.weight}</span>
                </div>
                <p className="pr-how-text">{c.desc}</p>
                <span className="pr-how-source">Source: {c.source}</span>
              </div>
            ))}

            <p className="pr-how-text" style={{ marginTop: 4 }}>
              xGF% and Roster WAR show <em>—</em> until the first nightly pipeline
              run populates them. All other components still produce a valid rank.
            </p>
          </div>
        )}
      </div>

      {/* Off-screen export canvas */}
      {canvasMounted && myData && (
        <PowerRankingsCanvas
          ranked={ranked}
          myTeam={myData}
          priorRank={priorRank}
          narrative={narrative?.narrative ?? null}
          primaryColor={PRIMARY_COLOR}
        />
      )}
    </div>
  );
}

// ─── Power Rankings Export Canvas (1080×1080, off-screen) ────────────────────

function PowerRankingsCanvas({ ranked, myTeam, priorRank, narrative, primaryColor }) {
  const logoUrl = abbr => `/nhl-assets/logos/nhl/svg/${abbr}_dark.svg`;
  const diff = priorRank != null ? priorRank - myTeam.rank : null;
  const mvmtLabel = diff == null ? null : diff === 0 ? '—' : diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`;
  const mvmtColor = diff == null || diff === 0 ? 'rgba(255,255,255,0.5)' : diff > 0 ? '#4ade80' : '#f87171';

  // Top 15 + team's neighbourhood if outside top 15
  const inTop15 = myTeam.rank <= 15;
  const displayRows = ranked.filter(t =>
    t.rank <= 15 || (!inTop15 && Math.abs(t.rank - myTeam.rank) <= 2)
  );

  return (
    <div
      id="pr-export-canvas"
      className="pred-canvas"
      style={{ '--team-canvas': primaryColor, background: '#1a1a2e' }}
    >
      {/* Header */}
      <div className="pred-canvas-header">
        <img src="/eyewall-logo.svg" alt="EyeWall" className="pred-canvas-logo"
          onError={e => { e.target.style.display = 'none'; }} />
        <span className="pred-canvas-badge">Power Rankings</span>
      </div>

      {/* Hero — team logo, rank, movement, component bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '0 52px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
        <img src={logoUrl(myTeam.abbr)} alt={myTeam.abbr}
          style={{ width: 80, height: 80, objectFit: 'contain' }}
          onError={e => { e.target.style.display = 'none'; }} />

        <div style={{ minWidth: 160 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {myTeam.abbr} · {myTeam.wins}–{myTeam.losses}–{myTeam.otLosses}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: 'var(--team-canvas)', lineHeight: 1 }}>
              #{myTeam.rank}
            </span>
            {mvmtLabel && (
              <span style={{ fontSize: 26, fontWeight: 700, color: mvmtColor }}>{mvmtLabel}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>of 32 teams</div>
        </div>

        {/* Component bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'Pts%',  val: myTeam.ptsPct * 100,                              fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.pts },
            { label: 'L10',   val: myTeam.l10PtsPct * 100,                           fmt: () => myTeam.l10,        rank: myTeam.leagueRanks?.l10 },
            { label: 'xGF%',  val: myTeam.xgfPct != null ? myTeam.xgfPct * 100 : null, fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.xgf },
            { label: 'GD/GP', val: myTeam.gdPG,                                      fmt: v => (v > 0 ? '+' : '') + v.toFixed(2), rank: myTeam.leagueRanks?.gd },
            { label: 'SP%',   val: myTeam.spPct * 100,                               fmt: v => `${v.toFixed(1)}%`, rank: myTeam.leagueRanks?.sp },
          ].map(({ label, val, fmt, rank }) => {
            const barPct   = rank != null ? ((32 - rank) / 31) * 100 : 50;
            const barColor = rank != null && rank <= 10 ? '#4ade80' : rank != null && rank >= 23 ? '#f87171' : '#5b8fd4';
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 40, fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                </div>
                <span style={{ width: 46, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {val != null ? fmt(val) : '—'}
                </span>
                <span style={{ width: 26, fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>
                  {rank != null ? `#${rank}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI narrative */}
      {narrative && (
        <div className="pred-canvas-ai">
          <div className="pred-canvas-ai-label">⚡ EyeWall AI</div>
          <div className="pred-canvas-ai-text">{narrative}</div>
        </div>
      )}

      {/* League snapshot */}
      <div style={{ flex: 1, padding: '10px 52px 0', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
          League snapshot
        </div>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 8px 52px 1fr 54px 60px 54px 54px', gap: 6, padding: '0 8px 4px', borderBottom: '0.5px solid rgba(255,255,255,0.07)', marginBottom: 3 }}>
          {['#', '', 'Team', 'Record', 'Pts%', 'L10', 'xGF%', 'GD/GP'].map(h => (
            <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', textAlign: h === 'Record' ? 'left' : h === '#' || h === '' ? 'center' : 'right' }}>{h}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {displayRows.map(t => {
            const isMe     = t.abbr === myTeam.abbr;
            const teamColor = TEAM_COLORS[t.abbr] ?? 'rgba(255,255,255,0.5)';
            return (
              <div key={t.abbr} style={{
                display: 'grid',
                gridTemplateColumns: '28px 8px 52px 1fr 54px 60px 54px 54px',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 5,
                background: isMe ? `${primaryColor}18` : 'transparent',
                borderLeft: isMe ? `3px solid ${primaryColor}` : '3px solid transparent',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: isMe ? 'var(--team-canvas)' : 'rgba(255,255,255,0.45)', textAlign: 'center' }}>{t.rank}</span>
                <span />
                <span style={{ fontSize: 12, fontWeight: 700, color: teamColor }}>{t.abbr}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{t.wins}–{t.losses}–{t.otLosses}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(t.ptsPct * 100).toFixed(1)}%</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>{t.l10}</span>
                <span style={{ fontSize: 11, color: t.xgfPct != null ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                  {t.xgfPct != null ? `${(t.xgfPct * 100).toFixed(1)}%` : '—'}
                </span>
                <span style={{ fontSize: 11, color: t.gdPG > 0 ? '#4ade80' : t.gdPG < 0 ? '#f87171' : 'rgba(255,255,255,0.4)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {t.gdPG > 0 ? '+' : ''}{t.gdPG.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pred-canvas-footer">
        <span>eyewallanalytics.com</span>
        <span>{TEAM_CONFIG.hashtags?.[0] || `#${myTeam.abbr}`}</span>
      </div>
    </div>
  );
}



// ─── Scroll-to-top button ─────────────────────────────────────────────────────
// Appears after the user scrolls down 200px within the league-content area.
// Used by Power Rankings and Draft tabs which can be long.

function ScrollTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller = document.getElementById('main-content');
    if (!scroller) return;
    function onScroll() { setVisible(scroller.scrollTop > 200); }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className={LV_SCROLL_TOP_CLASSES}
      onClick={() => document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
    >
      ↑ Top
    </button>
  );
}

// ─── LeagueView ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'standings', label: 'Standings' },
  { id: 'bracket',   label: 'Playoff bracket' },
  { id: 'leaders',   label: 'Leaders' },
  { id: 'rankings',  label: 'Power rankings' },
  { id: 'draft',     label: 'Draft' }
];

export default function LeagueView() {
  const { currentSeason: SEASON } = useSport();
  const [activeTab, setActiveTab] = useState('standings');

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    capture('league_tab_viewed', { tab: tabId });
  }, []);

  const { data: standings, loading: standingsLoading, error: standingsError }
    = useFetch(getStandings, []);

  const { data: scoring, loading: scoringLoading, error: scoringError }
    = useFetch(() => getScoringLeaders(SEASON, 10, '2'), [SEASON]);

  const { data: goals,   loading: goalsLoading }
    = useFetch(() => getGoalLeaders(SEASON, 10, '2'), [SEASON]);

  const { data: gaa,     loading: gaaLoading }
    = useFetch(() => getGoalieLeaders('goalsAgainstAverage', SEASON, 10, '2'), [SEASON]);

  const { data: svp,     loading: svpLoading }
    = useFetch(() => getGoalieLeaders('savePctg', SEASON, 10, '2'), [SEASON]);

  const { data: bracket, loading: bracketLoading }
    = useFetch(getPlayoffBracket, []);

  // Also needed on the Standings tab (not just Power rankings) for the
  // magic/tragic number display (Session 59).
  const { data: xgData, loading: xgLoading } = useFetch(
    () => (activeTab === 'rankings' || activeTab === 'standings') ? getTeamSeasonData() : Promise.resolve(null),
    [activeTab]
  )
  const { data: prNarrative } = useFetch(
    () => activeTab === 'rankings' ? getPowerRankingsNarrative(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [activeTab]
  )
  const { data: prHistory } = useFetch(
    () => activeTab === 'rankings' ? getPowerRankingsHistory(TEAM_CONFIG.abbr) : Promise.resolve(null),
    [activeTab]
  )

  const leadersLoading   = scoringLoading || goalsLoading || gaaLoading || svpLoading;
  // NHL's /standings/now stays pinned to last season's finale for months
  // after our season config flips (independent, live, un-related feed —
  // see nhlApi.js's _getTeamStats() for the full story). A real, non-empty,
  // but stale response would otherwise sail past the entries.length===0
  // check below and render last season's table as if it were current.
  // Only reject on an EXPLICIT mismatch — the real NHL API always includes
  // seasonId, but nothing else that stubs standings in tests does, and an
  // absent field isn't evidence of staleness.
  const standingsAreStale = isStandingsStale(standings, SEASON);
  const standingsEntries = standingsAreStale ? [] : (Array.isArray(standings) ? standings : []);

  return (
    <div className={LEAGUE_VIEW_CLASSES}>
      <nav className={LEAGUE_TABS_CLASSES} role="tablist" aria-label="League sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={leagueTabClasses(activeTab === tab.id)}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={LEAGUE_CONTENT_CLASSES}>
        {activeTab === 'standings' && (
          <>
            {standingsLoading && <LoadingRows />}
            {standingsError   && <ErrorState message="Couldn't load standings." />}
            {!standingsLoading && !standingsError && <StandingsPanel entries={standingsEntries} teamSeasonData={xgData} />}
          </>
        )}

        {activeTab === 'bracket' && (
          <>
            {bracketLoading  && <LoadingRows />}
            {!bracketLoading && <BracketPanel data={bracket} />}
          </>
        )}

        {activeTab === 'leaders' && (
          <>
            {leadersLoading && <LoadingRows />}
            {scoringError   && <ErrorState message="Couldn't load leaders." />}
            {!leadersLoading && !scoringError && (
              <LeadersPanel scoring={scoring} goals={goals} gaa={gaa} svp={svp} />
            )}
          </>
        )}

        {activeTab === 'rankings' && (
          <>
            <ScrollTopButton />
            <RankingsPanel
            standings={standingsEntries}
            standingsLoading={standingsLoading}
            xgData={xgData}
            xgLoading={xgLoading}
            narrative={prNarrative}
            history={prHistory}
          />
          </>
        )}

        {activeTab === 'draft' && <>
          <ScrollTopButton />
          <DraftTab />
        </>}
      </div>
    </div>
  );
}
