/**
 * PlayerPopup.jsx
 * Shared player detail modal used by PlayersView (selected team's roster) and
 * LeagueView Leaders tab (any NHL player).
 *
 * Props:
 *   player       {object}  — minimum shape: { id, firstName, lastName, teamAbbrev }
 *                            PlayersView passes the full roster object which also
 *                            includes positionCode, sweaterNumber, headshot, shootsCatches.
 *   inPlayoffs   {boolean} — controls section ordering; pass false from LeagueView
 *   standings    {array}   — for rank calculation; pass [] from LeagueView
 *   onClose      {fn}      — close handler
 *   isLeagueContext {bool} — when true, hides roster-scoped tabs (Heat Map, Scout)
 *                            and the contract panel (contract panel is further
 *                            gated to TEAM_CONFIG.abbr === 'CAR' — carContracts.js
 *                            only has real data for Carolina); keeps Stats + Analytics
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'
import { useFetch } from '../hooks/useFetch'
import { getPlayerStats, getPlayerGameLog, fetchPlayerRankings, TEAM_CONFIG, GAME_TYPE } from '../utils/nhlApi'
import { ALL_TEAMS } from '../utils/teamConfig'
import {
  getPlayerAnalytics,
  getGoalieAnalytics,
  getPlayerShots,
  getGoalieShots,
  getScoutingBlurb,
  getResultsVsProcessNarrative,
} from '../utils/supabaseClient'
import { findContract, contractValue, pointsPer60, valueLabel, goalieContractValue, goalieValueLabel, CAP_CEILING } from '../utils/carContracts'
import { nhlSeasonLabel } from '../utils/seasonComparison'
import { HockeyRink } from 'react-hockey-rink'
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents'
import InfoTip from '../components/InfoTip'
import SeasonComparisonPicker from '../components/SeasonComparisonPicker'
import SeasonOverlayChart from './SeasonOverlayChart'
import { TileStatSection, PercentileScopeLegend } from './StatTileGrid'
import PercentileBar from './PercentileBar'
import PlayerComparisonEntry from './PlayerComparisonEntry'
import {
  SKATER_STATS, GOALIE_STATS, groupStats, posLabel,
  STAT_PCT_MAP, computeRadarAxes, computeGoalieRadarAxes, RADAR_AXIS_ABBR,
} from '../utils/nhlPlayerStats'
import { SKELETON_CLASSES } from '../utils/skeletonClasses'
import { formatOrdinal, formatDate } from '../utils/formatters'
// Tailwind migration (Session 97, Phase 3, sub-PR 2 + sub-PR 3). Most of
// this file's classes were migrated in sub-PR 2. The remaining shell
// classes -- player-popup, pp-header, pp-header-reflow, pp-close, pp-body,
// pp-no-stats, pp-identity, pp-name, pp-first, pp-birth, pp-photo-wrap,
// pp-radar-note/pp-radar-stale, highlight-section -- were left plain then
// because TeamComparisonPopup.jsx/PlayerComparisonPopup.jsx (sub-PR 3)
// used the same classes, or because a Tailwind utility couldn't win
// against them while they stayed unlayered. Both of those files are
// migrated in sub-PR 3 too, so these are now fully Tailwind here as well.
// popup-backdrop is a separate, permanently-shared global class in
// index.css (not part of PlayersView.css at all) -- untouched, out of
// scope for this migration entirely.
// pp-header-reflow's align-items/gap override and .pp-identity's reflow
// narrowing are now plain ternaries on the elements themselves (no more
// ancestor-selector CSS needed) since this component controls both
// directly. .pp-last keeps its literal marker for one surviving compound
// rule (.pp-header-reflow .pp-last{overflow-wrap:break-word}) that's cheap
// to leave as real CSS rather than reinvent as a conditional utility.
// pp-quickstats-col is fully migrated + its base rule deleted, but kept
// literal too: PlayersView.css's `.pp-quickstats-col .pce-toggle`/`.pce-wrap`
// compact-mode override (for PlayerComparisonEntry.jsx) was moved into
// PlayerComparisonPopup.css in sub-PR 2 rather than left dangling.
//
// Cypress marker classnames kept (audited via grep): pa-wrap, pp-heatmap-empty,
// pp-quickstats-col, pp-radar-wrap, pp-tab, pp-pos-chip, pp-chip.

const SEASON       = Number(TEAM_CONFIG.season.slice(0, 4) + TEAM_CONFIG.season.slice(4))
const SEASON_LABEL = `${TEAM_CONFIG.season.slice(0, 4)}–${TEAM_CONFIG.season.slice(6)}`

// ─── Tailwind class constants (Session 97, Phase 3, sub-PR 2) ─────────
const HEATMAP_CHIP_BASE_CLASSES = 'py-1 px-[10px] rounded-xl text-[11px] font-semibold leading-none border-[0.5px] border-[var(--border)] bg-[var(--bg2)] text-[color:var(--text-muted)] cursor-pointer'
const HEATMAP_CHIP_ACTIVE_CLASSES = 'bg-[var(--red-bright)] text-[#fff] border-[var(--red-bright)]'
function heatmapChipClasses(active) { return `${HEATMAP_CHIP_BASE_CLASSES} ${active ? HEATMAP_CHIP_ACTIVE_CLASSES : ''}` }

const PP_PHOTO_CLASSES = 'w-[80px] h-[80px] object-cover object-top rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)]'
const PP_PHOTO_FALLBACK_CLASSES = 'w-[80px] h-[80px] rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)] flex items-center justify-center font-[family-name:var(--font-display)] text-[24px] font-bold text-[color:var(--text-dim)]'
const PP_NUM_CLASSES = 'font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--red-bright)] tracking-[0.06em]'
const PP_LAST_CLASSES = 'pp-last font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text)]'
const PP_LAST_REFLOW_CLASSES = 'break-words'
const PP_CHIPS_CLASSES = 'flex gap-[5px] flex-wrap mt-[2px]'
const PP_POS_CHIP_CLASSES = 'pp-pos-chip font-[family-name:var(--font-display)] text-[10px] font-bold bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] py-[2px] px-[7px] rounded'
const PP_CHIP_CLASSES = 'pp-chip text-[10px] text-[color:var(--text-muted)] bg-[var(--bg3)] py-[2px] px-[6px] rounded'

const PP_RANKINGS_CLASSES = 'flex flex-col items-center gap-2 py-3 px-4 bg-[var(--bg2)] border-b-[0.5px] border-[var(--border)] text-center'
const PP_RANK_LABEL_CLASSES = 'text-[10px] text-[color:var(--text-dim)] uppercase tracking-[0.08em] font-[family-name:var(--font-display)] font-semibold'
const PP_RANK_ITEMS_CLASSES = 'flex gap-6 justify-center flex-wrap'
const RANK_BADGE_CLASSES = 'flex flex-col items-center gap-[2px]'
const RANK_NUM_CLASSES = 'font-[family-name:var(--font-display)] text-[22px] font-bold leading-none'
const RANK_SCOPE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'

const PP_LOADING_CLASSES = 'p-4 flex flex-col gap-2'
const PP_TABS_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-16px] px-4'
const PP_TAB_BASE_CLASSES = 'pp-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const PP_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const PP_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function ppTabClasses(active) { return `${PP_TAB_BASE_CLASSES} ${active ? PP_TAB_ACTIVE_CLASSES : PP_TAB_INACTIVE_CLASSES}` }

const PP_HEATMAP_CLASSES = 'py-3 px-4'
const PP_HEATMAP_EMPTY_CLASSES = 'pp-heatmap-empty py-8 px-4 text-center text-[color:var(--text-muted)] text-[13px] flex flex-col items-center gap-2'
const PP_HEATMAP_ICON_CLASSES = 'text-[28px]'
const PP_HEATMAP_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'
const PP_HEATMAP_SUMMARY_CLASSES = 'flex justify-around py-[8px_0_12px] border-b-[0.5px] border-[var(--border)] mb-[10px]'
const PP_HEATMAP_STAT_CLASSES = 'flex flex-col items-center gap-[2px] text-[10px] text-[color:var(--text-dim)]'
const PP_HEATMAP_NUM_BASE_CLASSES = 'text-[18px] font-bold font-[family-name:var(--font-mono)]'
const PP_HEATMAP_NUM_DEFAULT_CLASSES = 'text-[color:var(--text)]'
const PP_HEATMAP_NUM_GOAL_CLASSES = 'text-[#f87171]'
const PP_HEATMAP_NUM_SOG_CLASSES = 'text-[#4ade80]'
const PP_HEATMAP_FILTERS_CLASSES = 'flex gap-[6px] flex-wrap mb-[10px]'
const PP_HEATMAP_RINK_CLASSES = 'rounded-lg overflow-hidden w-full'

const PA_WRAP_CLASSES = 'pa-wrap py-3 px-4 pb-4'
const PA_WAR_CARD_CLASSES = 'flex items-center gap-4 bg-[var(--bg2)] rounded-[10px] py-[14px] px-4 mb-3'
const PA_WAR_MAIN_CLASSES = 'flex flex-col items-center shrink-0'
const PA_WAR_NUM_CLASSES = 'text-[32px] font-extrabold font-[family-name:var(--font-mono)] leading-none'
const PA_WAR_LABEL_CLASSES = 'text-[11px] font-bold text-[color:var(--text-dim)] tracking-[0.08em] mt-[2px]'
const PA_WAR_META_CLASSES = 'flex flex-col gap-[3px] text-[13px] font-semibold'
const PA_WAR_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)] font-normal'
const PA_CONTEXT_CLASSES = 'flex gap-2 flex-wrap mb-[14px]'
const PA_CONTEXT_CENTERED_CLASSES = 'justify-center'
const PA_CTX_ITEM_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-lg py-[6px] px-[10px] text-[10px] text-[color:var(--text-dim)] gap-[2px] flex-[1_1_calc(33.333%-8px)] min-w-[60px] max-w-[120px]'
const PA_CTX_VAL_CLASSES = 'text-[14px] font-bold font-[family-name:var(--font-mono)] text-[color:var(--text)]'
const PA_CTX_LABEL_CLASSES = 'inline-flex items-center gap-[2px] whitespace-nowrap'
const PA_SECTION_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-dim)] mb-2'
const PA_BARS_CLASSES = 'flex flex-col gap-[6px]'
const PA_SOURCE_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[14px] text-center'

const RVP_WRAP_CLASSES = 'mt-[18px] pt-[14px] border-t-[0.5px] border-[var(--border)]'
const RVP_CONTEXT_CLASSES = `${PA_CONTEXT_CLASSES} mb-[10px]`

const SCOUT_WRAP_CLASSES = 'p-4'
const SCOUT_HEADER_CLASSES = 'flex items-center justify-between mb-3'
const SCOUT_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)]'
const SCOUT_SEASON_CLASSES = 'text-[10px] font-bold py-[2px] px-[7px] rounded-[10px] bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] uppercase tracking-[0.06em] font-[family-name:var(--font-display)]'
const SCOUT_BLURB_CLASSES = 'text-[14px] leading-[1.65] text-[color:var(--text)] bg-[var(--bg2)] rounded-[10px] py-[14px] px-4 border-[0.5px] border-[var(--border)] whitespace-pre-wrap'
const SCOUT_FOOTER_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[10px] text-center'
const SCOUT_LOADING_CLASSES = 'flex flex-col gap-1 py-1'
const SCOUT_EMPTY_CLASSES = 'py-8 px-4 text-center text-[color:var(--text-muted)] text-[13px] flex flex-col items-center gap-2'
const SCOUT_EMPTY_ICON_CLASSES = 'text-[28px]'
const SCOUT_EMPTY_SUB_CLASSES = 'text-[11px] text-[color:var(--text-dim)]'

const PP_HEADER_RADAR_CLASSES = 'flex items-center gap-2 flex-[1_1_auto] min-w-0 max-[340px]:flex-col'
const PP_RADAR_WRAP_CLASSES = 'pp-radar-wrap flex-[1_1_0%] min-w-[50px] max-w-[130px] max-[340px]:max-w-full'
const PP_QUICKSTATS_COL_CLASSES = 'pp-quickstats-col flex flex-col gap-1 flex-none'
const PP_QUICKSTATS_CLASSES = 'grid [grid-template-columns:38px_38px] gap-1 max-[340px]:w-full'
const PP_QUICKSTAT_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-md py-1 px-[2px] min-w-0'
const PP_QUICKSTAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--text)] leading-[1.1]'
const PP_QUICKSTAT_LABEL_CLASSES = 'text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'

const PP_BIO_ROW_CLASSES = 'grid grid-cols-6 gap-[8px_4px] py-[10px_12px_14px] border-b-[0.5px] border-[var(--border)] max-[340px]:grid-cols-3'
const PP_BIO_FIELD_CLASSES = 'flex flex-col items-center gap-[3px] text-center min-w-0'
const PP_BIO_LABEL_CLASSES = 'text-[8px] uppercase tracking-[0.06em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] font-semibold'
const PP_BIO_VALUE_CLASSES = 'text-[11px] font-semibold text-[color:var(--text)] [overflow-wrap:break-word]'

const PP_CONTRACT_CLASSES = 'py-3 px-4 bg-[var(--bg2)] border-b-[0.5px] border-[var(--border)] text-center'
const PP_CONTRACT_ROW_CLASSES = 'grid grid-cols-3 gap-[10px_6px] mb-[10px]'
const PP_CONTRACT_ITEM_CLASSES = 'flex flex-col items-center gap-[3px]'
const PP_CONTRACT_LABEL_CLASSES = 'text-[9px] uppercase tracking-[0.08em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] font-semibold'
const PP_CONTRACT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[15px] font-bold text-[color:var(--text)]'
const PP_VALUE_ROW_CLASSES = 'flex items-center justify-center gap-2 flex-wrap'
const PP_VALUE_BADGE_CLASSES = 'flex items-center gap-1 text-[11px] font-semibold py-1 px-3 rounded-xl border-[0.5px]'
const PP_ADV_CHIP_CLASSES = 'pp-adv-chip flex items-center gap-[3px] text-[11px] text-[color:var(--text-muted)] bg-[var(--bg3)] py-[3px] px-2 rounded-lg'
const PP_VALUE_SCORE_CLASSES = 'text-[10px] opacity-75'
const PP_METRIC_SELECT_CLASSES = 'text-[11px] text-[color:var(--text)] bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-md py-[3px] px-[6px]'

// ── Sub-PR 3 additions: the former "shell" classes ──
const PLAYER_POPUP_CLASSES = 'player-popup bg-[var(--bg1)] border-[0.5px] border-[var(--border-2)] rounded-t-[var(--radius-lg)] w-full max-w-[420px] max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.5)] animate-[slide-up_0.2s_cubic-bezier(0.34,1.2,0.64,1)] min-[560px]:rounded-[var(--radius-lg)] min-[560px]:animate-[pop-in_0.2s_cubic-bezier(0.34,1.2,0.64,1)]'
const PP_HEADER_BASE_CLASSES = 'pp-header flex p-4 border-b-[0.5px] border-[var(--border)] [background:linear-gradient(135deg,rgba(204,34,0,0.07)_0%,transparent_55%)] relative'
const PP_HEADER_LAYOUT_DEFAULT_CLASSES = 'items-start gap-[14px]'
const PP_HEADER_LAYOUT_REFLOW_CLASSES = 'items-center gap-[10px]'
function ppHeaderClasses(reflow) { return `${PP_HEADER_BASE_CLASSES} ${reflow ? PP_HEADER_LAYOUT_REFLOW_CLASSES : PP_HEADER_LAYOUT_DEFAULT_CLASSES}` }
const PP_IDENTITY_DEFAULT_CLASSES = 'flex-1 min-w-0 flex flex-col gap-1'
const PP_IDENTITY_REFLOW_CLASSES = 'flex-[0_1_84px] min-w-[60px] flex flex-col gap-[3px]'
const PP_NAME_CLASSES = 'pp-name flex flex-col leading-[1.1]'
const PP_FIRST_CLASSES = 'pp-first text-[12px] text-[color:var(--text-muted)]'
const PP_BIRTH_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[2px]'
const PP_CLOSE_CLASSES = 'pp-close absolute top-3 right-3 w-[28px] h-[28px] rounded-full bg-[var(--bg3)] text-[color:var(--text-muted)] text-[12px] flex items-center justify-center [transition:all_0.12s] hover:bg-[var(--bg4)] hover:text-[color:var(--text)]'
const PP_BODY_CLASSES = 'pp-body pt-2 pb-4'
const PP_NO_STATS_CLASSES = 'text-center p-5 text-[12px] text-[color:var(--text-dim)] italic'
const PP_PHOTO_WRAP_CLASSES = 'shrink-0'
const PP_RADAR_NOTE_BASE_CLASSES = 'text-[9px] text-[color:var(--text-dim)] text-center leading-[1.4] px-1 mt-[-6px]'
const PP_RADAR_NOTE_STALE_CLASSES = 'italic'

// ─── Stat definitions ─────────────────────────────────────────
// SKATER_STATS/GOALIE_STATS/groupStats/posLabel moved to
// utils/nhlPlayerStats.js (Session 91) so PlayerComparisonPopup.jsx can
// reuse them without a circular import back into this file.

// ─── Per-game trend chart helpers (Session 70) ─────────────────

function toiToSeconds(toi) {
  if (typeof toi !== 'string' || !toi.includes(':')) return null
  const [m, s] = toi.split(':').map(Number)
  if (Number.isNaN(m) || Number.isNaN(s)) return null
  return m * 60 + s
}

// Reads one stat's value off a single game-log row. Most `perGame` stats
// are a direct field read (def.perGameKey || def.key); the small set of
// goalie stats that aren't direct API fields (saves, W/L, GAA) go through
// `def.derive` instead -- see the GOALIE_STATS comment above for why each
// one needs its own formula rather than a field read.
function perGameRawValue(def, game) {
  if (!game) return null
  if (def.derive === 'saves') {
    const sa = game.shotsAgainst, ga = game.goalsAgainst
    return (sa == null || ga == null) ? null : sa - ga
  }
  if (def.derive === 'win')  return game.decision === 'W' ? 1 : 0
  if (def.derive === 'loss') return game.decision === 'L' ? 1 : 0
  if (def.derive === 'gaa') {
    const secs = toiToSeconds(game.toi)
    return (!secs || game.goalsAgainst == null) ? null : (game.goalsAgainst / secs) * 3600
  }
  const raw = game[def.perGameKey || def.key]
  return raw == null ? null : Number(raw)
}

// Small season-color ramp -- same math as TeamComparisonPopup's
// seasonRampColor/hexToRgba, duplicated rather than cross-imported (this
// codebase's convention for small UI-adjacent helpers owned by a single
// popup component; see rapm.py's 3-bucket proxy for the same pattern on
// the pipeline side).
function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '')
  if (clean.length !== 6) return hex
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
function seasonRampColor(baseHex, index, total) {
  if (total <= 1) return baseHex
  const MIN_ALPHA = 0.35
  const alpha = 1 - (index / (total - 1)) * (1 - MIN_ALPHA)
  return hexToRgba(baseHex, Number(alpha.toFixed(2)))
}
const CHART_DASH_PATTERNS = [undefined, '6 4', '2 3']

// ─── Player-card header + Stats tab redesign (Session 66, NHL skaters only) ──
// Radar chart + percentile tile grid below are additive UI on top of the
// existing mpData.percentiles shape from getPlayerAnalytics() (supabaseClient.js)
// -- no new data fetching. Goalies and PWHL are explicitly untouched: this
// entire block is only reached when !isGoalie in this (NHL-only) file, and
// PWHLPlayerPopup.jsx is a completely separate component this PR never edits.

// WCAG-AA dark-mode-safe team colors, same lookup pattern LeagueView.jsx
// already uses for its power-rankings sparkline (ALL_TEAMS -> displayColor).
const TEAM_DISPLAY_COLORS = Object.fromEntries(ALL_TEAMS.map(t => [t.abbr, t.displayColor]))

function teamColorFor(abbr) {
  return TEAM_DISPLAY_COLORS[abbr] || TEAM_CONFIG.displayColor || '#4d80f0'
}

// computeRadarAxes/STAT_PCT_MAP moved to utils/nhlPlayerStats.js (Session 91,
// same circular-import reasoning as the stat-def move above).

// ─── Sub-components ───────────────────────────────────────────

function RankBadge({ label, rank }) {
  const color  = rank <= 3 ? 'var(--green)' : rank <= 10 ? 'var(--amber)' : 'var(--text-muted)'
  return (
    <div className={RANK_BADGE_CLASSES}>
      <span className={RANK_NUM_CLASSES} style={{ color }}>{formatOrdinal(rank)}</span>
      <span className={RANK_SCOPE_CLASSES}>{label}</span>
    </div>
  )
}

// StatRow/StatSection (vertical row-list accordion) removed Session 73 --
// every section in this file now renders via the tile grid (TileStatSection,
// imported from StatTileGrid.jsx as of Session 75's extraction so
// PWHLPlayerPopup.jsx can share the same mechanism); the row-list layout
// has no remaining call sites in this file. `def.why`/`def.calc` tooltip
// text (dropped when StatRow was removed, since InfoTip only took a single
// `text` at the time) is resurfaced via InfoTip's `sections` prop (Session
// 74) -- see StatTile in StatTileGrid.jsx.

// ─── Skater header radar + quick stats (Session 66) ────────────

// Root cause of the label-cutoff bug (Session 72): .pp-radar-wrap is capped
// to a ~140-160px flex slot inside a popup hard-capped at 420px wide
// (PlayersView.css), leaving only ~15-25px of margin outside the plotted
// circle -- nowhere near enough for two-word labels like "Special Teams" at
// any legible font size. Abbreviating is the only fix that guarantees no
// clipping at every viewport; full names are still available on hover/tap
// via a native SVG <title> (same info the "Not enough playing time yet"
// caption below already spells out in full for whichever axes are missing).
// RADAR_AXIS_ABBR moved to utils/nhlPlayerStats.js (Session 91).

function RadarAxisTick({ x, y, payload, textAnchor }) {
  const full  = payload.value
  const short = RADAR_AXIS_ABBR[full] || full
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={8.5}>
      {short}
      <title>{full}</title>
    </text>
  )
}

function PlayerRadarChart({ data, color, staleNote }) {
  const { t } = useTranslation()
  const missing = data.filter(d => !d.hasData).map(d => d.axis)
  return (
    <div className={PP_RADAR_WRAP_CLASSES}>
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={RadarAxisTick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {missing.length > 0 && (
        <div className={PP_RADAR_NOTE_BASE_CLASSES}>{t('playerPopup.radar.notEnoughData', { missing: missing.join(', ') })}</div>
      )}
      {/* Whole-season fallback caption (Session 66) — rendered here, inside
          the narrow radar column, rather than as a sibling of .pp-quickstats
          in .pp-header-radar's row (Session 80): once that row shares width
          with the compact identity column instead of spanning the popup's
          full ~400px, a full-sentence-length flex sibling there forces
          .pp-quickstats to zero width instead of wrapping in place. */}
      {staleNote && (
        <div className={`${PP_RADAR_NOTE_BASE_CLASSES} ${PP_RADAR_NOTE_STALE_CLASSES}`}>{staleNote}</div>
      )}
    </div>
  )
}

