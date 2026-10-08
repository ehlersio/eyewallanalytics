// LeagueView.jsx
// Place in src/views/ alongside LeagueView.css

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { capture } from '../utils/analytics';
import { useFetch, usePoll } from '../hooks/useFetch';
import Scoreboard from '../components/Scoreboard';
import {
  getStandings,
  getScoringLeaders,
  getGoalLeaders,
  getGoalieLeaders,
  getPlayoffBracket,
  getPlayoffSeries,
  getPlayoffSeriesGames,
  getTodaysGames,
  getTeamSpecialTeams,
  TEAM_CONFIG,
} from '../utils/nhlApi';
import { getTeamSeasonData, getPowerRankingsNarrative, getPowerRankingsHistory } from '../utils/supabaseClient';
import { teamTextColor } from '../utils/teamConfig';
import { useSport } from '../utils/SportContext';
import TeamLogo from '../components/TeamLogo';
import PredictionScorecard from '../components/PredictionScorecard';
import PlayerPopup from '../components/PlayerPopup';
import { useShareCard } from '../hooks/useShareCard';
import ShareButtons from '../components/ShareButtons';
import RankNarrativeCard from '../components/RankNarrativeCard';
import PowerRankingsCanvas from '../components/PowerRankingsCanvas';
import DraftTab from '../components/DraftTab';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';
import { getEdgeLeaders } from '../utils/edgeApi';
import { useUnits } from '../hooks/useUnits';
import { formatNumber, formatPercent, formatDate } from '../utils/formatters';

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
const LEAGUE_TAB_ACTIVE_CLASSES = 'league-tab--active text-[color:var(--red-bright)] bg-[var(--red-dim)] border-transparent'
function leagueTabClasses(isActive) {
  return `${LEAGUE_TAB_BASE_CLASSES} ${isActive ? LEAGUE_TAB_ACTIVE_CLASSES : LEAGUE_TAB_INACTIVE_CLASSES}`
}

const LV_FILTER_ROW_CLASSES = 'flex gap-[6px] mb-4 flex-wrap'
const LV_FILTER_BTN_BASE_CLASSES = 'lv-filter-btn text-[12px] py-1 px-[10px] rounded-[var(--radius-sm)] border-[0.5px] cursor-pointer [transition:background_0.1s,color_0.1s]'
const LV_FILTER_BTN_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] bg-[var(--btn-fill)] border-transparent hover:bg-[var(--btn-fill-hover)]'
const LV_FILTER_BTN_ACTIVE_CLASSES = 'lv-filter-btn--active text-[color:var(--text)] bg-[var(--bg4)] border-transparent font-medium'
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

