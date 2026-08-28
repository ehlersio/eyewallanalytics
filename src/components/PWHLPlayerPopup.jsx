// components/PWHLPlayerPopup.jsx
// Player detail popup for PWHL — mirrors NHL PlayerPopup.
// Tabs: Stats · Heat Map · Scout
//
// Props:
//   player {object} — minimum shape: { player_id }. Self-fetches identity +
//                      the given season's stat line via GET
//                      /pwhl/player/landing, same self-fetch-by-id pattern
//                      as NHL's PlayerPopup. Any additional fields on this
//                      object (name, position, team_id, ...) are used for
//                      instant paint before the fetch resolves; the fetched
//                      fields win on conflict once they land.
//   season {number}  — season_id to pin the self-fetched stat line to.
//   seasonLabel, onClose — as before.
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayerShots, fetchPWHLGoalieShots, fetchPWHLPlayerLanding, fetchPWHLPlayerGameLog, fetchPWHLPlayerCareer, fetchPWHLPlayerPercentiles, fetchPWHLGoaliePercentiles } from '../utils/pwhlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, getPWHLTeamById } from '../utils/pwhlConfig';
import { formatDate } from '../utils/formatters';
import SeasonOverlayChart from './SeasonOverlayChart';

// Local TEAM_CODES (team_id -> abbr) map removed Session 85 — stale
// duplicate missing expansion teams, same bug as PWHLShotMapView.jsx.
// Use getPWHLTeamById instead (already imported below).

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
import { HockeyRink } from 'react-hockey-rink';
import { toHockeyRinkEvents } from '../utils/hockeyRinkEvents';
import { TileStatSection } from './StatTileGrid';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import PlayerComparisonEntry from './PlayerComparisonEntry';
import {
  SKATER_STATS, GOALIE_STATS, PWHL_STAT_PCT_MAP, posLabel, groupStats as pwhlGroupStats,
  computeRadarAxes, computeGoalieRadarAxes, RADAR_AXIS_ABBR,
} from '../utils/pwhlPlayerStats';
import { SKELETON_CLASSES } from '../utils/skeletonClasses';
// Tailwind migration (Session 97, Phase 3, sub-PR 2 + sub-PR 3) -- see
// PlayerPopup.jsx for the full rationale. The former shell classes
// (player-popup, pp-header, pp-header-reflow, pp-close, pp-body,
// pp-no-stats, pp-identity, pp-name, pp-first, pp-birth, pp-photo-wrap)
// are fully Tailwind now that TeamComparisonPopup.jsx/PlayerComparisonPopup.jsx
// (sub-PR 3) are migrated too. popup-backdrop stays untouched -- separate
// permanently-shared global class in index.css, not part of PlayersView.css.
// pp-last keeps its literal marker for one surviving compound rule
// (.pp-header-reflow .pp-last{overflow-wrap:break-word}). pp-quickstats-col
// is migrated + its base rule deleted, kept literal for the
// .pce-toggle/.pce-wrap compact-mode override (moved into
// PlayerComparisonPopup.css in sub-PR 2). Cypress markers kept:
// pp-heatmap-empty, pp-quickstats-col, pp-tab, pp-pos-chip, pp-chip.
const PP_QUICKSTAT_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-md py-1 px-[2px] min-w-0'
const PP_QUICKSTAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--text)] leading-[1.1]'
const PP_QUICKSTAT_LABEL_CLASSES = 'text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'
const PP_HEADER_RADAR_CLASSES = 'flex items-center gap-2 flex-[1_1_auto] min-w-0 max-[340px]:flex-col'
// Radar chart classes (added 2026-08, matching NHL PlayerPopup's own
// pp-radar-wrap/-note classes) -- shared by both PWHLHeaderPanel (skaters,
// 4-axis) and PWHLGoalieHeaderPanel (goalies, 6-axis); both render a real
// PWHLRadarChart now, not a tile grid.
const PP_RADAR_WRAP_CLASSES = 'pp-radar-wrap flex-[1_1_0%] min-w-[50px] max-w-[130px] max-[340px]:max-w-full'
const PP_RADAR_NOTE_CLASSES = 'text-[9px] text-[color:var(--text-dim)] text-center leading-[1.4] px-1 mt-[-6px]'
const PP_QUICKSTATS_COL_CLASSES = 'pp-quickstats-col flex flex-col gap-1 flex-none'
const PP_QUICKSTATS_CLASSES = 'grid [grid-template-columns:38px_38px] gap-1 max-[340px]:w-full'

const HEATMAP_CHIP_BASE_CLASSES = 'py-1 px-[10px] rounded-xl text-[11px] font-semibold leading-none border-[0.5px] border-[var(--border)] bg-[var(--bg2)] text-[color:var(--text-muted)] cursor-pointer'
const HEATMAP_CHIP_ACTIVE_CLASSES = 'bg-[var(--red-bright)] text-[#fff] border-[var(--red-bright)]'
function heatmapChipClasses(active) { return `${HEATMAP_CHIP_BASE_CLASSES} ${active ? HEATMAP_CHIP_ACTIVE_CLASSES : ''}` }
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

const SCOUT_WRAP_CLASSES = 'p-4'
const SCOUT_HEADER_CLASSES = 'flex items-center justify-between mb-3'
const SCOUT_LABEL_CLASSES = 'text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)]'
const SCOUT_SEASON_CLASSES = 'text-[10px] font-bold py-[2px] px-[7px] rounded-[10px] bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] uppercase tracking-[0.06em] font-[family-name:var(--font-display)]'
const SCOUT_BLURB_CLASSES = 'text-[14px] leading-[1.65] text-[color:var(--text)] bg-[var(--bg2)] rounded-[10px] py-[14px] px-4 border-[0.5px] border-[var(--border)] whitespace-pre-wrap'
const SCOUT_FOOTER_CLASSES = 'text-[10px] text-[color:var(--text-dim)] mt-[10px] text-center'
const SCOUT_LOADING_CLASSES = 'flex flex-col gap-1 py-1'
const SCOUT_EMPTY_CLASSES = 'py-8 px-4 text-center text-[color:var(--text-muted)] text-[13px] flex flex-col items-center gap-2'
const SCOUT_EMPTY_ICON_CLASSES = 'text-[28px]'