function QuickStatPill({ label, value }) {
  return (
    <div className={PP_QUICKSTAT_CLASSES}>
      <span className={PP_QUICKSTAT_VAL_CLASSES}>{value ?? '—'}</span>
      <span className={PP_QUICKSTAT_LABEL_CLASSES}>{label}</span>
    </div>
  )
}

// Header panel shown only for NHL skaters (goalies + PWHL keep today's
// header). `boxStats` is the current/highlighted season's raw stat line
// (same object the Stats tab uses) -- reused here for the G/A/P/TOI pills
// rather than re-fetching anything.
// `comparisonEntry` (the "vs Player" button, Session 91) is rendered
// stacked below the quickstats grid rather than as a sibling of this whole
// panel in .pp-header's row -- putting it inline there ate into
// .pp-radar-wrap's already-tight flex share (radar takes "whatever's
// left" after quickstats' protected fixed width, see PlayersView.css) and
// visibly squeezed the radar. Reported live after shipping.
function SkaterHeaderPanel({ percentiles, boxStats, teamColor, statsStale, statsSeason, comparisonEntry }) {
  const { t } = useTranslation()
  if (!percentiles) return null
  const radarData = computeRadarAxes(percentiles)
  const fmtToi = (raw) => {
    if (raw == null) return null
    if (typeof raw === 'string' && raw.includes(':')) return raw
    const m = Math.floor(raw / 60), s = String(raw % 60).padStart(2, '0')
    return `${m}:${s}`
  }
  // Whole-season fallback (Session 66) — same "as of last season" signal as
  // the Stats tab's stat-section-stale badge, since this radar is built
  // from the same possibly-stale percentiles object.
  const staleNote = statsStale
    ? t('statTileGrid.section.staleTip', { season: nhlSeasonLabel(statsSeason) })
    : null
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PlayerRadarChart data={radarData} color={teamColor} staleNote={staleNote} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <QuickStatPill label="G"   value={boxStats?.goals} />
          <QuickStatPill label="A"   value={boxStats?.assists} />
          <QuickStatPill label="P"   value={boxStats?.points} />
          <QuickStatPill label="TOI" value={fmtToi(boxStats?.avgToi)} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  )
}