const LV_SCROLL_TOP_CLASSES = 'fixed bottom-[72px] right-4 z-[200] py-[7px] px-[14px] rounded-[20px] text-[12px] font-semibold text-[color:var(--text-muted)] bg-[var(--bg2,#1e1e1e)] border-[0.5px] border-transparent cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.4)] [transition:opacity_0.15s,color_0.15s,background_0.15s] hover:text-[color:var(--text)] hover:bg-[var(--bg3)]'

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
const LV_EDGE_HEADER_CLASSES = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-2'
const LV_EDGE_SOURCE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-2 text-center'
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
const LV_LEADERS_SUBLINE_CLASSES = 'lv-leaders-subline text-[10px] text-[color:var(--text-dim)] overflow-hidden text-ellipsis'
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
// A slot the projection can't fill yet (later rounds of "if the playoffs
// started today").
const BKT_CARD_OPEN_CLASSES = 'bkt-card--open bg-transparent border-[0.5px] border-dashed border-[var(--border)] min-h-[56px]'
const BKT_CARD_FINAL_CLASSES = 'bkt-card--final w-[110px]'
const BKT_CARD_CLICKABLE_CLASSES = 'bkt-card--clickable cursor-pointer [transition:background_0.12s_ease,border-color_0.12s_ease] hover:bg-[rgba(255,255,255,0.06)] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-[var(--red-bright)] focus-visible:outline-offset-[1px]'
function bktCardClasses({ variant = 'default', isFinal = false, isClickable = false } = {}) {
  const v = variant === 'empty' ? BKT_CARD_EMPTY_CLASSES
    : variant === 'open' ? BKT_CARD_OPEN_CLASSES
      : variant === 'primary' ? BKT_CARD_PRIMARY_CLASSES : BKT_CARD_DEFAULT_CLASSES
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
const BKT_SEED_CLASSES = 'bkt-seed text-[9px] font-semibold text-[color:var(--text-dim)] tracking-[0.03em]'
const BKT_CLINCH_CLASSES = 'bkt-clinch text-[9px] font-bold text-[color:var(--green)] uppercase'
const BKT_PROJECTED_NOTE_CLASSES = 'bkt-projected-note text-[11px] leading-[1.45] text-[color:var(--text-dim)] mb-3'
const BKT_PROJECTED_TITLE_CLASSES = 'bkt-projected-title font-[family-name:var(--font-display)] text-[14px] font-bold text-[color:var(--text)] mb-0.5'
const BKT_DOT_CLASSES = 'bkt-dot w-[7px] h-[7px] rounded-full border border-[var(--border-2)] bg-transparent shrink-0'
// .bkt-dot--won is confirmed dead -- the win-dot fill is applied via
// inline style={{background,borderColor}} using teamTextColor(), not this
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

// ── Tailwind class constants -- POWER RANKINGS (Phase 4, LeagueView.css
// sub-PR 4 -- LAST sub-PR for this file; LeagueView.css deleted entirely
// once this lands) --
//
// Re-checked the same 3 things again. Light mode found ONE more real
// spot: .pr-how-item's `background: var(--surface-dim, rgba(255,255,255,
// 0.03))` looks theme-reactive (references a custom property) but
// --surface-dim is never actually DEFINED anywhere in the app (confirmed
// via full-tree grep of every .css file) -- it always resolves to the
// hardcoded fallback, so this is a persistent (not hover-only) light-mode
// gap exactly like every plain rgba(255,255,255,X) background fixed this
// migration. .pr-row:hover's identically-shaped `var(--surface-hover,
// rgba(255,255,255,0.04))` was left alone at the time -- hover-only,
// matching the established pattern. Follow-up (post-migration): --surface-
// hover now has a real definition in index.css, so the fallback here is
// dead weight -- dropped. Now has a light-mode value too (hover-tint
// sweep) -- see index.css's [data-theme="light"] block. Property-race
// collisions: closed out the 2
// instances already identified in the original investigation --
// .pr-rank-num/--top/--bot and .pr-col-stat/--gd-pos/--neg, both racing
// on `color` (base sets it unconditionally, modifiers override it) -- no
// NEW instances found this pass (.pr-mvmt/--up/--down/--flat and
// .pr-row/--you were both re-confirmed clean, base sets neither
// background nor color/font-weight that the modifiers also set).
// Interpolated-suffix dead-code false positives: none -- every modifier
// here is a static ternary in both files.
//
// PWHL's main rankings table is entirely inline-styled (style={{}}
// throughout, never used any .pr-* class) -- only the shared "How is this
// calculated?" toggle (.pr-how-*) is real there. So PWHL's Power Rankings
// migration is just that one small shared piece, not a parallel table.
//
// .lv-skeleton-wrap/.lv-skeleton-row (from sub-PR 1) and .lv-div-card/
// --wide (from sub-PR 1) get their FINAL remaining call sites here --
// RankingsPanel had its own separate loading-skeleton render (flagged as
// out-of-scope-for-now back in sub-PR 1's investigation) and its own
// .lv-div-card-wrapped table/narrative cards. After this sub-PR, both
// classes have zero remaining consumers anywhere in the app.
const PR_TABLE_HEADER_ROW_CLASSES = 'pr-table-header-row grid [grid-template-columns:32px_24px_1fr_56px_64px_56px_56px] items-center gap-1 py-[6px] px-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[color:var(--text-dim)] border-b border-[var(--border)] pb-2 mb-[2px]'

const PR_ROW_BASE_CLASSES = 'pr-row grid [grid-template-columns:32px_24px_1fr_56px_64px_56px_56px] items-center gap-1 py-[6px] px-2 rounded-[6px] border-l-[3px] border-transparent [transition:background_0.15s] hover:bg-[var(--surface-hover)]'
const PR_ROW_YOU_CLASSES = 'pr-row--you font-semibold'
function prRowClasses(isYou) {
  return `${PR_ROW_BASE_CLASSES}${isYou ? ` ${PR_ROW_YOU_CLASSES}` : ''}`
}

const PR_COL_RANK_CLASSES = 'text-center'
const PR_COL_TEAM_CLASSES = 'flex items-center gap-[6px] min-w-0'
const PR_COL_STAT_BASE_CLASSES = 'pr-col-stat text-right text-[12px] [font-variant-numeric:tabular-nums]'
const PR_COL_STAT_DEFAULT_CLASSES = 'text-[color:var(--text)]'
const PR_COL_STAT_GD_POS_CLASSES = 'pr-gd--pos text-[color:var(--green)]'
const PR_COL_STAT_GD_NEG_CLASSES = 'pr-gd--neg text-[color:var(--red-bright)]'
function prColStatClasses(gdColor) {
  const variant = gdColor === 'pos' ? PR_COL_STAT_GD_POS_CLASSES : gdColor === 'neg' ? PR_COL_STAT_GD_NEG_CLASSES : PR_COL_STAT_DEFAULT_CLASSES
  return `${PR_COL_STAT_BASE_CLASSES} ${variant}`
}

const PR_ABBR_CLASSES = 'pr-abbr text-[13px] font-bold'

const PR_RANK_NUM_BASE_CLASSES = 'pr-rank-num text-[13px] font-bold'
const PR_RANK_NUM_DEFAULT_CLASSES = 'text-[color:var(--text-muted)]'
const PR_RANK_TOP_CLASSES = 'pr-rank--top text-[color:var(--green)]'
const PR_RANK_BOT_CLASSES = 'pr-rank--bot text-[color:var(--red-bright)]'
function prRankNumClasses(isTop, isBot) {
  const variant = isTop ? PR_RANK_TOP_CLASSES : isBot ? PR_RANK_BOT_CLASSES : PR_RANK_NUM_DEFAULT_CLASSES
  return `${PR_RANK_NUM_BASE_CLASSES} ${variant}`
}

const PR_HOW_TOGGLE_CLASSES = 'pr-how-toggle flex justify-between items-center w-full bg-transparent border-0 py-3 px-3 cursor-pointer text-[color:var(--text)] text-[13px] font-semibold'
const PR_HOW_CHEVRON_CLASSES = 'text-[10px] text-[color:var(--text-dim)]'
const PR_HOW_BODY_CLASSES = 'pr-how-body px-3 pb-3 flex flex-col gap-[10px]'
const PR_HOW_TEXT_CLASSES = 'pr-how-text text-[12px] text-[color:var(--text-muted)] leading-[1.55] m-0'
const PR_HOW_ITEM_CLASSES = 'pr-how-item p-[10px_12px] bg-[rgba(255,255,255,0.03)] rounded-[6px] border border-[var(--border)] flex flex-col gap-1'
const PR_HOW_ITEM_HEADER_CLASSES = 'flex justify-between items-baseline'
const PR_HOW_ITEM_LABEL_CLASSES = 'text-[13px] font-semibold text-[color:var(--text)]'
const PR_HOW_WEIGHT_CLASSES = 'pr-how-weight text-[11px] font-bold text-[color:var(--green)]'
const PR_HOW_SOURCE_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'

const PR_COL_MVMT_CLASSES = 'text-center'
const PR_MVMT_BASE_CLASSES = 'pr-mvmt text-[10px] font-bold [font-variant-numeric:tabular-nums]'
const PR_MVMT_UP_CLASSES = 'text-[color:var(--green)]'
const PR_MVMT_DOWN_CLASSES = 'text-[color:var(--red-bright)]'
const PR_MVMT_FLAT_CLASSES = 'text-[color:var(--text-dim)]'


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
  const { t } = useTranslation();
  const results = [
    ...Array(wins).fill('w'),
    ...Array(otl).fill('o'),
    ...Array(losses).fill('l'),
  ].slice(0, 10);

  return (
    <span className={L10_DOTS_CLASSES} aria-label={t('leagueView.standings.l10AriaLabel', { wins, losses, otl })}>
      {results.map((r, i) => (
        <span key={i} className={l10DotClasses(r)} />
      ))}
    </span>
  );
}

// ─── Standings table ──────────────────────────────────────────────────────────

const COL_HEADERS = ['#', 'Team', 'GP', 'W', 'L', 'OTL', 'PTS', 'L10', 'STRK', 'WVR'];