const PP_PHOTO_CLASSES = 'w-[80px] h-[80px] object-cover object-top rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)]'
const PP_PHOTO_FALLBACK_CLASSES = 'w-[80px] h-[80px] rounded-[var(--radius)] bg-[var(--bg3)] border-[0.5px] border-[var(--border-2)] flex items-center justify-center font-[family-name:var(--font-display)] text-[24px] font-bold text-[color:var(--text-dim)]'
const PP_NUM_CLASSES = 'font-[family-name:var(--font-display)] text-[11px] font-bold text-[color:var(--red-bright)] tracking-[0.06em]'
const PP_LAST_CLASSES = 'pp-last font-[family-name:var(--font-display)] text-[20px] font-bold text-[color:var(--text)]'
const PP_LAST_REFLOW_CLASSES = 'break-words'
const PP_CHIPS_CLASSES = 'flex gap-[5px] flex-wrap mt-[2px]'
const PP_POS_CHIP_CLASSES = 'pp-pos-chip font-[family-name:var(--font-display)] text-[10px] font-bold bg-[var(--red-dim)] text-[color:var(--red-bright)] border-[0.5px] border-[var(--red-border)] py-[2px] px-[7px] rounded'
const PP_CHIP_CLASSES = 'pp-chip text-[10px] text-[color:var(--text-muted)] bg-[var(--bg3)] py-[2px] px-[6px] rounded'

const PP_BIO_ROW_CLASSES = 'grid grid-cols-6 gap-[8px_4px] py-[10px_12px_14px] border-b-[0.5px] border-[var(--border)] max-[340px]:grid-cols-3'
const PP_BIO_FIELD_CLASSES = 'flex flex-col items-center gap-[3px] text-center min-w-0'
const PP_BIO_LABEL_CLASSES = 'text-[8px] uppercase tracking-[0.06em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] font-semibold'
const PP_BIO_VALUE_CLASSES = 'text-[11px] font-semibold text-[color:var(--text)] [overflow-wrap:break-word]'

// ── Player Spotlight panel (hero photo + draft + bio bullets) --
// always-visible, same slot as the bio row above (not tab content).
// PWHL-local, mirrors NHL PlayerPopup.jsx's own PP_SPOTLIGHT_* consts --
// deliberately not shared, this file already keeps its own full set of
// PP_* constants separate from NHL's.
const PP_SPOTLIGHT_CLASSES = 'py-3 px-4 bg-[var(--bg2)] border-b-[0.5px] border-[var(--border)]'
const PP_HERO_IMG_CLASSES = 'w-full h-[140px] object-cover rounded-[var(--radius-sm)] mb-2.5'
const PP_SPOTLIGHT_ROW_CLASSES = 'flex flex-wrap gap-1.5 items-center justify-center mb-2'
const PP_DRAFT_CHIP_CLASSES = 'text-[10px] font-medium text-[color:var(--text-muted)] bg-[var(--bg3)] py-[3px] px-2 rounded-[10px]'
const PP_BIO_LIST_CLASSES = 'flex flex-col gap-1 text-[11px] text-[color:var(--text-muted)] leading-[1.4] list-disc pl-4'

// ── Recent Form strip (Stats tab, first block) ──
const PP_FORM_LABEL_CLASSES = 'text-[9px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] font-[family-name:var(--font-display)] py-1 border-b-[0.5px] border-[var(--border)] mb-1.5'
const PP_FORM_STRIP_CLASSES = 'flex gap-1.5 overflow-x-auto pb-1 mb-3'
const PP_FORM_CARD_CLASSES = 'flex flex-col items-center gap-0.5 shrink-0 bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-[var(--radius-sm)] py-1.5 px-2 min-w-[64px]'

// Goalie decision letter, derived from PWHL's own win/loss/ot_loss/
// shootout_loss flags -- unlike NHL's goalie last5Games (no decision field
// at all there), PWHL's gameByGame rows carry these directly.
function pwhlDecisionColor(decision) {
  if (decision === 'W') return 'var(--green)'
  if (decision === 'L') return 'var(--red-bright)'
  return 'var(--amber)'
}
function pwhlGoalieDecision(g) {
  if (g.win) return 'W'
  if (g.loss) return 'L'
  if (g.ot_loss) return 'OTL'
  if (g.shootout_loss) return 'SOL'
  return null
}

const PP_TABS_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-16px] px-4'
const PP_TAB_BASE_CLASSES = 'pp-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const PP_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const PP_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function ppTabClasses(active) { return `${PP_TAB_BASE_CLASSES} ${active ? PP_TAB_ACTIVE_CLASSES : PP_TAB_INACTIVE_CLASSES}` }
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

const SEASON_LABEL = '2025–26';

// SKATER_STATS moved to utils/pwhlPlayerStats.js (Session 91).

// SKATER_STATS/GOALIE_STATS/PWHL_STAT_PCT_MAP/posLabel/groupStats moved to
// utils/pwhlPlayerStats.js (Session 91) so PlayerComparisonPopup.jsx can
// reuse them without a circular import back into this file.

// ── Helpers ───────────────────────────────────────────────────