// Goalie equivalent of SkaterHeaderPanel (added after skaters had this for
// several sessions with no goalie counterpart -- the underlying percentile
// data already existed via getGoalieAnalytics()/goalieData.percentiles,
// already used by the Analytics tab's PercentileBar list and by
// PlayerComparisonPopup's goalie-vs-goalie radar (computeGoalieRadarAxes,
// Session 91) -- this was purely a missing wire-up in this single-player
// header, not a data gap).
//
// `percentiles` here is goalieData.percentiles (getGoalieAnalytics's
// shape: gsax/gsax60/evSv/hdSv/mdSv/pkSv), a different shape from
// SkaterHeaderPanel's mpData.percentiles -- computeGoalieRadarAxes reads
// it directly, no STAT_PCT_MAP translation needed (unlike skaters' 10-pct
// -> 5-axis squeeze, goalies' 6 categories map 1:1 to 6 axes).
//
// `boxStats` is the same raw current-season stats object skaters get
// (from `sections`, the live NHL API shape) -- wins/savePctg/
// goalsAgainstAvg/shutouts are its real field names, matching GOALIE_STATS'
// `key`s exactly, same as groupStats() already assumes elsewhere in this
// file.
function GoalieHeaderPanel({ percentiles, boxStats, teamColor, statsStale, statsSeason, comparisonEntry }) {
  const { t } = useTranslation()
  if (!percentiles) return null
  const radarData = computeGoalieRadarAxes(percentiles)
  const fmtSvPct = (raw) => {
    if (raw == null) return null
    const n = parseFloat(raw)
    return isNaN(n) ? null : (n <= 1 ? n.toFixed(3) : (n / 100).toFixed(3))
  }
  const fmtGaa = (raw) => raw == null ? null : parseFloat(raw).toFixed(2)
  // Same whole-season fallback pattern as SkaterHeaderPanel.
  const staleNote = statsStale
    ? t('statTileGrid.section.staleTip', { season: nhlSeasonLabel(statsSeason) })
    : null
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PlayerRadarChart data={radarData} color={teamColor} staleNote={staleNote} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <QuickStatPill label="W"   value={boxStats?.wins} />
          <QuickStatPill label="SV%" value={fmtSvPct(boxStats?.savePctg)} />
          <QuickStatPill label="GAA" value={fmtGaa(boxStats?.goalsAgainstAvg)} />
          <QuickStatPill label="SO"  value={boxStats?.shutouts} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  )
}

// ─── Heat Map ─────────────────────────────────────────────────