// Once the NHL's own clinchIndicator is populated for a team (live, via
// /cache/standings), it's ground truth and wins outright — see
// eyewall-pipeline's playoff_race.py docstring. Only fall back to our
// nightly-computed magic/tragic numbers pre-clinch/pre-elimination, and
// only show whichever of the two is closer (smaller): that's the team's
// actual near-term storyline — clinching soon, or in real elimination
// danger — rather than showing both and burying the meaningful one.
function magicTragicBadge(seasonData, t) {
  if (!seasonData) return null;
  const { magicNumber, tragicNumber } = seasonData;
  if (magicNumber == null && tragicNumber == null) return null;
  if (magicNumber != null && (tragicNumber == null || magicNumber <= tragicNumber)) {
    return {
      text:      `M${magicNumber}`,
      title:     t('leagueView.standings.magicNumberTitle', { n: magicNumber }),
      modifier:  'clinch',
    };
  }
  return {
    text:      `E${tragicNumber}`,
    title:     t('leagueView.standings.eliminationNumberTitle', { n: tragicNumber }),
    modifier:  'elim',
  };
}

function StandingsRow({ entry, rank, teamSeasonData }) {
  const { t } = useTranslation();
  const abbrev    = entry.teamAbbrev?.default ?? entry.teamAbbrev;
  const isPrimary = abbrev === PRIMARY;
  const clinchColor = CLINCH_COLOR[entry.clinchIndicator] ?? null;
  const magicBadge  = entry.clinchIndicator ? null : magicTragicBadge(teamSeasonData?.[abbrev], t);

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
          <span className={LV_TEAM_ABBREV_CLASSES} style={{ color: teamTextColor(abbrev) ?? 'var(--text)' }}>{abbrev}</span>
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
          // W / L / OT as the NHL gives it; OT in amber like the Team page's
          // streak chip (standingsStreak, leagueUtils.js).
          const streak = standingsStreak(entry);
          if (!streak) return '—';
          const color = streak.tone === 'win' ? 'var(--green)' : streak.tone === 'ot' ? 'var(--amber)' : 'var(--red-bright)';
          return <span style={{ color, fontWeight: 600 }}>{streak.label}</span>;
        })()}
      </td>
      <td className={lvTdClasses()} title={t('leagueView.standings.waiversTitle')}>{entry.waiversSequence ?? '—'}</td>
    </tr>
  );
}