function fmtBirth(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return formatDate(d, { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcAge(str) {
  if (!str) return null;
  const today = new Date(), dob = new Date(str);
  let age = today.getFullYear() - dob.getFullYear();
  if (today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
  return age;
}

// Matches NHL PlayerPopup's fmtHeight exactly, for visual parity between
// the two leagues' bio rows (Session 85 header reflow).
function fmtHeight(inches) {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}

// Displays a value as-is, no rounding. Matches NHL PlayerPopup's
// QuickStatPill exactly.
function PWHLQuickStatPill({ label, value }) {
  return (
    <div className={PP_QUICKSTAT_CLASSES}>
      <span className={PP_QUICKSTAT_VAL_CLASSES}>{value ?? '—'}</span>
      <span className={PP_QUICKSTAT_LABEL_CLASSES}>{label}</span>
    </div>
  );
}

// Own copy of NHL PlayerPopup's RadarAxisTick/PlayerRadarChart -- this
// codebase's established convention for popup-owned UI helpers is
// duplicate-per-file rather than cross-import (see hexToRgba/
// seasonRampColor above for the same reasoning already applied in this
// file). Abbreviates axis labels for the same reason NHL's does: this
// radar renders inside a ~130px-wide flex slot, nowhere near enough room
// for two-word labels like "5v5 SV%" at any legible size -- full names
// are still available via the native SVG <title> on hover/tap.
//
// Shared between skaters and goalies (added 2026-08) -- nothing here is
// goalie-specific despite the name it originally shipped under; only the
// axis DATA differs (computeRadarAxes' 4 skater categories vs
// computeGoalieRadarAxes' 6 goalie ones), both already keyed into the same
// RADAR_AXIS_ABBR map.
function PWHLRadarAxisTick({ x, y, payload, textAnchor }) {
  const full = payload.value;
  const short = RADAR_AXIS_ABBR[full] || full;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text-dim)" fontSize={8.5}>
      {short}
      <title>{full}</title>
    </text>
  );
}

function PWHLRadarChart({ data, color }) {
  const { t } = useTranslation();
  const missing = data.filter(d => !d.hasData).map(d => d.axis);
  return (
    <div className={PP_RADAR_WRAP_CLASSES}>
      <ResponsiveContainer width="100%" height={150}>
        <RadarChart data={data} outerRadius="62%">
          <PolarGrid stroke="var(--border-2)" />
          <PolarAngleAxis dataKey="axis" tick={PWHLRadarAxisTick} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickCount={2} />
          <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      {missing.length > 0 && (
        <div className={PP_RADAR_NOTE_CLASSES}>{t('playerPopup.radar.notEnoughData', { missing: missing.join(', ') })}</div>
      )}
    </div>
  );
}

// Header panel (Session 85, upgraded 2026-08) — PWHL's equivalent of NHL
// PlayerPopup's SkaterHeaderPanel. Originally substituted a 2x2
// percentile-tile grid for NHL's radar + G/A/P/TOI totals, on the
// reasoning that PWHL's 4 percentile categories weren't "radar-worthy."
// That reasoning didn't hold up once PWHL goalies shipped a real 6-axis
// radar from the exact same category *count* class (see
// PWHLGoalieHeaderPanel below) -- 4 categories is exactly what
// PlayerComparisonPopup.jsx's own PWHL skater radar has already been
// plotting since Session 91, just never in this single-player header.
// `boxStats` is the current-season raw stat object (same `p` shape
// pwhlGroupStats/SKATER_STATS already read) -- goals/assists/points/
// toi_per_game reused directly for the quickstat pills rather than
// re-fetching anything. toi_per_game comes back from the Worker as a
// string (Postgres bigint, PostgREST's string-serialization convention
// for those -- see pwhl_percentiles.py's own gotcha comment), in seconds;
// formatted to mm:ss matching NHL's own TOI/G convention exactly.
// `comparisonEntry` (the "vs Player" button, Session 91) stacks below the
// quickstats grid rather than sitting inline as a sibling of this panel --
// matching the fix applied to NHL's SkaterHeaderPanel after the inline
// placement was reported to squeeze that header row.
function PWHLHeaderPanel({ percentiles, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
  const radarData = computeRadarAxes(percentiles);
  const fmtToi = (raw) => {
    if (raw == null) return null;
    const secs = Number(raw);
    if (isNaN(secs)) return null;
    const m = Math.floor(secs / 60), s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PWHLRadarChart data={radarData} color={teamColor} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <PWHLQuickStatPill label="G"   value={boxStats?.goals} />
          <PWHLQuickStatPill label="A"   value={boxStats?.assists} />
          <PWHLQuickStatPill label="P"   value={boxStats?.points} />
          <PWHLQuickStatPill label="TOI" value={fmtToi(boxStats?.toi_per_game)} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  );
}

// PWHL goalie header panel (added 2026-08) -- goalie-side counterpart to
// PWHLHeaderPanel above, same radar-chart treatment (6 genuinely
// radar-worthy categories, same richness as NHL's own goalie radar).
// `boxStats` is the current-season raw stat object (same `p` shape
// pwhlGroupStats/GOALIE_STATS already read) -- wins/sv_pct/gaa/shutouts
// reused directly for the quickstat pills rather than re-fetching
// anything. sv_pct formatting matches this file's own groupStats()
// convention (leading zero stripped, e.g. ".902" not "0.902"), not NHL's
// (which keeps the leading zero) -- these are two independently-evolved
// per-league formatting conventions, not a bug to unify here.
function PWHLGoalieHeaderPanel({ percentiles, boxStats, teamColor, comparisonEntry }) {
  if (!percentiles) return null;
  const radarData = computeGoalieRadarAxes(percentiles);
  const fmtSvPct = (raw) => raw == null ? null : Number(raw).toFixed(3).replace(/^0\./, '.');
  const fmtGaa = (raw) => raw == null ? null : Number(raw).toFixed(2);
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <PWHLRadarChart data={radarData} color={teamColor} />
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          <PWHLQuickStatPill label="W"   value={boxStats?.wins} />
          <PWHLQuickStatPill label="SV%" value={fmtSvPct(boxStats?.sv_pct)} />
          <PWHLQuickStatPill label="GAA" value={fmtGaa(boxStats?.gaa)} />
          <PWHLQuickStatPill label="SO"  value={boxStats?.shutouts} />
        </div>
        {comparisonEntry}
      </div>
    </div>
  );
}

// ── Per-game trend chart helpers (Session 70) ───────────────────
// Every `perGame` PWHL stat is a direct box-score field read (no derived
// stats like NHL's saves/GAA -- pwhl_skater_game_box/pwhl_goalie_game_box
// don't carry the fields those derivations would need), so this is just a
// key lookup, unlike NHL PlayerPopup's perGameRawValue.
function pwhlPerGameValue(def, game) {
  if (!game) return null;
  const raw = game[def.perGameKey || def.key];
  return raw == null ? null : Number(raw);
}

// pwhlGroupStats moved to utils/pwhlPlayerStats.js (Session 91, imported
// above as `groupStats as pwhlGroupStats`).

// Same season-color-ramp math as TeamComparisonPopup/PlayerPopup, small
// enough to duplicate per-file rather than cross-import (this codebase's
// established convention for popup-owned UI helpers).
function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function seasonRampColor(baseHex, index, total) {
  if (total <= 1) return baseHex;
  const MIN_ALPHA = 0.35;
  const alpha = 1 - (index / (total - 1)) * (1 - MIN_ALPHA);
  return hexToRgba(baseHex, Number(alpha.toFixed(2)));
}
const CHART_DASH_PATTERNS = [undefined, '6 4', '2 3'];

// ── Heat Map ──────────────────────────────────────────────────

// Same 7-zone breakdown + colour scale NHL's PlayerPopup.jsx uses for its
// goalie heat map (PlayerHeatMap's isGoalie branch) -- kept as an
// independent copy rather than a shared import, consistent with this
// codebase's convention of not cross-importing between the NHL and PWHL
// component trees (they're only coupled at the API-fetch/config layer).
const GOALIE_ZONE_RECTS = {
  slot_hi:   { x: 105, y: 45,  w: 90, h: 48 },
  slot_lo:   { x: 105, y: 93,  w: 90, h: 45 },
  left_hi:   { x: 35,  y: 40,  w: 70, h: 53 },
  right_hi:  { x: 195, y: 40,  w: 70, h: 53 },
  left_lo:   { x: 25,  y: 93,  w: 80, h: 45 },
  right_lo:  { x: 195, y: 93,  w: 80, h: 45 },
  perimeter: { x: 25,  y: 138, w: 250,h: 40 },
};

function goalieSvColor(pct) {
  if (pct == null) return 'transparent';
  if (pct >= 0.960) return '#1D9E75';
  if (pct >= 0.930) return '#5DCAA5';
  if (pct >= 0.900) return '#FAC775';
  if (pct >= 0.860) return '#EF9F27';
  return '#E24B4A';
}

function goalieToSvg(nx, ny) {
  const svgX = 150 + (ny / 42.5) * 125;
  const svgY = 30  + ((89 - nx) / 34) * 148;
  return { sx: Math.round(svgX), sy: Math.round(svgY) };
}

function PWHLGoalieHeatMap({ goalieShotData }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [mapMode, setMapMode] = useState('dots');

  const GOALIE_ZONES = [
    { id: 'slot_hi',   label: t('playerPopup.heatMap.goalie.zones.highSlot'),    test: s => Math.abs(s.y) <= 22 && s.x >= 55 && s.x < 75 },
    { id: 'slot_lo',   label: t('playerPopup.heatMap.goalie.zones.lowSlot'),     test: s => Math.abs(s.y) <= 22 && s.x >= 75 },
    { id: 'left_hi',   label: t('playerPopup.heatMap.goalie.zones.leftCircle'), test: s => s.y < -10 && s.x >= 55 && s.x < 80 },
    { id: 'right_hi',  label: t('playerPopup.heatMap.goalie.zones.rightCircle'), test: s => s.y > 10  && s.x >= 55 && s.x < 80 },
    { id: 'left_lo',   label: t('playerPopup.heatMap.goalie.zones.leftWing'),    test: s => s.y < -22 && s.x >= 55 },
    { id: 'right_lo',  label: t('playerPopup.heatMap.goalie.zones.rightWing'),   test: s => s.y > 22  && s.x >= 55 },
    { id: 'perimeter', label: t('playerPopup.heatMap.goalie.zones.perimeter'),   test: s => s.x < 55 },
  ];

  if (!goalieShotData || !goalieShotData.shots?.length) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>{t('playerPopup.heatMap.goalie.empty')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.goalie.emptySub')}</div>
      </div>
    );
  }

  const shots = goalieShotData.shots;
  const goals = shots.filter(s => s.t === 'g').length;
  const saves = shots.filter(s => s.t === 's').length;
  const total = goals + saves;
  const svPct = total > 0 ? (saves / total).toFixed(3) : '—';

  const zoneStats = GOALIE_ZONES.map(z => {
    const zShots = shots.filter(s => z.test(s));
    const zGoals = zShots.filter(s => s.t === 'g').length;
    const zSaves = zShots.filter(s => s.t === 's').length;
    const zTotal = zGoals + zSaves;
    const zSvPct = zTotal >= 5 ? (zSaves / zTotal) : null;
    return { ...z, goals: zGoals, saves: zSaves, total: zTotal, svPct: zSvPct };
  });

  const dotFiltered = filter === 'goals' ? shots.filter(s => s.t === 'g')
    : filter === 'saves' ? shots.filter(s => s.t === 's')
    : shots.filter(s => s.t === 'g' || s.t === 's');

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
          {[['#1D9E75', '.960+'], ['#5DCAA5', '.930+'], ['#FAC775', '.900+'], ['#EF9F27', '.860+'], ['#E24B4A', '<.860']].map(([c, l]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
            </span>
          ))}
          <span style={{ color: 'var(--text-dim)', marginLeft: 'auto' }}>{t('playerPopup.heatMap.goalie.minShots')}</span>
        </div>
      )}
      <div className={PP_HEATMAP_RINK_CLASSES}>
        <svg viewBox="0 0 300 230" width="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
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
                const r = GOALIE_ZONE_RECTS[z.id];
                const col = goalieSvColor(z.svPct);
                return (
                  <g key={z.id}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="3"
                      fill={col} opacity={z.svPct != null ? 0.55 : 0.08}
                      stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
                    {z.svPct != null && (
                      <>
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 4} textAnchor="middle"
                          fontSize="12" fontWeight="700" fill="#111"
                          style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                          .{Math.round(z.svPct * 1000)}
                        </text>
                        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 11} textAnchor="middle"
                          fontSize="9" fontWeight="600" fill="#333"
                          style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                          {t('playerPopup.heatMap.goalie.zoneShotsCount', { count: z.total })}
                        </text>
                      </>
                    )}
                    {z.svPct == null && z.total > 0 && (
                      <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 4} textAnchor="middle"
                        fontSize="9" fontWeight="600" fill="#333"
                        style={{ filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.9))' }}>
                        {t('playerPopup.heatMap.goalie.zoneShotsCount', { count: z.total })}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {dotFiltered.map((s, i) => {
                const { sx, sy } = goalieToSvg(s.x, s.y || 0);
                if (sy < 10 || sy > 225 || sx < 10 || sx > 290) return null;
                return (
                  <circle key={i} cx={sx} cy={sy} r={s.t === 'g' ? 4.5 : 3.5}
                    fill={s.t === 'g' ? '#E24B4A' : '#1D9E75'}
                    opacity={s.t === 'g' ? 0.85 : 0.45} />
                );
              })}
            </>
          )}
          <text x="150" y="224" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
            {t('playerPopup.heatMap.goalie.shooterCaption')}
          </text>
        </svg>
      </div>
    </div>
  );
}