function PlayerHeatMap({ shotData, goalieShotData, _playerName, isGoalie }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [mapMode, setMapMode] = useState('dots')

  if (isGoalie) {
    if (!goalieShotData) {
      return (
        <div className={PP_HEATMAP_EMPTY_CLASSES}>
          <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
          <div>{t('playerPopup.heatMap.goalie.empty')}</div>
          <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.goalie.emptySub')}</div>
        </div>
      )
    }

    const shots  = goalieShotData.shots || []
    const goals  = shots.filter(s => s.t === 'g').length
    const saves  = shots.filter(s => s.t === 's').length
    const total  = goals + saves
    const svPct  = total > 0 ? (saves / total).toFixed(3) : '—'

    const ZONES = [
      { id: 'slot_hi',   label: t('playerPopup.heatMap.goalie.zones.highSlot'),    test: s => Math.abs(s.y) <= 22 && s.x >= 55 && s.x < 75 },
      { id: 'slot_lo',   label: t('playerPopup.heatMap.goalie.zones.lowSlot'),     test: s => Math.abs(s.y) <= 22 && s.x >= 75 },
      { id: 'left_hi',   label: t('playerPopup.heatMap.goalie.zones.leftCircle'),  test: s => s.y < -10 && s.x >= 55 && s.x < 80 },
      { id: 'right_hi',  label: t('playerPopup.heatMap.goalie.zones.rightCircle'), test: s => s.y > 10  && s.x >= 55 && s.x < 80 },
      { id: 'left_lo',   label: t('playerPopup.heatMap.goalie.zones.leftWing'),    test: s => s.y < -22 && s.x >= 55 },
      { id: 'right_lo',  label: t('playerPopup.heatMap.goalie.zones.rightWing'),   test: s => s.y > 22  && s.x >= 55 },
      { id: 'perimeter', label: t('playerPopup.heatMap.goalie.zones.perimeter'),   test: s => s.x < 55 },
    ]

    const zoneStats = ZONES.map(z => {
      const zShots = shots.filter(s => z.test(s))
      const zGoals = zShots.filter(s => s.t === 'g').length
      const zSaves = zShots.filter(s => s.t === 's').length
      const zTotal = zGoals + zSaves
      const zSvPct = zTotal >= 5 ? (zSaves / zTotal) : null
      return { ...z, goals: zGoals, saves: zSaves, total: zTotal, svPct: zSvPct }
    })

    function svColor(pct) {
      if (pct == null) return 'transparent'
      if (pct >= 0.960) return '#1D9E75'
      if (pct >= 0.930) return '#5DCAA5'
      if (pct >= 0.900) return '#FAC775'
      if (pct >= 0.860) return '#EF9F27'
      return '#E24B4A'
    }

    const ZONE_RECTS = {
      slot_hi:   { x: 105, y: 45,  w: 90, h: 48 },
      slot_lo:   { x: 105, y: 93,  w: 90, h: 45 },
      left_hi:   { x: 35,  y: 40,  w: 70, h: 53 },
      right_hi:  { x: 195, y: 40,  w: 70, h: 53 },
      left_lo:   { x: 25,  y: 93,  w: 80, h: 45 },
      right_lo:  { x: 195, y: 93,  w: 80, h: 45 },
      perimeter: { x: 25,  y: 138, w: 250,h: 40 },
    }

    const dotFiltered = filter === 'goals' ? shots.filter(s => s.t === 'g')
      : filter === 'saves' ? shots.filter(s => s.t === 's')
      : shots.filter(s => s.t === 'g' || s.t === 's')

    function toSvg(nx, ny) {
      const svgX = 150 + (ny / 42.5) * 125
      const svgY = 30  + ((89 - nx) / 34) * 148
      return { sx: Math.round(svgX), sy: Math.round(svgY) }
    }

    return (
      <div className={PP_HEATMAP_CLASSES}>
        <div className={PP_HEATMAP_SUMMARY_CLASSES}>
          <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>{t('gameStatsPopup.sections.goals')}</span></div>
          <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{saves}</span><span>{t('playerPopup.heatMap.goalie.saves')}</span></div>
          <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>{t('playerPopup.heatMap.goalie.shotsFaced')}</span></div>
          <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{svPct}</span><span>SV%</span></div>
        </div>
        <div className={PP_HEATMAP_FILTERS_CLASSES} style={{ marginBottom: 6 }}>
          <button className={heatmapChipClasses(mapMode === 'dots')} onClick={() => setMapMode('dots')}>{t('playerPopup.heatMap.goalie.dotMapToggle')}</button>
          <button className={heatmapChipClasses(mapMode === 'zones')} onClick={() => setMapMode('zones')}>{t('playerPopup.heatMap.goalie.zoneToggle')}</button>
        </div>
        {mapMode === 'dots' && (
          <div className={PP_HEATMAP_FILTERS_CLASSES}>
            {[
              { key: 'all',   label: t('playerPopup.heatMap.goalie.filterAll', { count: total }) },
              { key: 'goals', label: t('playerPopup.heatMap.goalie.filterGoals', { count: goals }) },
              { key: 'saves', label: t('playerPopup.heatMap.goalie.filterSaves', { count: saves }) },
            ].map(f => (
              <button key={f.key} className={heatmapChipClasses(filter === f.key)}
                onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        )}
        {mapMode === 'zones' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6, fontSize: 11 }}>
            {[['#1D9E75','.960+'],['#5DCAA5','.930+'],['#FAC775','.900+'],['#EF9F27','.860+'],['#E24B4A','<.860']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, color:'var(--text-muted)' }}>
                <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }} />{l}
              </span>
            ))}
            <span style={{ color:'var(--text-dim)', marginLeft:'auto' }}>{t('playerPopup.heatMap.goalie.minShots')}</span>
          </div>
        )}
        <div className={PP_HEATMAP_RINK_CLASSES}>
          <svg viewBox="0 0 300 230" width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display:'block' }}>
            <rect x="20" y="10" width="260" height="205" rx="12" fill="#d6eaf5" stroke="#9ab8cc" strokeWidth="1" />
            <rect x="133" y="10" width="34" height="14" rx="2" fill="rgba(204,34,0,0.08)" stroke="#cc2200" strokeWidth="1.5" />
            <line x1="35" y1="24" x2="265" y2="24" stroke="#E24B4A" strokeWidth="1.5" opacity="0.7" />
            <path d="M 128 24 A 22 18 0 0 0 172 24" fill="#378ADD" fillOpacity="0.2" stroke="#378ADD" strokeWidth="1" />
            <line x1="20" y1="178" x2="280" y2="178" stroke="#378ADD" strokeWidth="1.5" opacity="0.5" />
            <circle cx="90" cy="88" r="3.5" fill="#E24B4A" opacity="0.5" />
            <circle cx="210" cy="88" r="3.5" fill="#E24B4A" opacity="0.5" />
            <circle cx="90" cy="88" r="30" fill="none" stroke="#E24B4A" strokeWidth="0.7" opacity="0.25" />
            <circle cx="210" cy="88" r="30" fill="none" stroke="#E24B4A" strokeWidth="0.7" opacity="0.25" />
            {mapMode === 'zones' ? (
              <>
                {zoneStats.map(z => {
                  const r = ZONE_RECTS[z.id]
                  const col = svColor(z.svPct)
                  return (
                    <g key={z.id}>
                      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="3"
                        fill={col} opacity={z.svPct != null ? 0.55 : 0.08}
                        stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                      {z.svPct != null && (
                        <>
                          <text x={r.x + r.w/2} y={r.y + r.h/2 - 4} textAnchor="middle"
                            fontSize="12" fontWeight="700" fill="#111"
                            style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                            .{Math.round(z.svPct * 1000)}
                          </text>
                          <text x={r.x + r.w/2} y={r.y + r.h/2 + 11} textAnchor="middle"
                            fontSize="9" fontWeight="600" fill="#333"
                            style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                            {t('playerPopup.heatMap.goalie.zoneShotsCount', { count: z.total })}
                          </text>
                        </>
                      )}
                      {z.svPct == null && z.total > 0 && (
                        <text x={r.x + r.w/2} y={r.y + r.h/2 + 4} textAnchor="middle"
                          fontSize="9" fontWeight="600" fill="#333"
                          style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                          {t('playerPopup.heatMap.goalie.zoneShotsCount', { count: z.total })}
                        </text>
                      )}
                    </g>
                  )
                })}
              </>
            ) : (
              <>
                {dotFiltered.map((s, i) => {
                  const { sx, sy } = toSvg(s.x, s.y || 0)
                  if (sy < 10 || sy > 225 || sx < 10 || sx > 290) return null
                  return (
                    <circle key={i} cx={sx} cy={sy} r={s.t === 'g' ? 4.5 : 3.5}
                      fill={s.t === 'g' ? '#E24B4A' : '#1D9E75'}
                      opacity={s.t === 'g' ? 0.85 : 0.45} />
                  )
                })}
              </>
            )}
            <text x="150" y="224" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
              {t('playerPopup.heatMap.goalie.shooterCaption')}
            </text>
          </svg>
        </div>
      </div>
    )
  }

  // Skater heat map
  if (!shotData) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>{t('playerPopup.heatMap.skater.empty')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.skater.emptySub')}</div>
      </div>
    )
  }

  const shots = shotData.shots || []
  const typeMap = { g: 'goal', s: 'shot-on-goal', m: 'missed-shot', b: 'blocked-shot' }
  const allEvents = shots.map((s, i) => ({
    id: i, x: s.x, y: s.y,
    type: typeMap[s.t] || 'shot-on-goal',
    period: s.p, shotType: s.st,
    isCanes: true, shooterId: 'player',
  }))

  const filtered = filter === 'all'   ? allEvents
    : filter === 'goals'  ? allEvents.filter(e => e.type === 'goal')
    : filter === 'sog'    ? allEvents.filter(e => e.type === 'shot-on-goal')
    : filter === 'missed' ? allEvents.filter(e => e.type === 'missed-shot')
    : allEvents

  const goals   = allEvents.filter(e => e.type === 'goal').length
  const sog     = allEvents.filter(e => e.type === 'shot-on-goal').length
  const missed  = allEvents.filter(e => e.type === 'missed-shot').length
  const total   = allEvents.length
  const sh      = (goals + sog) > 0 ? ((goals / (goals + sog)) * 100).toFixed(1) : '—'

  return (
    <div className={PP_HEATMAP_CLASSES}>
      <div className={PP_HEATMAP_SUMMARY_CLASSES}>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>{t('gameStatsPopup.sections.goals')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{sog}</span><span>SOG</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{missed}</span><span>{t('playerPopup.heatMap.skater.missed')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>{t('shotMapView.drillPopup.total')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{sh}%</span><span>SH%</span></div>
        {shotData.games && <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{shotData.games}</span><span>{t('playerPopup.heatMap.skater.games')}</span></div>}
      </div>
      <div className={PP_HEATMAP_FILTERS_CLASSES}>
        {[
          { key: 'all',    label: t('playerPopup.heatMap.skater.filterAll', { count: total }) },
          { key: 'goals',  label: t('playerPopup.heatMap.skater.filterGoals', { count: goals }) },
          { key: 'sog',    label: t('playerPopup.heatMap.skater.filterSog', { count: sog }) },
          { key: 'missed', label: t('playerPopup.heatMap.skater.filterMissed', { count: missed }) },
        ].map(f => (
          <button key={f.key} className={heatmapChipClasses(filter === f.key)}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className={PP_HEATMAP_RINK_CLASSES}>
        <HockeyRink events={toHockeyRinkEvents(filtered)} teamAbbr={TEAM_CONFIG.abbr} teamColor="var(--team-primary)" hidePlayerFilter />
      </div>
    </div>
  )
}

// ─── Analytics ────────────────────────────────────────────────

// PercentileBar moved to components/PercentileBar.jsx (Session 91).

function PlayerAnalytics({ mpData, goalieData, _playerName, isGoalie, position, narrativeData, isLeagueContext }) {
  const { t } = useTranslation()
  if (isGoalie) {
    if (!goalieData) {
      return (
        <div className={PP_HEATMAP_EMPTY_CLASSES}>
          <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
          <div>{t('playerPopup.analytics.emptyState')}</div>
          <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.analytics.emptyStateSub')}</div>
        </div>
      )
    }
    const { gsax, gsax60, gp, evSvPct, hdSvPct, mdSvPct, pkSvPct, percentiles: p } = goalieData
    const gsaxColor = gsax >= 5 ? '#4ade80' : gsax >= 0 ? '#fbbf24' : '#f87171'
    const gsaxLabel = gsax >= 10 ? t('playerPopup.analytics.goalie.tierElite') : gsax >= 5 ? t('playerPopup.analytics.goalie.tierAboveAverage') : gsax >= 0 ? t('playerPopup.analytics.goalie.tierAverage') : t('playerPopup.analytics.goalie.tierBelowAverage')
    return (
      <div className={PA_WRAP_CLASSES}>
        <div className={PA_WAR_CARD_CLASSES}>
          <div className={PA_WAR_MAIN_CLASSES}>
            <span className={PA_WAR_NUM_CLASSES} style={{ color: gsaxColor }}>{gsax > 0 ? '+' : ''}{gsax}</span>
            <span className={PA_WAR_LABEL_CLASSES}>GSAX</span>
          </div>
          <div className={PA_WAR_META_CLASSES}>
            <span style={{ color: gsaxColor }}>{gsaxLabel}</span>
            <span className={PA_WAR_SUB_CLASSES}>{gsax60 != null ? t('playerPopup.analytics.goalie.gpAndPer60', { gp, value: `${gsax60 > 0 ? '+' : ''}${gsax60}` }) : `${gp} GP`}</span>
            <span className={PA_WAR_SUB_CLASSES} style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              {t('playerPopup.analytics.goalie.gsaxCaption')}
            </span>
          </div>
        </div>
        <div className={`${PA_CONTEXT_CLASSES} ${PA_CONTEXT_CENTERED_CLASSES}`}>
          {evSvPct != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{evSvPct}%</span><span className={PA_CTX_LABEL_CLASSES}>5on5 SV% <InfoTip text={t('playerPopup.analytics.goalie.tip5v5SvPct')} position="above" /></span></div>}
          {hdSvPct != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{hdSvPct}%</span><span className={PA_CTX_LABEL_CLASSES}>HD SV% <InfoTip text={t('playerPopup.analytics.goalie.tipHdSvPct')} position="above" /></span></div>}
          {mdSvPct != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{mdSvPct}%</span><span className={PA_CTX_LABEL_CLASSES}>MD SV% <InfoTip text={t('playerPopup.analytics.goalie.tipMdSvPct')} position="above" /></span></div>}
          {pkSvPct != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{pkSvPct}%</span><span className={PA_CTX_LABEL_CLASSES}>PK SV% <InfoTip text={t('playerPopup.analytics.goalie.tipPkSvPct')} position="above" /></span></div>}
        </div>
        <div className={PA_SECTION_LABEL_CLASSES}>{t('playerPopup.analytics.percentileVsGoalies')}</div>
        <div className={PA_BARS_CLASSES}>
          <PercentileBar label="GSAX"            pct={p.gsax?.pct}   note={p.gsax?.note} />
          <PercentileBar label={t('playerPopup.analytics.goalie.barGsax60')}         pct={p.gsax60?.pct} note={p.gsax60?.note} />
          <PercentileBar label={t('playerPopup.analytics.goalie.bar5v5SvPct')}      pct={p.evSv?.pct}   note={p.evSv?.note} />
          <PercentileBar label={t('playerPopup.analytics.goalie.barHighDangerSvPct')} pct={p.hdSv?.pct}   note={p.hdSv?.note} />
          <PercentileBar label={t('playerPopup.analytics.goalie.barMedDangerSvPct')}  pct={p.mdSv?.pct}   note={p.mdSv?.note} />
          <PercentileBar label={t('playerPopup.analytics.goalie.barPkSvPct')}          pct={p.pkSv?.pct}   note={p.pkSv?.note} />
        </div>
        <div className={PA_SOURCE_CLASSES}>{t('playerPopup.analytics.dataSource')}</div>
      </div>
    )
  }

  if (!mpData) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🧮</div>
        <div>{t('playerPopup.analytics.emptyState')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.analytics.emptyStateSub')}</div>
      </div>
    )
  }

  const { war, percentiles, gp, xGF_pct, xGF60, xGA60, hdca60, goals60, a1_60, ppToi, pkToi, gameScore } = mpData
  const pos      = ['C','L','R','F'].includes(position) ? 'F' : 'D'
  const posLbl   = pos === 'F' ? t('playerPopup.analytics.positionForwards') : t('playerPopup.analytics.positionDefensemen')
  const p        = percentiles || {}
  const fmtToi   = (mins) => { if (mins == null) return null; const m = Math.floor(mins); const s = Math.round((mins - m) * 60); return `${m}:${String(s).padStart(2, '0')}` }
  const warColor = war >= 2 ? '#4ade80' : war >= 0.5 ? '#fbbf24' : '#f87171'
  const warLabel = war >= 4 ? t('playerPopup.analytics.skater.tierMvp') : war >= 2 ? t('playerPopup.analytics.skater.tierTop')
    : war >= 0.5 ? t('playerPopup.analytics.skater.tierSolid') : war >= -0.5 ? t('playerPopup.analytics.skater.tierReplacement') : t('playerPopup.analytics.skater.tierBelowReplacement')

  return (
    <div className={PA_WRAP_CLASSES}>
      <div className={PA_WAR_CARD_CLASSES}>
        <div className={PA_WAR_MAIN_CLASSES}>
          <span className={PA_WAR_NUM_CLASSES} style={{ color: warColor }}>{war > 0 ? '+' : ''}{war}</span>
          <span className={PA_WAR_LABEL_CLASSES}>
            WAR
            <InfoTip text={t('playerPopup.analytics.skater.warTip')} position="above" />
          </span>
        </div>
        <div className={PA_WAR_META_CLASSES}>
          <span style={{ color: warColor }}>{warLabel}</span>
          <span className={PA_WAR_SUB_CLASSES}>{t('playerPopup.analytics.skater.gpAndGameScore', { gp, score: gameScore })}</span>
          <span className={PA_WAR_SUB_CLASSES} style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
            {t('playerPopup.analytics.skater.rapmCaption')}
          </span>
        </div>
      </div>
      <div className={PA_CONTEXT_CLASSES}>
        {xGF_pct != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{xGF_pct}%</span><span className={PA_CTX_LABEL_CLASSES}>EV xGF% <InfoTip text={t('playerPopup.analytics.skater.tipEvXgfPct')} position="above" /></span></div>}
        {xGF60  != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{xGF60}</span><span className={PA_CTX_LABEL_CLASSES}>xGF/60 <InfoTip text={t('playerPopup.analytics.skater.tipXgf60')} position="above" /></span></div>}
        {xGA60  != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES} style={{ color: xGA60 < 2.0 ? 'var(--green)' : xGA60 > 2.8 ? 'var(--red-bright)' : 'inherit' }}>{xGA60}</span><span className={PA_CTX_LABEL_CLASSES}>xGA/60 <InfoTip text={t('playerPopup.analytics.skater.tipXga60')} position="above" /></span></div>}
        {hdca60 != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES} style={{ color: hdca60 < 7 ? 'var(--green)' : hdca60 > 10 ? 'var(--red-bright)' : 'inherit' }}>{hdca60}</span><span className={PA_CTX_LABEL_CLASSES}>HDCA/60 <InfoTip text={t('playerPopup.analytics.skater.tipHdca60')} position="above" /></span></div>}
        {goals60!= null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{goals60}</span><span className={PA_CTX_LABEL_CLASSES}>G/60 <InfoTip text={t('playerPopup.analytics.skater.tipGoals60')} position="above" /></span></div>}
        {a1_60  != null && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{a1_60}</span><span className={PA_CTX_LABEL_CLASSES}>A1/60 <InfoTip text={t('playerPopup.analytics.skater.tipA160')} position="above" /></span></div>}
        {ppToi != null && ppToi > 0 && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{fmtToi(ppToi)}</span><span className={PA_CTX_LABEL_CLASSES}>PP TOI <InfoTip text={t('playerPopup.analytics.skater.tipPpToi')} position="above" /></span></div>}
        {pkToi != null && pkToi > 0 && <div className={PA_CTX_ITEM_CLASSES}><span className={PA_CTX_VAL_CLASSES}>{fmtToi(pkToi)}</span><span className={PA_CTX_LABEL_CLASSES}>PK TOI <InfoTip text={t('playerPopup.analytics.skater.tipPkToi')} position="above" /></span></div>}
      </div>
      <div className={PA_SECTION_LABEL_CLASSES}>{t('playerPopup.analytics.percentileVsPosition', { position: posLbl })}</div>
      <div className={PA_BARS_CLASSES}>
        <PercentileBar label={t('playerPopup.analytics.skater.barEvOffence')}    pct={p.evOff?.pct}     note={p.evOff?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barEvDefence')}    pct={p.evDef?.pct}     note={p.evDef?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barPowerPlay')}    pct={p.pp?.pct}        note={p.pp?.note}    na={p.pp?.pct == null} />
        <PercentileBar label={t('playerPopup.analytics.skater.barPenaltyKill')}  pct={p.pk?.pct}        note={p.pk?.note}    na={p.pk?.pct == null} />
        <PercentileBar label={t('playerPopup.analytics.skater.barFinishing')}     pct={p.finishing?.pct} note={p.finishing?.note} />
        <PercentileBar label={t('gameStatsPopup.sections.goals')}         pct={p.goals?.pct}     note={p.goals?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barFirstAssists')}   pct={p.a1?.pct}        note={p.a1?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barPenalties')}     pct={p.penalties?.pct} note={p.penalties?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barCompetition')}   pct={p.comp?.pct}      note={p.comp?.note} />
        <PercentileBar label={t('playerPopup.analytics.skater.barTeammates')}     pct={p.teammates?.pct} note={p.teammates?.note} />
      </div>
      {!isLeagueContext && (
        <ResultsVsProcess
          onIceGfPct={mpData.onIceGfPct}
          resultsVsProcessDiff={mpData.resultsVsProcessDiff}
          narrativeData={narrativeData}
        />
      )}
      <div className={PA_SOURCE_CLASSES}>{t('playerPopup.analytics.dataSource')}</div>
    </div>
  )
}

// ─── Results vs. Process ──────────────────────────────────────
// Pairs on-ice results (on_ice_gf_pct) against underlying process (the
// existing EV xGF% percentile) to surface over/underperforming players.
// Both mpData fields are null below eyewall-pipeline's GP≥25 guardrail
// (moneypuck.py::RESULTS_VS_PROCESS_MIN_GP) -- that's the only check made
// here, no GP threshold is re-derived on this side.

function ResultsVsProcess({ onIceGfPct, resultsVsProcessDiff, narrativeData }) {
  const { t } = useTranslation()
  if (resultsVsProcessDiff == null) {
    return (
      <div className={RVP_WRAP_CLASSES}>
        <div className={PA_SECTION_LABEL_CLASSES}>{t('playerPopup.resultsVsProcess.sectionLabel')}</div>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>⏳</div>
          <div>{t('playerPopup.resultsVsProcess.emptyState')}</div>
          <div className={SCOUT_EMPTY_SUB_CLASSES}>{t('playerPopup.resultsVsProcess.emptyStateSub')}</div>
        </div>
      </div>
    )
  }

  const outperforming = resultsVsProcessDiff > 0
  const diffColor = outperforming ? '#4ade80' : '#f87171'
  const directionLabel = outperforming ? t('playerPopup.resultsVsProcess.outperforming') : t('playerPopup.resultsVsProcess.underperforming')

  return (
    <div className={RVP_WRAP_CLASSES}>
      <div className={PA_SECTION_LABEL_CLASSES}>{t('playerPopup.resultsVsProcess.sectionLabel')}</div>
      <div className={RVP_CONTEXT_CLASSES}>
        <div className={PA_CTX_ITEM_CLASSES}>
          <span className={PA_CTX_VAL_CLASSES}>{onIceGfPct}%</span>
          <span className={PA_CTX_LABEL_CLASSES}>On-Ice GF% <InfoTip text={t('playerPopup.resultsVsProcess.tipOnIceGf')} position="above" /></span>
        </div>
        <div className={PA_CTX_ITEM_CLASSES}>
          <span className={PA_CTX_VAL_CLASSES} style={{ color: diffColor }}>{resultsVsProcessDiff > 0 ? '+' : ''}{resultsVsProcessDiff}%</span>
          <span className={PA_CTX_LABEL_CLASSES}>{t('playerPopup.resultsVsProcess.gapVsProcessLabel')} <InfoTip text={t('playerPopup.resultsVsProcess.tipGapVsProcess')} position="above" /></span>
        </div>
      </div>
      <div style={{ color: diffColor, fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{directionLabel}</div>
      {narrativeData === undefined ? (
        <div className={SCOUT_LOADING_CLASSES}>
          {[92, 85, 70].map((w, i) => (
            <div key={i} className={SKELETON_CLASSES} style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      ) : narrativeData?.blurb ? (
        <div className={SCOUT_BLURB_CLASSES}>{narrativeData.blurb}</div>
      ) : (
        <div className={SCOUT_EMPTY_SUB_CLASSES}>{t('playerPopup.resultsVsProcess.narrativeFallback')}</div>
      )}
    </div>
  )
}

// ─── Scouting Blurb ───────────────────────────────────────────

function ScoutingBlurb({ data, playerName }) {
  const { t } = useTranslation()
  if (data === undefined) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_LOADING_CLASSES}>
          {[95, 88, 72, 90, 65].map((w, i) => (
            <div key={i} className={SKELETON_CLASSES} style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    )
  }
  if (!data?.blurb) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>📋</div>
          <div>{t('playerPopup.scoutingBlurb.emptyState', { player: playerName })}</div>
          <div className={SCOUT_EMPTY_SUB_CLASSES}>{t('playerPopup.scoutingBlurb.emptyStateSub')}</div>
        </div>
      </div>
    )
  }
  function fmtDate(iso) {
    if (!iso) return null
    return formatDate(iso, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return (
    <div className={SCOUT_WRAP_CLASSES}>
      <div className={SCOUT_HEADER_CLASSES}>
        <span className={SCOUT_LABEL_CLASSES}>{t('playerPopup.scoutingBlurb.header')}</span>
        <span className={SCOUT_SEASON_CLASSES}>{SEASON_LABEL}</span>
      </div>
      <div className={SCOUT_BLURB_CLASSES}>{data.blurb}</div>
      <div className={SCOUT_FOOTER_CLASSES}>
        {t('playerPopup.scoutingBlurb.footer')}
        {data.generatedAt && ` · ${fmtDate(data.generatedAt)}`}
      </div>
    </div>
  )
}

// ─── PlayerPopup ──────────────────────────────────────────────

export default function PlayerPopup({ player: p, inPlayoffs, standings, onClose, isLeagueContext = false }) {
  const { t } = useTranslation()
  const { data: stats, loading } = useFetch(() => p.id ? getPlayerStats(p.id) : Promise.resolve(null), [p.id])
  const [imgErr, setImgErr]     = useState(false)

  // In league context only show Stats + Analytics; in roster context show all four
  const defaultTab = 'stats'
  const [ppTab, setPpTab] = useState(defaultTab)
  const [compareSeasons, setCompareSeasons] = useState([])

  const { data: scoutData } = useFetch(
    () => !isLeagueContext ? getScoutingBlurb(p.id, SEASON) : Promise.resolve(undefined),
    [p.id, isLeagueContext]
  )

  // headshot: prefer from stats response (always populated), fall back to roster object
  const name     = `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim()
  const isGoalie = p.positionCode === 'G'

  // Shot data — only fetch in CAR roster context
  const { data: shotData } = useFetch(
    () => !isLeagueContext ? getPlayerShots(p.id, undefined, TEAM_CONFIG.abbr) : Promise.resolve(null),
    [p.id, isLeagueContext]
  )
  const { data: goalieShotData } = useFetch(
    () => (!isLeagueContext && isGoalie) ? getGoalieShots(p.id) : Promise.resolve(null),
    [p.id, isGoalie, isLeagueContext]
  )

  const { data: mpAll } = useFetch(() => getPlayerAnalytics(), [])
  const mpData = mpAll?.[String(p.id)] || null

  const { data: goalieAll } = useFetch(() => getGoalieAnalytics(), [])
  const goalieData = goalieAll?.[String(p.id)] || null

  // Results-vs-process narrative — skater-only (no on-ice GF/GA split for
  // goalies), same CAR-roster-context gating as the Scout tab/ScoutingBlurb.
  const { data: rvpNarrative } = useFetch(
    () => (!isLeagueContext && !isGoalie) ? getResultsVsProcessNarrative(p.id, SEASON) : Promise.resolve(undefined),
    [p.id, isGoalie, isLeagueContext]
  )

  const seasonPO  = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 3)
  let   seasonReg = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
  const careerPO  = stats?.careerTotals?.playoffs
  const careerReg = stats?.careerTotals?.regularSeason

  // Whole-season fallback (Session 66) — mirrors mpData.statsStale/
  // statsSeason, but this is a SEPARATE data source (the NHL API's own
  // seasonTotals, already fully fetched for the Career accordions below --
  // no new network call needed) with its own independent "does the live
  // season have a real row yet" answer. The redesigned tile grid is only
  // ever attached to whichever section has highlight: true, so without
  // this, a player with no live-season box score (true right now for
  // every NHL player) never gets the new layout at all, even once
  // /player-analytics has real fallback percentiles to show.
  let boxStatsStale = false
  let boxStatsSeason = null
  if (!seasonReg) {
    const priorReg = (stats?.seasonTotals || [])
      .filter(s => s.season < SEASON && s.gameTypeId === 2)
      .sort((a, b) => b.season - a.season)[0]
    if (priorReg) {
      seasonReg = priorReg
      boxStatsStale = true
      boxStatsSeason = String(priorReg.season)
    }
  }
  const regSeasonLabel = boxStatsStale ? nhlSeasonLabel(boxStatsSeason) : SEASON_LABEL

  // Rankings — skip in league context (requires team/division membership we don't have)
  const { data: rankings } = useFetch(
    () => (!isLeagueContext && stats && standings?.length)
      ? fetchPlayerRankings(p.id, isGoalie, inPlayoffs, p.teamAbbrev || TEAM_CONFIG.abbr, standings)
      : Promise.resolve(null),
    [p.id, !!stats, !!standings?.length, inPlayoffs, isLeagueContext]
  )

  const sections = inPlayoffs
    ? [
        { label: t('playerPopup.sections.seasonPlayoffs', { season: SEASON_LABEL }), stats: seasonPO,  highlight: true },
        { label: t('playerPopup.sections.careerPlayoffs'),                            stats: careerPO,  highlight: false },
        { label: t('playerPopup.sections.seasonRegular', { season: SEASON_LABEL }),  stats: seasonReg, highlight: false },
        { label: t('playerPopup.sections.careerRegular'),                            stats: careerReg, highlight: false },
      ]
    : [
        { label: t('playerPopup.sections.seasonRegular', { season: regSeasonLabel }), stats: seasonReg, highlight: true },
        { label: t('playerPopup.sections.seasonPlayoffs', { season: SEASON_LABEL }), stats: seasonPO,  highlight: false },
        { label: t('playerPopup.sections.careerRegular'),                            stats: careerReg, highlight: false },
        { label: t('playerPopup.sections.careerPlayoffs'),                            stats: careerPO,  highlight: false },
      ]

  const statDefs = isGoalie ? GOALIE_STATS : SKATER_STATS

  // ── Stats tab sections (Session 73) ─────────────────────────────
  // Every section renders as a tile grid now, not just the highlighted one
  // (Session 72 found every StatSection instance in this file was hiding a
  // comparison, not doing legitimate density-organizing work -- see
  // SESSION_72_FINDINGS). The highlighted section still renders full-width
  // on its own; the rest render together in a wrapping row so Career
  // Regular/Playoffs (and the current season's sibling game-type) are all
  // visible at once instead of one click-to-expand at a time.
  const statsTabSections = loading ? [] : sections
    .map(({ label, stats: s, highlight }) => {
      if (!s) return null
      let enriched = (isGoalie && goalieData?.qsPct != null)
        ? { ...s, qualityStartPct: goalieData.qsPct }
        : s
      if (!isGoalie && mpData) {
        if (s?.gameTypeId === 2) {
          enriched = { ...enriched, hits: mpData.hits ?? undefined, blockedShots: mpData.blockedShots ?? undefined, takeaways: mpData.takeaways ?? undefined, giveaways: mpData.giveaways ?? undefined }
        } else if (s?.gameTypeId === 3 && mpData.poDef) {
          enriched = { ...enriched, hits: mpData.poDef.hits ?? undefined, blockedShots: mpData.poDef.blockedShots ?? undefined, takeaways: mpData.poDef.takeaways ?? undefined, giveaways: mpData.poDef.giveaways ?? undefined }
        }
      }
      const groups = groupStats(statDefs, enriched, isGoalie)
      if (!groups.length) return null
      return {
        highlight,
        node: (
          <TileStatSection
            key={label} label={label} groups={groups} highlight={highlight}
            percentiles={!isGoalie && highlight ? mpData?.percentiles : undefined}
            statsStale={boxStatsStale} statsSeason={boxStatsSeason}
            pctMap={STAT_PCT_MAP}
          />
        ),
      }
    })
    .filter(Boolean)
  const currentStatSections = statsTabSections.filter(r => r.highlight).map(r => r.node)
  const otherStatSections   = statsTabSections.filter(r => !r.highlight).map(r => r.node)

  // ── Compare tab per-game trend chart (Session 70) ──────────────
  // Chart-ready metrics only (statDefs entries flagged `perGame` above);
  // everything else still shows in the per-season tile grid below.
  const chartableStatDefs = statDefs.filter(d => d.perGame)
  const [chartMetricKey, setChartMetricKey] = useState(null)
  const activeChartDef = chartableStatDefs.find(d => d.key === chartMetricKey) || chartableStatDefs[0] || null

  const { data: gameLogsBySeason, loading: gameLogLoading } = useFetch(
    () => (compareSeasons.length
      ? Promise.all(compareSeasons.map(season => getPlayerGameLog(p.id, season, GAME_TYPE.REGULAR)))
      : Promise.resolve([])),
    [p.id, compareSeasons.join(',')]
  )

  const compareSeasonsSortedDesc = useMemo(
    () => [...compareSeasons].sort((a, b) => b - a),
    [compareSeasons]
  )

  const chartSeries = useMemo(() => {
    if (!activeChartDef || !gameLogsBySeason) return []
    const logBySeason = new Map(compareSeasons.map((s, i) => [s, gameLogsBySeason[i]?.gameLog || []]))
    const baseColor = teamColorFor(p.teamAbbrev)
    return compareSeasonsSortedDesc.map((season, idx) => {
      // NHL's game-log endpoint returns newest-first; reverse so gameNumber
      // 1 is the season's first game, matching SeasonOverlayChart's x-axis.
      const games = (logBySeason.get(season) || []).slice().reverse()
      let running = 0
      const dataPoints = games.map((g, i) => {
        const raw = perGameRawValue(activeChartDef, g)
        if (activeChartDef.cumulative) {
          if (raw != null) running += raw
          return { gameNumber: i + 1, value: running }
        }
        return { gameNumber: i + 1, value: raw }
      })
      return {
        seasonLabel: nhlSeasonLabel(season),
        color: seasonRampColor(baseColor, idx, compareSeasonsSortedDesc.length),
        dashPattern: CHART_DASH_PATTERNS[idx % CHART_DASH_PATTERNS.length],
        dataPoints,
      }
    })
  }, [activeChartDef, gameLogsBySeason, compareSeasons, compareSeasonsSortedDesc, p.teamAbbrev])

  function fmtHeight(inches) {
    if (!inches) return null
    return `${Math.floor(inches / 12)}′${inches % 12}″`
  }
  function fmtBirth(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr + 'T12:00:00')
    return formatDate(d, { month: 'long', day: 'numeric', year: 'numeric' })
  }
  function calcAge(dateStr) {
    if (!dateStr) return null
    const today = new Date(), dob = new Date(dateStr)
    let age = today.getFullYear() - dob.getFullYear()
    if (today.getMonth() < dob.getMonth() ||
        (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--
    return age
  }

  const bio      = stats || p
  // carContracts.js only has real data for CAR — for any other selected team,
  // findContract()'s last-name fallback can false-positive against CAR's roster
  // (e.g. a shared surname), so gate on the selected team too, not just
  // roster-vs-league context. Matches TeamView.jsx's Cap-tab guard.
  const contract = (!isLeagueContext && TEAM_CONFIG.abbr === 'CAR')
    ? findContract(p.id, p.lastName?.default) : null

  // Derive positionCode from stats if not on the player object (league context)
  const positionCode = p.positionCode || stats?.position || null

  // ── Header + Stats tab redesign inputs (NHL skaters only, Session 66) ──
  // isGoalie already computed above; PWHL never reaches this component.
  const teamAbbr  = p.teamAbbrev || TEAM_CONFIG.abbr
  const teamColor = teamColorFor(teamAbbr)
  const currentSection   = sections.find(sec => sec.highlight)
  const currentBoxStats  = currentSection?.stats || null

  // ── Header reflow (Session 80) — two-column top row (compact identity |
  // radar + 2x2 totals) plus a full-width 6-column bio row underneath.
  // Scoped to exactly the case SkaterHeaderPanel/GoalieHeaderPanel already
  // render for (percentiles present for whichever type this player is) --
  // the pre-percentiles loading flash keeps the original single-block
  // header rather than splitting into a two-column layout with nothing to
  // put on the right. Goalies now reflow too (previously always false for
  // goalies here, before goalieData.percentiles had anywhere to render).
  const showHeaderReflow = isGoalie ? !!goalieData?.percentiles : !!mpData?.percentiles
  const bioFields = [
    { label: t('playerPopup.bio.height'),    value: bio.heightInInches ? fmtHeight(bio.heightInInches) : null },
    { label: t('playerPopup.bio.weight'),    value: bio.weightInPounds ? t('playerPopup.bio.weightLbs', { weight: bio.weightInPounds }) : null },
    { label: isGoalie ? t('playerPopup.bio.catches') : t('playerPopup.bio.shoots'),
      value: p.shootsCatches ? (p.shootsCatches === 'L' ? t('playerPopup.bio.left') : t('playerPopup.bio.right')) : null },
    { label: t('playerPopup.bio.age'),       value: bio.birthDate ? calcAge(bio.birthDate) : null },
    { label: t('playerPopup.bio.birthdate'), value: bio.birthDate ? fmtBirth(bio.birthDate) : null },
    { label: t('playerPopup.bio.hometown'),  value: bio.birthCity?.default
        ? `${bio.birthCity.default}${bio.birthCountry ? `, ${bio.birthCountry}` : ''}`
        : null },
  ]

  // Built once, placed either inline in .pp-header (goalies/loading, no
  // radar to compress) or stacked under SkaterHeaderPanel's quickstats
  // grid (skaters with a reflowed header) -- see showHeaderReflow below.
  const comparisonEntry = (
    <PlayerComparisonEntry
      sport="nhl"
      player={{
        id: p.id,
        name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(),
        // Deliberately p.teamAbbrev directly, not the `teamAbbr` var above
        // -- that one falls back to TEAM_CONFIG.abbr (this app's
        // currently-selected team, default CAR) when missing, which is
        // fine for its actual use (a radar-color fallback) but reads as a
        // real, wrong team label if reused here. Confirmed live:
        // /players-search-index can return team:null for a player
        // (Shesterkin, this session), which would otherwise silently show
        // "CAR" for a Rangers goalie.
        team: p.teamAbbrev || null,
        position: positionCode,
      }}
    />
  )

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className={PLAYER_POPUP_CLASSES} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={ppHeaderClasses(showHeaderReflow)}>
          <div className={PP_PHOTO_WRAP_CLASSES}>
            {!imgErr && (stats?.headshot || p.headshot) ? (
              <img src={stats?.headshot || p.headshot} alt={name}
                className={PP_PHOTO_CLASSES} onError={() => setImgErr(true)} />
            ) : (
              <div className={PP_PHOTO_FALLBACK_CLASSES}>
                {(p.firstName?.default?.[0] || '') + (p.lastName?.default?.[0] || '')}
              </div>
            )}
          </div>
          <div className={showHeaderReflow ? PP_IDENTITY_REFLOW_CLASSES : PP_IDENTITY_DEFAULT_CLASSES}>
            {p.sweaterNumber && <div className={PP_NUM_CLASSES}>#{p.sweaterNumber}</div>}
            <div className={PP_NAME_CLASSES}>
              <span className={PP_FIRST_CLASSES}>{p.firstName?.default}</span>
              <span className={`${PP_LAST_CLASSES} ${showHeaderReflow ? PP_LAST_REFLOW_CLASSES : ''}`}>{p.lastName?.default}</span>
            </div>
            <div className={PP_CHIPS_CLASSES}>
              {positionCode && <span className={PP_POS_CHIP_CLASSES}>{posLabel(positionCode)}</span>}
              {/* In league context show team abbrev as a chip */}
              {isLeagueContext && p.teamAbbrev && (
                <span className={PP_CHIP_CLASSES}>{p.teamAbbrev}</span>
              )}
              {!showHeaderReflow && bio.heightInInches && <span className={PP_CHIP_CLASSES}>{fmtHeight(bio.heightInInches)}</span>}
              {!showHeaderReflow && bio.weightInPounds && <span className={PP_CHIP_CLASSES}>{t('playerPopup.bio.weightLbs', { weight: bio.weightInPounds })}</span>}
              {!showHeaderReflow && p.shootsCatches && (
                <span className={PP_CHIP_CLASSES}>{isGoalie ? t('playerPopup.bio.catches') : t('playerPopup.bio.shoots')} {p.shootsCatches === 'L' ? t('playerPopup.bio.left') : t('playerPopup.bio.right')}</span>
              )}
            </div>
            {!showHeaderReflow && bio.birthDate && (
              <div className={PP_BIRTH_CLASSES}>
                {t('playerPopup.bio.birthAge', { birth: fmtBirth(bio.birthDate), age: calcAge(bio.birthDate) })}
                {bio.birthCity?.default && ` · ${bio.birthCity.default}`}
                {bio.birthCountry && `, ${bio.birthCountry}`}
              </div>
            )}
          </div>
          {showHeaderReflow && isGoalie && (
            // goalieData.statsStale/statsSeason (eyewall-poller#56) -- the
            // same whole-season-empty fallback flag mpData already carried
            // for skaters, now that /goalie-analytics has the equivalent
            // fallback. Same shape as SkaterHeaderPanel's props below, just
            // sourced from goalieData instead of mpData.
            <GoalieHeaderPanel
              percentiles={goalieData.percentiles}
              boxStats={currentBoxStats}
              teamColor={teamColor}
              statsStale={goalieData.statsStale}
              statsSeason={goalieData.statsSeason}
              comparisonEntry={comparisonEntry}
            />
          )}
          {showHeaderReflow && !isGoalie && (
            <SkaterHeaderPanel
              percentiles={mpData.percentiles}
              boxStats={currentBoxStats}
              teamColor={teamColor}
              statsStale={mpData.statsStale}
              statsSeason={mpData.statsSeason}
              comparisonEntry={comparisonEntry}
            />
          )}
          {!showHeaderReflow && comparisonEntry}
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label={t('playerPopup.bio.closeAriaLabel')}>✕</button>
        </div>

        {/* ── Bio row — full width, 6 evenly-spaced columns (Session 80) ── */}
        {showHeaderReflow && (
          <div className={PP_BIO_ROW_CLASSES}>
            {bioFields.map(f => (
              <div className={PP_BIO_FIELD_CLASSES} key={f.label}>
                <div className={PP_BIO_LABEL_CLASSES}>{f.label}</div>
                <div className={PP_BIO_VALUE_CLASSES}>{f.value ?? '—'}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rankings banner — CAR context only ── */}
        {!isLeagueContext && rankings && (rankings.division || rankings.conference || rankings.league) && (
          <div className={PP_RANKINGS_CLASSES}>
            <span className={PP_RANK_LABEL_CLASSES}>{t('playerPopup.rankings.rankedBy', { stat: rankings.statLabel })}</span>
            <div className={PP_RANK_ITEMS_CLASSES}>
              {rankings.division   && <RankBadge label={t('statTileGrid.scopes.div')}   rank={rankings.division} />}
              {rankings.conference && <RankBadge label={t('statTileGrid.scopes.conf')} rank={rankings.conference} />}
              {rankings.league     && <RankBadge label={t('statTileGrid.scopes.league')}     rank={rankings.league} />}
            </div>
            {rankings.gaa && (rankings.gaa.league || rankings.gaa.division) && (
              <>
                <span className={PP_RANK_LABEL_CLASSES} style={{ marginTop: 8 }}>{t('playerPopup.rankings.rankedByGaa')}</span>
                <div className={PP_RANK_ITEMS_CLASSES}>
                  {rankings.gaa.division   && <RankBadge label={t('statTileGrid.scopes.div')}   rank={rankings.gaa.division} />}
                  {rankings.gaa.conference && <RankBadge label={t('statTileGrid.scopes.conf')} rank={rankings.gaa.conference} />}
                  {rankings.gaa.league     && <RankBadge label={t('statTileGrid.scopes.league')}     rank={rankings.gaa.league} />}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Contract & value panel — CAR context only ── */}
        {!isLeagueContext && contract && (
          <div className={PP_CONTRACT_CLASSES}>
            <div className={PP_CONTRACT_ROW_CLASSES}>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.capHit')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.aavPerYear')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>${(contract.capHit / 1_000_000).toFixed(2)}M</div>
              </div>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.expiresAfter')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>{contract.expiresAfter}</div>
              </div>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.status')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>{contract.type}{contract.note ? ` · ${contract.note}` : ''}</div>
              </div>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.yrsLeft')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>{contract.yearsLeft}</div>
              </div>
              <div className={PP_CONTRACT_ITEM_CLASSES}>
                <div className={PP_CONTRACT_LABEL_CLASSES}>{t('playerPopup.contract.pctOfCap')}</div>
                <div className={PP_CONTRACT_VAL_CLASSES}>{((contract.capHit / CAP_CEILING) * 100).toFixed(1)}%</div>
              </div>
            </div>
            {(() => {
              const regStats = stats?.seasonTotals?.find(s => s.season === SEASON && s.gameTypeId === 2)
              const pts   = regStats?.points ?? 0
              const gp    = regStats?.gamesPlayed ?? 0
              const isELC = contract.note === 'ELC' || contract.capHit < 1_200_000
              const war   = mpData?.war ?? null
              const result = !isGoalie && gp > 0 ? contractValue(pts, gp, contract.capHit, isELC, war) : null
              const score  = result?.score ?? null
              const method = result?.method ?? 'points'
              const vl     = valueLabel(score)
              const p60    = !isGoalie && regStats?.avgToi
                ? pointsPer60(pts, (regStats.avgToi?.includes?.(':')
                    ? regStats.avgToi.split(':').reduce((m,s,i) => i===0 ? +s*60 : m + +s, 0)
                    : Number(regStats.avgToi)) * gp)
                : null
              const valueTooltip = method === 'blended'
                ? t('playerPopup.contract.valueTooltipBlended')
                : t('playerPopup.contract.valueTooltipPointsOnly')
              return (
                <div className={PP_VALUE_ROW_CLASSES}>
                  {score != null && vl && (
                    <div className={PP_VALUE_BADGE_CLASSES} style={{ background: vl.color + '22', borderColor: vl.color + '55', color: vl.color }}>
                      <span>{vl.label}</span>
                      <span className={PP_VALUE_SCORE_CLASSES}>{score} {method === 'blended' ? t('playerPopup.contract.blendedPerM') : t('playerPopup.contract.ptsPerM')}</span>
                      <InfoTip label={t('playerPopup.contract.contractValueScoreLabel')} text={valueTooltip} />
                    </div>
                  )}
                  {p60 != null && (
                    <div className={PP_ADV_CHIP_CLASSES}>{t('playerPopup.contract.p60Prefix')}<strong>{p60}</strong>
                      <InfoTip label={t('playerPopup.contract.p60Label')} text={t('playerPopup.contract.p60Tip')} />
                    </div>
                  )}
                  {isELC && !isGoalie && (
                    <div className={PP_ADV_CHIP_CLASSES} style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      {t('playerPopup.contract.elcNA')}
                      <InfoTip label={t('playerPopup.contract.elcLabel')} text={t('playerPopup.contract.elcTip')} />
                    </div>
                  )}
                  {isGoalie && (() => {
                    const gsax   = goalieData?.gsax ?? null
                    const gGp    = goalieData?.gp ?? 0
                    const isELC  = contract.note === 'ELC' || contract.capHit < 1_200_000
                    const gScore = goalieContractValue(gsax, gGp, contract.capHit, isELC)
                    const gVl    = goalieValueLabel(gScore)
                    if (!gScore || !gVl) return isELC ? (
                      <div className={PP_ADV_CHIP_CLASSES} style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        {t('playerPopup.contract.elcNA')}
                        <InfoTip label={t('playerPopup.contract.elcLabel')} text={t('playerPopup.contract.elcTipShort')} />
                      </div>
                    ) : null
                    return (
                      <div className={PP_VALUE_BADGE_CLASSES} style={{ background: gVl.color + '22', borderColor: gVl.color + '55', color: gVl.color }}>
                        <span>{gVl.label}</span>
                        <span className={PP_VALUE_SCORE_CLASSES}>{t('playerPopup.contract.goalieGsaxPerM', { score: `${gScore > 0 ? '+' : ''}${gScore}` })}</span>
                        <InfoTip label={t('playerPopup.contract.goalieValueScoreLabel')} text={t('playerPopup.contract.goalieValueTip')} />
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── Tab toggle ── */}
        <div className={PP_TABS_CLASSES}>
          <button className={ppTabClasses(ppTab === 'stats')} onClick={() => setPpTab('stats')}>{t('playerPopup.tabs.stats')}</button>
          <button className={ppTabClasses(ppTab === 'analytics')} onClick={() => setPpTab('analytics')}>{t('playerPopup.tabs.analytics')}</button>
          {!isLeagueContext && (
            <button className={ppTabClasses(ppTab === 'heatmap')} onClick={() => setPpTab('heatmap')}>{t('playerPopup.tabs.heatMap')}</button>
          )}
          {!isLeagueContext && (
            <button className={ppTabClasses(ppTab === 'scout')} onClick={() => setPpTab('scout')}>{t('playerPopup.tabs.scout')}</button>
          )}
          <button className={ppTabClasses(ppTab === 'compare')} onClick={() => setPpTab('compare')}>{t('playerPopup.tabs.compare')}</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className={PP_BODY_CLASSES}>
            {loading && (
              <div className={PP_LOADING_CLASSES}>
                {[80,60,70,50].map((w,i) => (
                  <div key={i} className={SKELETON_CLASSES} style={{ height: 11, width: `${w}%`, marginBottom: 10 }} />
                ))}
              </div>
            )}
            {!loading && !isGoalie && mpData?.percentiles && <PercentileScopeLegend />}
            {!loading && currentStatSections}
            {!loading && otherStatSections.length > 0 && (
              <div className="stat-section-peers">{otherStatSections}</div>
            )}
            {!loading && !sections.some(s => s.stats) && (
              <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.bio.noStats')}</div>
            )}
          </div>
        )}

        {/* ── Heat map tab — CAR context only ── */}
        {ppTab === 'heatmap' && !isLeagueContext && (
          <PlayerHeatMap shotData={shotData} goalieShotData={goalieShotData} playerName={name} isGoalie={isGoalie} />
        )}

        {/* ── Analytics tab ── */}
        {ppTab === 'analytics' && (
          <PlayerAnalytics mpData={mpData} goalieData={goalieData} playerName={name} isGoalie={isGoalie} position={positionCode} narrativeData={rvpNarrative} isLeagueContext={isLeagueContext} />
        )}

        {/* ── Scout tab — CAR context only ── */}
        {ppTab === 'scout' && !isLeagueContext && (
          <ScoutingBlurb data={scoutData} playerName={name} />
        )}

        {/* ── Compare tab — season-over-season (Session 64) ──
            Reuses seasonTotals already fetched for the Stats tab above — no
            second network call. Deliberately does NOT enrich with
            mpData/goalieData (WAR/RAPM/QS%) the way the Stats tab's current
            season does: those Supabase lookups are current-season-only, so
            attaching them to a non-current selected season would silently
            mislabel one season's numbers as another's. Box-score fields
            from the NHL API's own seasonTotals only. */}
        {ppTab === 'compare' && (
          <div className={PP_BODY_CLASSES}>
            <SeasonComparisonPicker
              league="nhl"
              selected={compareSeasons}
              onChange={setCompareSeasons}
              maxSelected={4}
            />
            {compareSeasons.length === 0 && (
              <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.selectSeasons')}</div>
            )}
            {chartableStatDefs.length > 0 && compareSeasons.length > 0 && (
              <div className="stat-section xg-overlay-section">
                <div className="stat-section-header">
                  <span className="stat-section-label">{t('playerPopup.compareTab.perGameTrend')}</span>
                  <select
                    className={PP_METRIC_SELECT_CLASSES}
                    value={activeChartDef?.key || ''}
                    onChange={e => setChartMetricKey(e.target.value)}
                    aria-label={t('playerPopup.compareTab.trendMetricAriaLabel')}
                  >
                    {chartableStatDefs.map(d => (
                      <option key={d.key} value={d.key}>{d.cumulative ? t('playerPopup.compareTab.seasonTotalSuffix', { label: d.label }) : d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="stat-section-body">
                  {gameLogLoading
                    ? <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.loadingChart')}</div>
                    : (
                      <SeasonOverlayChart
                        series={chartSeries}
                        metricLabel={activeChartDef.label}
                        valueFormatter={v => (activeChartDef.key === 'savePctg' ? v.toFixed(3) : Math.round(v * 10) / 10)}
                      />
                    )}
                </div>
              </div>
            )}
            {compareSeasons.length > 0 && (
              <div className="stat-section-peers">
                {compareSeasonsSortedDesc.map(season => {
                  const seasonStats = stats?.seasonTotals?.find(s => s.season === season && s.gameTypeId === 2)
                  if (!seasonStats) {
                    return (
                      <div key={season} className={PP_NO_STATS_CLASSES}>
                        {t('playerPopup.compareTab.noRegularSeasonData', { season: nhlSeasonLabel(season) })}
                      </div>
                    )
                  }
                  const groups = groupStats(statDefs, seasonStats, isGoalie)
                  if (!groups.length) return null
                  return <TileStatSection key={season} label={nhlSeasonLabel(season)} groups={groups} />
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