function StandingsTable({ rows, caption, teamSeasonData }) {
  const { t } = useTranslation();
  return (
    <table className={LV_TABLE_CLASSES} aria-label={caption}>
      <thead>
        <tr>
          {COL_HEADERS.map((h) => (
            <th key={h} className={lvThClasses(h === 'Team')}>{h === 'Team' ? t('league.standings.colTeam') : h}</th>
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

import { groupByDivision, groupByConference, buildWildCard, parseNhlBracket, projectNhlBracket, computePowerRankings, MIN_GAMES_TO_RANK, standingsStreak } from '../utils/leagueUtils';
import { isStandingsStale } from '../utils/standingsUtils';

// ─── Standings Panel ──────────────────────────────────────────────────────────

function StandingsPanel({ entries, teamSeasonData }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('division');

  const byDivision   = useMemo(() => groupByDivision(entries),  [entries]);
  const byConference = useMemo(() => groupByConference(entries), [entries]);
  const byLeague     = useMemo(() => [...entries].sort((a, b) => a.leagueSequence - b.leagueSequence), [entries]);
  const wildCard     = useMemo(() => buildWildCard(entries),     [entries]);

  const FILTERS = [
    { id: 'division',   label: t('leagueView.standings.filterDivision') },
    { id: 'conference', label: t('leagueView.standings.filterConference') },
    { id: 'league',     label: t('leagueView.standings.filterLeague') },
    { id: 'wildcard',   label: t('leagueView.standings.filterWildcard') },
  ];

  if (entries.length === 0) {
    return <SeasonNotStartedState />;
  }

  return (
    <div>
      <div className={LV_FILTER_ROW_CLASSES} role="group" aria-label={t('leagueView.standings.viewAriaLabel')}>
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
          <span className={LV_LEGEND_BAR_PLAYOFF_CLASSES} /> {t('leagueView.standings.legendClinched')}
        </span>
        <span className={LV_LEGEND_ITEM_CLASSES}>
          <span className={LV_LEGEND_BAR_WC_CLASSES} /> {t('leagueView.standings.legendWildcard')}
        </span>
      </div>

      {filter === 'division' && ['Eastern', 'Western'].map((confName) => {
        const divs = Object.entries(byDivision).filter(([, v]) => v.conf === confName);
        return (
          <section key={confName} className={LV_CONF_SECTION_CLASSES}>
            <h3 className={LV_CONF_LABEL_CLASSES}>{t('leagueView.standings.conferenceHeading', { conf: confName })}</h3>
            <div className={LV_DIV_GRID_CLASSES}>
              {divs.map(([divName, { rows }]) => (
                <div key={divName} className={LV_DIV_CARD_BASE_CLASSES}>
                  <div className={LV_DIV_CARD_HEADER_CLASSES}>{divName}</div>
                  <StandingsTable rows={rows} caption={t('leagueView.standings.divisionCaption', { div: divName })} teamSeasonData={teamSeasonData} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {filter === 'conference' && Object.entries(byConference).map(([confName, rows]) => (
        <section key={confName} className={LV_CONF_SECTION_CLASSES}>
          <h3 className={LV_CONF_LABEL_CLASSES}>{t('leagueView.standings.conferenceHeading', { conf: confName })}</h3>
          <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
            <StandingsTable rows={rows} caption={t('leagueView.standings.conferenceCaption', { conf: confName })} teamSeasonData={teamSeasonData} />
          </div>
        </section>
      ))}

      {filter === 'league' && (
        <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
          <StandingsTable rows={byLeague} caption={t('leagueView.standings.leagueCaption')} teamSeasonData={teamSeasonData} />
        </div>
      )}

      {filter === 'wildcard' && Object.entries(wildCard).map(([confName, { divLeaders, wcPool }]) => (
        <section key={confName} className={LV_CONF_SECTION_CLASSES}>
          <h3 className={LV_CONF_LABEL_CLASSES}>{t('leagueView.standings.conferenceHeading', { conf: confName })}</h3>
          <div className={LV_DIV_GRID_CLASSES}>
            {Object.entries(divLeaders).map(([divName, rows]) => (
              <div key={divName} className={LV_DIV_CARD_BASE_CLASSES}>
                <div className={LV_DIV_CARD_HEADER_CLASSES}>{t('leagueView.standings.divisionLeadersHeader', { div: divName })}</div>
                <StandingsTable rows={rows} caption={t('leagueView.standings.divisionLeadersCaption', { div: divName })} teamSeasonData={teamSeasonData} />
              </div>
            ))}
          </div>
          <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES} ${LV_DIV_CARD_WC_CLASSES}`}>
            <div className={LV_DIV_CARD_HEADER_CLASSES}>{t('leagueView.standings.wildcardRaceHeader')}</div>
            <StandingsTable rows={wcPool} caption={t('leagueView.standings.wildcardCaption', { conf: confName })} teamSeasonData={teamSeasonData} />
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
        const teamColor = teamTextColor(abbrev) ?? 'var(--text-dim)';
        const pid       = p.playerId ?? p.id ?? null;

        // positionCode: the GAA / SV% leaders are goalies -- without it the
        // popup drew them as skaters (audit 2026-10-05 #24).
        const playerObj = pid ? {
          id:           pid,
          firstName:    { default: firstName },
          lastName:     { default: lastName },
          teamAbbrev:   abbrev,
          positionCode: p.positionCode ?? p.position ?? null,
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
            {p.subline ? (
              <span className={`${LV_LEADERS_NAME_CLASSES} flex flex-col`}>
                <span className="overflow-hidden text-ellipsis">{name}</span>
                <span className={LV_LEADERS_SUBLINE_CLASSES}>{p.subline}</span>
              </span>
            ) : (
              <span className={LV_LEADERS_NAME_CLASSES}>{name}</span>
            )}
            <span className={LV_LEADERS_TEAM_CLASSES} style={{ color: teamColor }}>{abbrev}</span>
            <span className={LV_LEADERS_STAT_CLASSES}>{formatStat ? formatStat(stat) : stat}</span>
          </div>
        );
      })}
    </div>
  );
}

// NHL EDGE leaders (Worker /nhl/edge/leaders): the NHL's own top 10s for
// fastest skating speed, hardest shot, distance skated and offensive-zone
// time, as LeadersCards under the box-score leaders. Speed and shot rows say
// when the NHL clocked it. Speeds and distances follow Settings -> Units. A
// list the NHL has nothing for is left out; nothing renders when it has none.
const EDGE_LEADER_CARDS = [
  { name: 'speed', kind: 'speed' },
  { name: 'shotSpeed', kind: 'speed' },
  { name: 'distance', kind: 'distance' },
  { name: 'offensiveZoneTime', kind: 'share' },
];

function EdgeLeaders({ season, onPlayerClick }) {
  const { t } = useTranslation();
  const units = useUnits();
  const { data } = useFetch(
    () => season ? getEdgeLeaders(String(season), 2).catch(() => null) : Promise.resolve(null),
    [season]
  );
  if (data?.status !== 'ok') return null;
  const { categories } = data.data;
  const cards = EDGE_LEADER_CARDS.filter(c => categories?.[c.name]?.length);
  if (!cards.length) return null;

  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  const valueOf = (kind, r) => (kind === 'share' ? r.value : r[units]);
  const formatOf = kind => (kind === 'share' ? v => formatPercent(v, 1) : v => formatNumber(v, one));
  const unitLabel = kind => (kind === 'speed' ? (units === 'metric' ? 'km/h' : t('league.edgeLeaders.mph'))
    : kind === 'distance' ? (units === 'metric' ? 'km' : 'mi') : t('league.edgeLeaders.ozShort'));
  const momentOf = m => (m ? t('league.edgeLeaders.moment', { date: formatDate(`${m.date}T12:00:00`), away: m.away, home: m.home }) : null);

  return (
    <section className="mt-5" data-testid="edge-leaders">
      <div className={LV_EDGE_HEADER_CLASSES}>{t('league.edgeLeaders.title')}</div>
      <div className={LV_LEADERS_GRID_CLASSES}>
        {cards.map(({ name, kind }) => (
          <LeadersCard
            key={name}
            title={t(`league.edgeLeaders.${name}`)}
            statLabel={unitLabel(kind)}
            rows={categories[name].map(r => ({
              playerId: r.playerId,
              firstName: { default: r.firstName },
              lastName: { default: r.lastName },
              teamAbbrev: r.team,
              value: valueOf(kind, r),
              subline: momentOf(r.moment),
            }))}
            formatStat={formatOf(kind)}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </div>
      <div className={LV_EDGE_SOURCE_CLASSES}>{t('league.edgeLeaders.source')}</div>
    </section>
  );
}

function LeadersPanel({ scoring, goals, gaa, svp, season }) {
  const { t } = useTranslation();
  const [selectedPlayer, setSelectedPlayer] = React.useState(null);

  const hasAnyData = [scoring, goals, gaa, svp].some((rows) => (rows ?? []).length > 0);
  if (!hasAnyData) {
    return <SeasonNotStartedState>{t('leagueView.leaders.emptyState')}</SeasonNotStartedState>;
  }

  return (
    <>
      <div className={LV_LEADERS_GRID_CLASSES} data-testid="stat-leaders">
        <LeadersCard title={t('league.leaders.titlePoints')} statLabel="PTS" rows={scoring ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard title={t('league.leaders.titleGoals')}  statLabel="G"   rows={goals   ?? []} onPlayerClick={setSelectedPlayer} />
        <LeadersCard
          title={t('league.leaders.titleGAA')}
          statLabel="GAA"
          rows={gaa ?? []}
          formatStat={(v) => Number(v).toFixed(2)}
          onPlayerClick={setSelectedPlayer}
        />
        <LeadersCard
          title={t('league.leaders.titleSavePct')}
          statLabel="SV%"
          rows={svp ?? []}
          formatStat={(v) => Number(v).toFixed(3).replace('0.', '.')}
          onPlayerClick={setSelectedPlayer}
        />
      </div>

      <EdgeLeaders season={season} onPlayerClick={setSelectedPlayer} />

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


// Primary team display color for YOU-row highlights and bracket card accent.
const PRIMARY_COLOR = TEAM_CONFIG.displayColor;

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
  const color = teamTextColor(abbrev);
  return (
    <span
      className={bktAbbrClasses(isEliminated)}
      style={!isEliminated && color ? { color } : undefined}
    >
      {abbrev}
    </span>
  );
}

// "D1" / "WC2" and the NHL's clinch letter (x/y/z/p) beside a projected
// team.
function SeedTag({ seed, clinch }) {
  return (
    <>
      {seed && <span className={BKT_SEED_CLASSES}>{seed}</span>}
      {clinch && <span className={BKT_CLINCH_CLASSES}>{clinch}</span>}
    </>
  );
}

function SeriesCard({ series, onSeriesClick, projected = false }) {
  const { t } = useTranslation();
  if (!series) return <div className={bktCardClasses({ variant: projected ? 'open' : 'empty' })} />;

  const { top, bottom, topWins, bottomWins } = series;
  const isPrimary  = top === PRIMARY || bottom === PRIMARY;
  const isComplete = topWins === 4 || bottomWins === 4;
  const hasGames   = topWins + bottomWins > 0;
  const dash       = '\u2013';

  let label = null;
  if (hasGames) {
    if      (topWins    === 4)          label = t('league.bracket.wins',  { team: top,    score: `4${dash}${bottomWins}` });
    else if (bottomWins === 4)          label = t('league.bracket.wins',  { team: bottom, score: `4${dash}${topWins}` });
    else if (topWins    === bottomWins) label = t('league.bracket.tied',  { score: `${topWins}${dash}${bottomWins}` });
    else if (topWins    >  bottomWins)  label = t('league.bracket.leads', { team: top,    score: `${topWins}${dash}${bottomWins}` });
    else                                label = t('league.bracket.leads', { team: bottom, score: `${bottomWins}${dash}${topWins}` });
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
        {projected
          ? <SeedTag seed={series.topSeed} clinch={series.topClinch} />
          : <WinDots wins={topWins} color={teamTextColor(top)} />}
      </div>
      <div className={BKT_TEAM_ROW_CLASSES}>
        <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
        {projected
          ? <SeedTag seed={series.bottomSeed} clinch={series.bottomClinch} />
          : <WinDots wins={bottomWins} color={teamTextColor(bottom)} />}
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

function roundLabel(roundNum, t) {
  if (roundNum === 1) return t('leagueView.bracket.roundFirst');
  if (roundNum === 2) return t('leagueView.bracket.roundSecond');
  if (roundNum === 3) return t('leagueView.bracket.roundConfFinals');
  return t('leagueView.bracket.roundFallback', { n: roundNum });
}

function RoundCol({ round, label, onSeriesClick, projected = false }) {
  const { t } = useTranslation();
  return (
    <div className={BKT_ROUND_COL_CLASSES}>
      <div className={BKT_ROUND_LABEL_CLASSES}>{label ?? roundLabel(round.round, t)}</div>
      <div className={BKT_ROUND_SERIES_CLASSES}>
        {round.series.map((s, i) => (
          <div key={i} className={BKT_SERIES_SLOT_CLASSES}>
            <SeriesCard series={s} onSeriesClick={onSeriesClick} projected={projected} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cup Final center ──

function CupFinalCol({ series, onSeriesClick }) {
  const { t } = useTranslation();
  // Not reached yet (a projection, or playoffs still in an earlier round).
  if (!series) {
    return (
      <div className={BKT_FINAL_COL_CLASSES}>
        <div className={BKT_ROUND_LABEL_CLASSES}>{t('leagueView.bracket.cupFinalHeading')}</div>
        <div className={BKT_FINAL_CENTER_CLASSES}>
          <div className={`${bktCardClasses({ variant: 'open', isFinal: true })}`} />
        </div>
      </div>
    );
  }
  const { top, bottom, topWins, bottomWins } = series;
  const winner      = topWins === 4 ? top : bottomWins === 4 ? bottom : null;
  const isComplete  = topWins === 4 || bottomWins === 4;
  const hasGames    = topWins + bottomWins > 0;

  return (
    <div className={BKT_FINAL_COL_CLASSES}>
      <div className={BKT_ROUND_LABEL_CLASSES}>{t('leagueView.bracket.cupFinalHeading')}</div>
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
            <WinDots wins={topWins} color={teamTextColor(top)} />
          </div>
          <div className={BKT_TEAM_ROW_CLASSES}>
            <TeamAbbr abbrev={bottom} isEliminated={isComplete && bottomWins !== 4} />
            <WinDots wins={bottomWins} color={teamTextColor(bottom)} />
          </div>
          {winner && (
            <div className={BKT_WINNER_LINE_CLASSES} style={{ color: teamTextColor(winner) ?? 'var(--text)' }}>
              {winner} {t('leagueView.bracket.championSuffix')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Series Modal ──

function SeriesModal({ series, carouselRounds, season, onClose }) {
  const { t } = useTranslation();
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

  const topColor    = teamTextColor(top)    ?? 'var(--text)';
  const bottomColor = teamTextColor(bottom) ?? 'var(--text)';
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
            <div className={SERIES_MODAL_RESULT_CLASSES} style={{ color: teamTextColor(winner) }}>
              {t('league.bracket.wins', { team: winner, score: `4${dash}${winner === top ? bottomWins : topWins}` })} 🏆
            </div>
          )}
          {!winner && topWins + bottomWins > 0 && (
            <div className={SERIES_MODAL_RESULT_CLASSES}>
              {topWins === bottomWins
                ? t('league.bracket.tied', { score: `${topWins}${dash}${bottomWins}` })
                : t('league.bracket.leads', {
                    team: topWins > bottomWins ? top : bottom,
                    score: `${Math.max(topWins, bottomWins)}${dash}${Math.min(topWins, bottomWins)}`,
                  })}
            </div>
          )}
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label={t('leagueView.bracket.closeSeriesAriaLabel')}>✕</button>
        </div>

        {/* Round label */}
        {carouselSeries && (
          <div className={SERIES_MODAL_ROUND_LABEL_CLASSES}>
            {carouselSeries.seriesLabel ?? t('leagueView.bracket.seriesLabelFallback', { letter: seriesLetter })}
          </div>
        )}

        {/* Game-by-game */}
        <div className={SERIES_MODAL_GAMES_CLASSES}>
          {gamesLoading && (
            <div className={SERIES_MODAL_LOADING_CLASSES}>
              {[70, 85, 70, 85].map((w, i) => (
                <div key={i} className={SKELETON_CLASSES} style={{ height: 32, width: `${w}%`, marginBottom: 6, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {!gamesLoading && games?.length === 0 && (
            <div className={SERIES_MODAL_EMPTY_CLASSES}>{t('leagueView.bracket.gameDataUnavailable')}</div>
          )}

          {!gamesLoading && games?.map((g, i) => {
            const awayWon = g.awayScore > g.homeScore;
            const homeWon = g.homeScore > g.awayScore;
            const extra   = periodLabel(g.periodType);
            const awayColor = teamTextColor(g.awayAbbrev) ?? 'var(--text)';
            const homeColor = teamTextColor(g.homeAbbrev) ?? 'var(--text)';
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

function BracketPanel({ standings }) {
  const { t } = useTranslation();
  const { currentSeason: SEASON } = useSport();
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [pickedView, setPickedView] = useState(null); // 'current' | 'previous'

  // /playoff-bracket takes the year the playoffs are played in: 2027 for
  // 20262027, so last season's is 2026.
  const endYear = Number(String(SEASON).slice(4));
  const prevSeason = `${endYear - 2}${endYear - 1}`;
  const { data: currentRaw, loading: currentLoading } = useFetch(() => getPlayoffBracket(endYear), [endYear]);
  const { data: previousRaw, loading: previousLoading } = useFetch(() => getPlayoffBracket(endYear - 1), [endYear]);

  // This season: its real bracket once the playoffs start, until then
  // "if the playoffs started today" from the live standings (it moves with
  // every result, clinch letters included). Last season: its final bracket.
  const liveBracket = useMemo(() => parseNhlBracket(currentRaw), [currentRaw]);
  const projected   = useMemo(() => (liveBracket ? null : projectNhlBracket(standings)), [liveBracket, standings]);
  const previous    = useMemo(() => parseNhlBracket(previousRaw), [previousRaw]);
  const current     = liveBracket || projected;

  const view = pickedView === 'previous' && previous ? 'previous'
    : pickedView === 'current' && current ? 'current'
      : current ? 'current' : 'previous';
  const bracket = view === 'current' ? current : previous;
  const bracketSeason = view === 'current' ? SEASON : prevSeason;
  const isProjected = !!bracket?.projected;

  // Fetch carousel for seriesLetter lookup — only when bracket tab is active
  const { data: carouselRounds } = useFetch(
    () => getPlayoffSeries(bracketSeason),
    [bracketSeason]
  );

  if (currentLoading || previousLoading) return <LoadingRows />;

  if (!bracket) {
    return (
      <div className={LV_EMPTY_CLASSES}>
        <p className={LV_EMPTY_MSG_CLASSES}>{t('leagueView.bracket.emptyState')}</p>
      </div>
    );
  }

  const { east, west, final } = bracket;
  const currentLabel = liveBracket
    ? t('leagueView.bracket.playoffsYear', { year: endYear })
    : t('leagueView.bracket.ifStartedToday');

  return (
    <>
      {current && previous && (
        <div className={LV_FILTER_ROW_CLASSES} role="group" aria-label={t('leagueView.bracket.viewAriaLabel')}>
          <button className={lvFilterBtnClasses(view === 'current')} data-bracket-view="current" onClick={() => setPickedView('current')}>
            {currentLabel}
          </button>
          <button className={lvFilterBtnClasses(view === 'previous')} data-bracket-view="previous" onClick={() => setPickedView('previous')}>
            {t('leagueView.bracket.playoffsYear', { year: endYear - 1 })}
          </button>
        </div>
      )}

      {isProjected && (
        <div className={BKT_PROJECTED_NOTE_CLASSES}>
          <div className={BKT_PROJECTED_TITLE_CLASSES}>{t('leagueView.bracket.ifStartedToday')}</div>
          {t('leagueView.bracket.projectedNote', { date: formatDate(new Date(), { month: 'short', day: 'numeric' }) })}
        </div>
      )}

      <div className={BKT_ROOT_CLASSES}>
        <div className={BKT_BRACKET_CLASSES}>

          {/* East rounds — left side, connectors flow right */}
          {east.map((round, ri) => (
            <React.Fragment key={`e${ri}`}>
              <RoundCol round={round} onSeriesClick={setSelectedSeries} projected={isProjected} />
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
                <RoundCol round={round} onSeriesClick={setSelectedSeries} projected={isProjected} />
              </React.Fragment>
            );
          })}

        </div>
      </div>

      {selectedSeries && (
        <SeriesModal
          series={selectedSeries}
          carouselRounds={carouselRounds}
          season={bracketSeason}
          onClose={() => setSelectedSeries(null)}
        />
      )}
    </>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────

function LoadingRows() {
  const { t } = useTranslation();
  return (
    <div className={LV_SKELETON_WRAP_CLASSES} aria-busy="true" aria-label={t('leagueView.loading.ariaLabel')}>
      {[85, 90, 85, 95, 85, 90, 85, 90].map((w, i) => (
        <div key={i} className={LV_SKELETON_ROW_CLASSES} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  const { t } = useTranslation();
  return (
    <div className={LV_ERROR_CLASSES}>
      <span>⚠</span>
      <p>{message ?? t('leagueView.error.generic')}</p>
    </div>
  );
}

// Shared across Standings, Stats Leaders, and Power Rankings — all three go
// blank once the season is live-flipped but before any games have been
// played (rosters/schedule exist, but standings/stats/rankings genuinely
// have zero rows). Distinct from ErrorState: this isn't a failure, so no
// warning icon and a calmer tone.
function SeasonNotStartedState({ children }) {
  const { t } = useTranslation();
  const { currentSeason } = useSport();
  return (
    <div className={LV_SEASON_EMPTY_CLASSES}>
      <p>{children ?? t('leagueView.seasonNotStarted.default', { season: seasonLabelFor(currentSeason) })}</p>
    </div>
  );
}

// ─── Power Rankings ───────────────────────────────────────────────────────────

// computePowerRankings() and MIN_GAMES_TO_RANK live in utils/leagueUtils.js.

// ─── Movement arrow ───────────────────────────────────────────────────────────

function MovementArrow({ current, prior }) {
  if (prior == null) return null;
  const diff = prior - current; // positive = moved up
  if (diff === 0) return <span className={`${PR_MVMT_BASE_CLASSES} ${PR_MVMT_FLAT_CLASSES}`}>—</span>;
  if (diff > 0)   return <span className={`${PR_MVMT_BASE_CLASSES} ${PR_MVMT_UP_CLASSES}`}>▲{diff}</span>;
  return              <span className={`${PR_MVMT_BASE_CLASSES} ${PR_MVMT_DOWN_CLASSES}`}>▼{Math.abs(diff)}</span>;
}

// ─── Rankings Panel ───────────────────────────────────────────────────────────

function RankingsPanel({ standings, standingsLoading, xgData, xgLoading, specialTeams, specialTeamsLoading, narrative, history }) {
  const { t } = useTranslation();
  const [showHow,    setShowHow]    = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const ranked  = computePowerRankings(standings, xgData, specialTeams);
  const hasSpecialTeams = ranked.some(r => r.spPct != null);
  // standingsLoading/xgLoading in flight vs. fetch done but genuinely zero
  // rows (season live-flipped, no games played yet) are different states —
  // conflating them here used to mean an empty season showed this loading
  // skeleton forever instead of a "not started yet" message.
  const loading = standingsLoading || xgLoading || specialTeamsLoading;
  const empty   = !loading && !standings?.length;
  const tooEarly = !loading && !empty
    && Math.min(...standings.map(s => s.gamesPlayed || 0)) < MIN_GAMES_TO_RANK;

  // Find this team's rank + prior for movement
  const myData    = ranked.find(t => t.abbr === PRIMARY);
  const priorRank = narrative?.prior_rank ?? null;

  const xCaption = [
    t('leagueView.rankings.shareCaptionRank', { team: PRIMARY, rank: myData?.rank ?? '?' }),
    narrative?.narrative || '',
    `#${PRIMARY} #EyeWallAnalytics`,
  ].filter(Boolean).join('\n');

  const { saving, sharing, handleNativeShare } =
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

  const handleShareWithCapture = async () => {
    await handleNativeShare();
    capture('power_rankings_card_exported', { team: PRIMARY, rank: myData?.rank });
  };

  if (loading) {
    return (
      <div className={LV_SKELETON_WRAP_CLASSES} aria-busy="true">
        {[85, 90, 85, 95, 85, 90, 85, 90, 85, 95].map((w, i) => (
          <div key={i} className={LV_SKELETON_ROW_CLASSES} style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (empty) {
    return <SeasonNotStartedState>{t('leagueView.rankings.emptyState')}</SeasonNotStartedState>;
  }
  if (tooEarly) {
    return <SeasonNotStartedState>{t('leagueView.rankings.tooEarly', { games: MIN_GAMES_TO_RANK })}</SeasonNotStartedState>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Narrative + sparkline card — shows when either exists */}
      <RankNarrativeCard
        teamAbbr={PRIMARY}
        narrative={narrative?.narrative ? { text: narrative.narrative, date: narrative.generated_date } : null}
        history={history?.map(r => ({ date: r.generated_date, rank: r.rank }))}
        primaryColor={PRIMARY_COLOR}
      />

      {/* Rankings table */}
      <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
        <div className={PR_TABLE_HEADER_ROW_CLASSES}>
          <span className={PR_COL_RANK_CLASSES}>#</span>
          <span className={PR_COL_MVMT_CLASSES} />
          <span className={PR_COL_TEAM_CLASSES}>{t('league.rankings.colTeam')}</span>
          <span className={PR_COL_STAT_BASE_CLASSES}>Pts%</span>
          <span className={PR_COL_STAT_BASE_CLASSES}>L10</span>
          <span className={PR_COL_STAT_BASE_CLASSES}>xGF%</span>
          <span className={PR_COL_STAT_BASE_CLASSES}>GD/GP</span>
        </div>

        {ranked.map(team => {
          const isPrimary = team.abbr === PRIMARY;
          // Show movement arrow only for the primary team (we only have their prior rank)
          const showArrow = isPrimary && priorRank != null;
          return (
            <div
              key={team.abbr}
              className={prRowClasses(isPrimary)}
              style={isPrimary ? {
                '--row-accent': PRIMARY_COLOR,
                borderLeft: `3px solid ${PRIMARY_COLOR}`,
                background: `color-mix(in srgb, ${PRIMARY_COLOR} 8%, var(--bg1))`,
              } : {}}
            >
              <span className={PR_COL_RANK_CLASSES}>
                <span className={prRankNumClasses(team.rank <= 8, team.rank >= 25)}>
                  {team.rank}
                </span>
              </span>
              <span className={PR_COL_MVMT_CLASSES}>
                {showArrow && <MovementArrow current={team.rank} prior={priorRank} />}
              </span>
              <span className={PR_COL_TEAM_CLASSES}>
                <TeamLogo abbr={team.abbr} size={16} />
                <span className={PR_ABBR_CLASSES} style={{ color: teamTextColor(team.abbr) ?? 'var(--text)' }}>
                  {team.abbr}
                </span>
              </span>
              <span className={prColStatClasses()}>{(team.ptsPct * 100).toFixed(1)}%</span>
              <span className={prColStatClasses()}>{team.l10}</span>
              <span className={prColStatClasses()}>
                {team.xgfPct != null ? `${(team.xgfPct * 100).toFixed(1)}%` : '—'}
              </span>
              <span className={prColStatClasses(team.gdPG > 0 ? 'pos' : team.gdPG < 0 ? 'neg' : null)}>
                {team.gdPG > 0 ? '+' : ''}{team.gdPG.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {!hasSpecialTeams && (
        <p className={PR_HOW_TEXT_CLASSES}>{t('leagueView.rankings.specialTeamsUnavailable')}</p>
      )}

      {/* Export / share */}
      <ShareButtons
        onNativeShare={handleShareWithCapture}
        saving={saving}
        sharing={sharing || !myData}
      />

      {/* How is this calculated? */}
      <div className={`${LV_DIV_CARD_BASE_CLASSES} ${LV_DIV_CARD_WIDE_CLASSES}`}>
        <button className={PR_HOW_TOGGLE_CLASSES} onClick={() => setShowHow(v => !v)} aria-expanded={showHow}>
          <span>{t('league.rankings.howCalculatedToggle')}</span>
          <span className={PR_HOW_CHEVRON_CLASSES}>{showHow ? '▲' : '▼'}</span>
        </button>

        {showHow && (
          <div className={PR_HOW_BODY_CLASSES}>
            <p className={PR_HOW_TEXT_CLASSES}>
              <Trans i18nKey="leagueView.rankings.howCalculatedIntro" components={{ em: <em /> }} />
            </p>

            {[
              {
                label: t('leagueView.rankings.componentPointsLabel'), weight: '25%',
                desc: t('leagueView.rankings.componentPointsDesc'),
                source: t('leagueView.rankings.sourceNHLStandings'),
              },
              {
                label: t('leagueView.rankings.componentL10Label'), weight: '25%',
                desc: t('leagueView.rankings.componentL10Desc'),
                source: t('leagueView.rankings.sourceNHLStandings'),
              },
              {
                label: t('leagueView.rankings.componentGDLabel'), weight: '20%',
                desc: t('leagueView.rankings.componentGDDesc'),
                source: t('leagueView.rankings.sourceNHLStandings'),
              },
              {
                label: t('leagueView.rankings.componentXGFLabel'), weight: '20%',
                desc: t('leagueView.rankings.componentXGFDesc'),
                source: t('leagueView.rankings.sourceMoneyPuckNightly'),
              },
              {
                label: t('league.rankings.componentSPLabel'), weight: '10%',
                desc: t('leagueView.rankings.componentSPDesc'),
                source: t('leagueView.rankings.sourceNHLTeamStats'),
              },
              {
                label: t('leagueView.rankings.componentWARLabel'), weight: '0–15%',
                desc: t('leagueView.rankings.componentWARDesc'),
                source: t('leagueView.rankings.sourceMoneyPuckRAPM'),
              },
            ].map(c => (
              <div key={c.label} className={PR_HOW_ITEM_CLASSES}>
                <div className={PR_HOW_ITEM_HEADER_CLASSES}>
                  <span className={PR_HOW_ITEM_LABEL_CLASSES}>{c.label}</span>
                  <span className={PR_HOW_WEIGHT_CLASSES}>{c.weight}</span>
                </div>
                <p className={PR_HOW_TEXT_CLASSES}>{c.desc}</p>
                <span className={PR_HOW_SOURCE_CLASSES}>{t('leagueView.rankings.sourcePrefix', { source: c.source })}</span>
              </div>
            ))}

            <p className={PR_HOW_TEXT_CLASSES} style={{ marginTop: 4 }}>
              <Trans i18nKey="leagueView.rankings.howCalculatedFootnote" components={{ em: <em /> }} />
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

// ─── Scroll-to-top button ─────────────────────────────────────────────────────
// Appears after the user scrolls down 200px within the league-content area.
// Used by Power Rankings and Draft tabs which can be long.

function ScrollTopButton() {
  const { t } = useTranslation();
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
      aria-label={t('leagueView.rankings.scrollTopAriaLabel')}
    >
      ↑ {t('leagueView.rankings.scrollTopLabel')}
    </button>
  );
}

// ─── LeagueView ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'scoreboard', labelKey: 'league.tabs.scoreboard' },
  { id: 'standings',  labelKey: 'league.tabs.standings' },
  { id: 'bracket',    labelKey: 'league.tabs.bracket' },
  { id: 'leaders',    labelKey: 'league.tabs.leaders' },
  { id: 'rankings',   labelKey: 'league.tabs.rankings' },
  { id: 'scorecard',  labelKey: 'scorecard.tabLabel' },
  { id: 'draft',      labelKey: 'league.tabs.draft' }
];

export default function LeagueView() {
  const { t } = useTranslation();
  const { currentSeason: SEASON } = useSport();
  // `?tab=scorecard` opens that tab (the methodology page links back to it).
  const [activeTab, setActiveTab] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(x => x.id === tab) ? tab : 'scoreboard';
  });

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    capture('league_tab_viewed', { tab: tabId });
  }, []);

  // Polled (30s) only while the Scoreboard tab is active -- matches the
  // Worker's own 60s KV TTL on /nhl/today closely enough that a viewer
  // sitting on the tab during a live game sees scores move without a
  // manual refresh. Off-tab ticks resolve a trivial Promise.resolve(null),
  // same guard shape as xgData/prNarrative below.
  const { data: todaysGames, loading: todaysGamesLoading, error: todaysGamesError }
    = usePoll(() => activeTab === 'scoreboard' ? getTodaysGames() : Promise.resolve(null), 30000, [activeTab]);

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

  // Also needed on the Standings tab (not just Power rankings) for the
  // magic/tragic number display (Session 59).
  const { data: xgData, loading: xgLoading } = useFetch(
    () => (activeTab === 'rankings' || activeTab === 'standings') ? getTeamSeasonData() : Promise.resolve(null),
    [activeTab]
  )
  // PP%/PK% for the Special Teams component -- standings don't carry them.
  const { data: specialTeams, loading: specialTeamsLoading } = useFetch(
    () => activeTab === 'rankings' ? getTeamSpecialTeams(SEASON) : Promise.resolve(null),
    [activeTab, SEASON]
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
      <nav className={LEAGUE_TABS_CLASSES} role="tablist" aria-label={t('leagueView.tabsAriaLabel')}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={leagueTabClasses(activeTab === tab.id)}
            onClick={() => handleTabChange(tab.id)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className={LEAGUE_CONTENT_CLASSES}>
        {activeTab === 'scoreboard' && (
          <Scoreboard sport="nhl" games={todaysGames} loading={todaysGamesLoading} error={todaysGamesError} />
        )}

        {activeTab === 'standings' && (
          <>
            {standingsLoading && <LoadingRows />}
            {standingsError   && <ErrorState message={t('leagueView.error.standings')} />}
            {!standingsLoading && !standingsError && <StandingsPanel entries={standingsEntries} teamSeasonData={xgData} />}
          </>
        )}

        {activeTab === 'bracket' && <BracketPanel standings={standingsEntries} />}

        {activeTab === 'leaders' && (
          <>
            {leadersLoading && <LoadingRows />}
            {scoringError   && <ErrorState message={t('leagueView.error.leaders')} />}
            {!leadersLoading && !scoringError && (
              <LeadersPanel scoring={scoring} goals={goals} gaa={gaa} svp={svp} season={SEASON} />
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
            specialTeams={specialTeams}
            specialTeamsLoading={specialTeamsLoading}
            narrative={prNarrative}
            history={prHistory}
          />
          </>
        )}

        {activeTab === 'scorecard' && <PredictionScorecard />}

        {activeTab === 'draft' && <>
          <ScrollTopButton />
          <DraftTab />
        </>}
      </div>
    </div>
  );
}