function PWHLHeatMap({ playerId, season, isGoalie, teamId }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');

  const { data: shotData, loading } = useFetch(
    () => !isGoalie && playerId ? fetchPWHLPlayerShots(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );
  const { data: goalieShotData, loading: goalieLoading } = useFetch(
    () => isGoalie && playerId ? fetchPWHLGoalieShots(playerId, season) : Promise.resolve(null),
    [playerId, season, isGoalie]
  );

  if (isGoalie) {
    if (goalieLoading) {
      return (
        <div className={PP_HEATMAP_EMPTY_CLASSES}>
          <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
          <div>{t('playerPopup.heatMap.loading')}</div>
        </div>
      );
    }
    return <PWHLGoalieHeatMap goalieShotData={goalieShotData} />;
  }

  if (loading) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>{t('playerPopup.heatMap.loading')}</div>
      </div>
    );
  }

  if (!shotData || !shotData.shots?.length) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>{t('playerPopup.heatMap.skater.emptyPwhl')}</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>{t('playerPopup.heatMap.skater.emptySub')}</div>
      </div>
    );
  }

  const shots   = shotData.shots;
  const typeMap = { g: 'goal', s: 'shot-on-goal', m: 'missed-shot', b: 'blocked-shot' };
  const allEvents = shots.map((s, i) => ({
    id: i, x: s.x, y: s.y,
    type: typeMap[s.t] || 'shot-on-goal',
    period: s.p,
    isCanes: true,
    shooterId: 'player',
  }));

  const filtered = filter === 'goals'  ? allEvents.filter(e => e.type === 'goal')
    : filter === 'sog'    ? allEvents.filter(e => e.type === 'shot-on-goal')
    : allEvents;

  const goals  = allEvents.filter(e => e.type === 'goal').length;
  const sog    = allEvents.filter(e => e.type === 'shot-on-goal').length;
  const total  = allEvents.length;
  const sh     = (goals + sog) > 0 ? ((goals / (goals + sog)) * 100).toFixed(1) : '—';

  return (
    <div className={PP_HEATMAP_CLASSES}>
      <div className={PP_HEATMAP_SUMMARY_CLASSES}>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>{t('gameStatsPopup.sections.goals')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{sog}</span><span>SOG</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>{t('shotMapView.drillPopup.total')}</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{sh}%</span><span>SH%</span></div>
      </div>
      <div className={PP_HEATMAP_FILTERS_CLASSES}>
        {[
          { key: 'all',   label: t('playerPopup.heatMap.skater.filterAll', { count: total }) },
          { key: 'goals', label: t('playerPopup.heatMap.skater.filterGoals', { count: goals }) },
          { key: 'sog',   label: t('playerPopup.heatMap.skater.filterSog', { count: sog }) },
        ].map(f => (
          <button key={f.key} className={heatmapChipClasses(filter === f.key)}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {(() => {
        const tAbbr  = getPWHLTeamById(teamId)?.abbr || 'BOS';
        const tTeam  = PWHL_TEAM_MAP[tAbbr];
        const tColor = tTeam?.displayColor || 'var(--team-primary)';
        return (
          <div className={PP_HEATMAP_RINK_CLASSES}>
            <HockeyRink events={toHockeyRinkEvents(filtered)} hidePlayerFilter
              teamAbbr={tAbbr} teamColor={tColor} />
          </div>
        );
      })()}
    </div>
  );
}

// ── Scouting blurb ────────────────────────────────────────────

function PWHLScout({ player, isGoalie, seasonLabel }) {
  const { t } = useTranslation();
  const [blurb, setBlurb] = useState(undefined); // undefined=loading, null=failed, string=ready
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const name   = player.player_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
  const pos    = posLabel(player.position);

  async function generate() {
    setLoading(true);
    setGenerated(true);
    try {
      const res = await fetch(`${WORKER_URL}/pwhl/scout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          position: pos,
          isGoalie,
          seasonLabel,
          stats: player,
        }),
      });
      const data = await res.json();
      setBlurb(data.blurb || null);
    } catch {
      setBlurb(null);
    }
    setLoading(false);
  }

  if (!generated) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>📋</div>
          <div style={{ marginBottom: 12 }}>{t('playerPopup.pwhlScout.generatePrompt', { name })}</div>
          <button
            onClick={generate}
            style={{
              padding: '8px 20px', background: 'var(--team-primary)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {t('playerPopup.pwhlScout.generateButton')}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_LOADING_CLASSES}>
          {[95, 88, 72, 90, 65].map((w, i) => (
            <div key={i} className={SKELETON_CLASSES} style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!blurb) {
    return (
      <div className={SCOUT_WRAP_CLASSES}>
        <div className={SCOUT_EMPTY_CLASSES}>
          <div className={SCOUT_EMPTY_ICON_CLASSES}>📋</div>
          <div>{t('playerPopup.pwhlScout.failedState')}</div>
          <button onClick={() => { setGenerated(false); }} style={{ marginTop: 8, padding: '6px 16px', cursor: 'pointer' }}>{t('playerPopup.pwhlScout.retryButton')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={SCOUT_WRAP_CLASSES}>
      <div className={SCOUT_HEADER_CLASSES}>
        <span className={SCOUT_LABEL_CLASSES}>{t('playerPopup.scoutingBlurb.header')}</span>
        <span className={SCOUT_SEASON_CLASSES}>{seasonLabel}</span>
      </div>
      <div className={SCOUT_BLURB_CLASSES}>{blurb}</div>
      <div className={SCOUT_FOOTER_CLASSES}>{t('playerPopup.pwhlScout.footer')}</div>
    </div>
  );
}

// ── Season comparison (Session 64) ──────────────────────────────
// PWHL has no multi-season payload the way NHL's player-landing does
// (fetchPWHLPlayerLanding returns one season per call) — each selected
// season needs its own fetch. PWHLCompareSeasonCard owns exactly one
// useFetch call per rendered instance (keyed by season in the .map() below),
// which keeps this legal under the rules of hooks without needing a
// variable-length Promise.all inside a single hook call.

// Loading/empty states keep the plain (non-collapsible) header markup the
// row-list version used; only the populated case hands off to the shared
// TileStatSection, which is what actually needs the tile grid + toggle.
function PWHLCompareSection({ label, stats, defs, loading }) {
  const { t } = useTranslation();
  const groups = stats ? pwhlGroupStats(defs, stats) : [];
  if (loading) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className={SKELETON_CLASSES} style={{ height: 11, width: '60%', margin: '8px 0' }} /></div>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.noDataPwhl', { label })}</div></div>
      </div>
    );
  }
  return <TileStatSection label={label} groups={groups} />;
}

function PWHLCompareSeasonCard({ playerId, seasonValue, label, defs }) {
  const { data: landing, loading } = useFetch(
    () => playerId ? fetchPWHLPlayerLanding(playerId, seasonValue) : Promise.resolve(null),
    [playerId, seasonValue]
  );
  return <PWHLCompareSection label={label} stats={landing} defs={defs} loading={loading} />;
}

// ── Main popup ────────────────────────────────────────────────

export default function PWHLPlayerPopup({ player: initial, seasonLabel = SEASON_LABEL, season = PWHL_CURRENT_SEASON, onClose }) {
  const { t } = useTranslation();
  const [imgErr, setImgErr] = useState(false);
  const [ppTab, setPpTab]   = useState('stats');
  const [compareSeasons, setCompareSeasons] = useState([]);

  // Reuses the same memoized fetch SeasonComparisonPicker itself calls
  // (seasonClient.js's fetchComparisonSeasons) purely for season labels
  // ("2025-26 Playoffs" etc) — no second network request.
  const { data: comparisonConfig } = useFetch(fetchComparisonSeasons, []);
  const pwhlSeasonOptions = normalizeComparisonSeasons('pwhl', comparisonConfig?.pwhl?.seasons);
  const compareLabel = (val) => pwhlSeasonOptions.find(s => s.value === val)?.label || `Season ${val}`;

  // Self-fetches identity + this season's stat line by id, mirroring NHL's
  // PlayerPopup (which self-fetches via getPlayerStats(p.id)) — callers
  // only need to pass a minimum shape ({player_id}; name/position/team_id
  // for instant paint before this resolves). `landing`'s fields win on
  // conflict since it's the season-scoped, authoritative source; `initial`
  // only fills the gap while loading, so the header doesn't flash blank.
  const playerId = initial.player_id;
  const { data: landing, loading: statsLoading } = useFetch(
    () => playerId ? fetchPWHLPlayerLanding(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );
  const p = { ...initial, ...(landing || {}) };

  const isGoalie  = p.position === 'G';
  const defs      = isGoalie ? GOALIE_STATS : SKATER_STATS;
  const currentGroups = pwhlGroupStats(defs, p);
  const teamColor = getPWHLTeamById(p.team_id)?.displayColor || '#4d80f0';

  // ── Percentiles — precomputed league-wide by eyewall-pipeline (Session
  // 80's pwhl_percentiles.py for skaters, pwhl_goalie_percentiles.py for
  // goalies added 2026-08), served as-is by the poller's
  // /pwhl/player/percentiles or /pwhl/goalie/percentiles respectively.
  // Current season only, same scope NHL's PlayerPopup already applies.
  const { data: pctData } = useFetch(
    () => playerId
      ? (isGoalie ? fetchPWHLGoaliePercentiles(playerId, season) : fetchPWHLPlayerPercentiles(playerId, season))
      : Promise.resolve(null),
    [playerId, season, isGoalie]
  );

  // ── Career Regular Season / Playoffs (Session 75) ──────────────
  // Poller route renames HockeyTech's fields to match these same defs'
  // keys (see fetchPWHLPlayerCareer/pwhl.js), so pwhlGroupStats works
  // unmodified on career data too. `playoffs` legitimately comes back
  // null for a player who hasn't made the playoffs yet -- not an error,
  // just an empty section (see the "No stats" guard in the Stats tab JSX).
  const { data: career } = useFetch(
    () => playerId ? fetchPWHLPlayerCareer(playerId) : Promise.resolve(null),
    [playerId]
  );
  const careerRegGroups = pwhlGroupStats(defs, career?.regularSeason);
  const careerPOGroups  = pwhlGroupStats(defs, career?.playoffs);

  // ── Compare tab per-game trend chart (Session 70) ──────────────
  const chartableStatDefs = defs.filter(d => d.perGame);
  const [chartMetricKey, setChartMetricKey] = useState(null);
  const activeChartDef = chartableStatDefs.find(d => d.key === chartMetricKey) || chartableStatDefs[0] || null;

  const { data: gameLogsBySeason, loading: gameLogLoading } = useFetch(
    () => (compareSeasons.length
      ? Promise.all(compareSeasons.map(s => fetchPWHLPlayerGameLog(playerId, s)))
      : Promise.resolve([])),
    [playerId, compareSeasons.join(',')]
  );

  const compareSeasonsSortedDesc = useMemo(
    () => [...compareSeasons].sort((a, b) => b - a),
    [compareSeasons]
  );

  const chartSeries = useMemo(() => {
    if (!activeChartDef || !gameLogsBySeason) return [];
    const logBySeason = new Map(compareSeasons.map((s, i) => [s, gameLogsBySeason[i]]));
    const baseColor = getPWHLTeamById(p.team_id)?.displayColor || '#4d80f0';
    return compareSeasonsSortedDesc.map((season, idx) => {
      const log = logBySeason.get(season);
      // Route already orders by game_id.asc (chronological), unlike NHL's
      // endpoint -- no reverse needed here.
      const games = (isGoalie ? log?.goalies : log?.skaters) || [];
      const dataPoints = games.map((g, i) => ({ gameNumber: i + 1, value: pwhlPerGameValue(activeChartDef, g) }));
      return {
        seasonLabel: compareLabel(season),
        color: seasonRampColor(baseColor, idx, compareSeasonsSortedDesc.length),
        dashPattern: CHART_DASH_PATTERNS[idx % CHART_DASH_PATTERNS.length],
        dataPoints,
      };
    });
  }, [activeChartDef, gameLogsBySeason, compareSeasons, compareSeasonsSortedDesc, isGoalie, p.team_id]);

  const name      = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const firstName = p.first_name || name.split(' ')[0] || '';
  const lastName  = p.last_name  || name.split(' ').slice(1).join(' ') || '';
  const headshot  = p.headshot || `https://assets.leaguestat.com/pwhl/240x240/${p.player_id}.jpg`;
  const initials  = (firstName[0] || '') + (lastName[0] || '');

  // ── Header reflow (Session 85) — same two-column top row + full-width
  // 6-column bio row pattern as NHL PlayerPopup (Session 80). Scoped to
  // percentile data being present for whichever position this player is --
  // goalies now reflow too (2026-08, previously always false here since
  // goalieData had nowhere to render before PWHLGoalieHeaderPanel existed).
  // The pre-percentiles loading flash still keeps the original
  // single-block header for everyone.
  const showHeaderReflow = !!pctData?.percentiles;
  const bioFields = [
    { label: t('playerPopup.bio.height'),    value: fmtHeight(p.height_inches) },
    { label: t('playerPopup.bio.weight'),    value: null },
    { label: isGoalie ? t('playerPopup.bio.catches') : t('playerPopup.bio.shoots'),
      value: p.shoots ? (p.shoots === 'L' ? t('playerPopup.bio.left') : p.shoots === 'R' ? t('playerPopup.bio.right') : p.shoots) : null },
    { label: t('playerPopup.bio.age'),       value: p.birth_date ? calcAge(p.birth_date) : null },
    { label: t('playerPopup.bio.birthdate'), value: p.birth_date ? fmtBirth(p.birth_date) : null },
    { label: t('playerPopup.bio.hometown'),  value: p.birth_city || null },
  ];

  // Built once, placed either inline in .pp-header (goalies/loading) or
  // stacked under PWHLHeaderPanel's quickstats grid (skaters with a
  // reflowed header) -- see showHeaderReflow below.
  const comparisonEntry = (
    <PlayerComparisonEntry
      sport="pwhl"
      player={{ id: p.player_id, name, team: getPWHLTeamById(p.team_id)?.abbr, position: p.position }}
    />
  );

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className={PLAYER_POPUP_CLASSES} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={ppHeaderClasses(showHeaderReflow)}>
          <div className={PP_PHOTO_WRAP_CLASSES}>
            {!imgErr ? (
              <img src={headshot} alt={name} className={PP_PHOTO_CLASSES} onError={() => setImgErr(true)} />
            ) : (
              <div className={PP_PHOTO_FALLBACK_CLASSES}>{initials}</div>
            )}
          </div>
          <div className={showHeaderReflow ? PP_IDENTITY_REFLOW_CLASSES : PP_IDENTITY_DEFAULT_CLASSES}>
            {p.jersey_number && <div className={PP_NUM_CLASSES}>#{p.jersey_number}</div>}
            <div className={PP_NAME_CLASSES}>
              <span className={PP_FIRST_CLASSES}>{firstName}</span>
              <span className={`${PP_LAST_CLASSES} ${showHeaderReflow ? PP_LAST_REFLOW_CLASSES : ''}`}>{lastName}</span>
            </div>
            <div className={PP_CHIPS_CLASSES}>
              {p.position && <span className={PP_POS_CHIP_CLASSES}>{posLabel(p.position)}</span>}
              {!showHeaderReflow && p.shoots && <span className={PP_CHIP_CLASSES}>{isGoalie ? t('playerPopup.bio.catches') : t('playerPopup.bio.shoots')} {p.shoots === 'L' ? t('playerPopup.bio.left') : p.shoots === 'R' ? t('playerPopup.bio.right') : p.shoots}</span>}
            </div>
            {!showHeaderReflow && p.birth_date && (
              <div className={PP_BIRTH_CLASSES}>
                {t('playerPopup.bio.birthAge', { birth: fmtBirth(p.birth_date), age: calcAge(p.birth_date) })}
                {p.birth_city ? ` · ${p.birth_city}` : ''}
              </div>
            )}
          </div>
          {showHeaderReflow && isGoalie && (
            <PWHLGoalieHeaderPanel
              percentiles={pctData.percentiles}
              boxStats={p}
              teamColor={teamColor}
              comparisonEntry={comparisonEntry}
            />
          )}
          {showHeaderReflow && !isGoalie && (
            <PWHLHeaderPanel
              percentiles={pctData.percentiles}
              boxStats={p}
              teamColor={teamColor}
              comparisonEntry={comparisonEntry}
            />
          )}
          {!showHeaderReflow && comparisonEntry}
          <button className={PP_CLOSE_CLASSES} onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        {/* ── Bio row — full width, 6 evenly-spaced columns (Session 85) ── */}
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

        {/* ── Player Spotlight — hero photo + draft + bio bullets. career.photo/
            draft/bioPoints come from /pwhl/player/career, already fetched
            above -- no new fetch, just previously-unread fields. */}
        {career && (career.photo || career.draft || career.bioPoints?.length > 0) && (
          <div className={PP_SPOTLIGHT_CLASSES}>
            {career.photo && (
              <img src={career.photo.url} alt="" className={PP_HERO_IMG_CLASSES} />
            )}
            {career.draft && (
              <div className={PP_SPOTLIGHT_ROW_CLASSES}>
                <span className={PP_DRAFT_CHIP_CLASSES}>
                  {t('playerPopup.spotlight.draftLabelPwhl', {
                    team:  career.draft.draft_team,
                    round: career.draft.draft_round,
                    year:  career.draft.draft_year,
                  })}
                </span>
              </div>
            )}
            {career.bioPoints?.length > 0 && (
              <ul className={PP_BIO_LIST_CLASSES}>
                {career.bioPoints.map((pt, i) => <li key={i}>{pt}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className={PP_TABS_CLASSES}>
          <button className={ppTabClasses(ppTab === 'stats')} onClick={() => setPpTab('stats')}>{t('playerPopup.tabs.stats')}</button>
          <button className={ppTabClasses(ppTab === 'heatmap')} onClick={() => setPpTab('heatmap')}>{t('playerPopup.tabs.heatMap')}</button>
          <button className={ppTabClasses(ppTab === 'scout')} onClick={() => setPpTab('scout')}>{t('playerPopup.tabs.scout')}</button>
          <button className={ppTabClasses(ppTab === 'compare')} onClick={() => setPpTab('compare')}>{t('playerPopup.tabs.compare')}</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className={PP_BODY_CLASSES}>
            {statsLoading ? (
              <div className={PP_HEATMAP_EMPTY_CLASSES}>
                <div className={PP_HEATMAP_ICON_CLASSES}>📊</div>
                <div>{t('playerPopup.loadingStats')}</div>
              </div>
            ) : (
              <>
                {career?.recentGames?.length > 0 && (
                  <div>
                    <div className={PP_FORM_LABEL_CLASSES}>{t('playerPopup.recentForm.label')}</div>
                    <div className={PP_FORM_STRIP_CLASSES}>
                      {career.recentGames.map((g, i) => {
                        const decision = isGoalie ? pwhlGoalieDecision(g) : null;
                        const main = isGoalie
                          ? (decision || '—')
                          : `${g.goals ?? 0}-${g.assists ?? 0}-${g.points ?? 0}`;
                        const sub = isGoalie ? (g.svpct != null ? g.svpct.toFixed(3) : null) : null;
                        const color = isGoalie
                          ? pwhlDecisionColor(decision)
                          : ((g.goals ?? 0) + (g.assists ?? 0) > 0 ? 'var(--green)' : 'var(--text-muted)');
                        return (
                          <div key={i} className={PP_FORM_CARD_CLASSES}>
                            <span className="text-[9px] text-[color:var(--text-dim)] whitespace-nowrap">{g.game}</span>
                            <span className="text-[13px] font-bold font-[family-name:var(--font-mono)]" style={{ color }}>{main}</span>
                            {sub && <span className="text-[8px] text-[color:var(--text-dim)]">{sub}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {currentGroups.length > 0
                  ? <TileStatSection
                      label={t('playerPopup.sections.seasonRegularPwhl', { season: seasonLabel })}
                      groups={currentGroups}
                      highlight
                      percentiles={!isGoalie ? pctData?.percentiles : undefined}
                      pctMap={PWHL_STAT_PCT_MAP}
                    />
                  : <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.bio.noStats')}</div>}
                {(careerRegGroups.length > 0 || careerPOGroups.length > 0) && (
                  <div className="stat-section-peers">
                    {careerRegGroups.length > 0 && <TileStatSection label={t('playerPopup.sections.careerRegularPwhl')} groups={careerRegGroups} />}
                    {careerPOGroups.length > 0 && <TileStatSection label={t('playerPopup.sections.careerPlayoffs')} groups={careerPOGroups} />}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Heat map tab ── */}
        {ppTab === 'heatmap' && (
          <PWHLHeatMap playerId={p.player_id} season={season} isGoalie={isGoalie} teamId={p.team_id} />
        )}

        {/* ── Scout tab ── */}
        {ppTab === 'scout' && (
          <PWHLScout player={p} isGoalie={isGoalie} seasonLabel={seasonLabel} />
        )}

        {/* ── Compare tab — season-over-season (Session 64) ── */}
        {ppTab === 'compare' && (
          <div className={PP_BODY_CLASSES}>
            <SeasonComparisonPicker
              league="pwhl"
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
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="stat-section-body">
                  {gameLogLoading
                    ? <div className={PP_NO_STATS_CLASSES}>{t('playerPopup.compareTab.loadingChart')}</div>
                    : <SeasonOverlayChart series={chartSeries} metricLabel={activeChartDef.label} />}
                </div>
              </div>
            )}
            {[...compareSeasons].sort((a, b) => b - a).map(s => (
              <PWHLCompareSeasonCard
                key={s}
                playerId={p.player_id}
                seasonValue={s}
                label={compareLabel(s)}
                defs={defs}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
