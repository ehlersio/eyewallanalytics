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
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayerShots, fetchPWHLPlayerLanding, fetchPWHLPlayerGameLog, fetchPWHLPlayerCareer, fetchPWHLPlayerPercentiles } from '../utils/pwhlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP, getPWHLTeamById } from '../utils/pwhlConfig';
import SeasonOverlayChart from './SeasonOverlayChart';

// Local TEAM_CODES (team_id -> abbr) map removed Session 85 — stale
// duplicate missing expansion teams, same bug as PWHLShotMapView.jsx.
// Use getPWHLTeamById instead (already imported below).

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
import IceRink from './IceRink';
import { TileStatSection } from './StatTileGrid';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import PlayerComparisonEntry from './PlayerComparisonEntry';
import {
  SKATER_STATS, GOALIE_STATS, PWHL_STAT_PCT_MAP, posLabel, groupStats as pwhlGroupStats,
} from '../utils/pwhlPlayerStats';
import '../views/PlayersView.css';

// Tailwind migration (Session 97, Phase 3, sub-PR 2) -- see PlayerPopup.jsx
// for the full rationale on which classes stay plain (shared with
// TeamComparisonPopup.jsx's own markup, or entangled with a cascade-layer
// override on one of those shared classes): player-popup, pp-header,
// pp-header-reflow, pp-close, pp-body, pp-no-stats, pp-identity, pp-name,
// pp-first, pp-birth, pp-photo-wrap, popup-backdrop, stat-section,
// stat-section-header, stat-section-label, stat-section-body. pp-last is
// migrated but kept as a literal marker for the same surviving
// .pp-header-reflow .pp-last compound rule. pp-quickstats-col is migrated
// + its base rule deleted, kept literal for the .pce-toggle/.pce-wrap
// compact-mode override (moved into PlayerComparisonPopup.css this same
// sub-PR). Cypress markers kept: pp-heatmap-empty, pp-quickstats-col, pp-tab.
const PP_QUICKSTAT_CLASSES = 'flex flex-col items-center bg-[var(--bg2)] rounded-md py-1 px-[2px] min-w-0'
const PP_QUICKSTAT_VAL_CLASSES = 'font-[family-name:var(--font-display)] text-[13px] font-bold text-[color:var(--text)] leading-[1.1]'
const PP_QUICKSTAT_LABEL_CLASSES = 'text-[8px] text-[color:var(--text-dim)] uppercase tracking-[0.06em]'
const PP_HEADER_RADAR_CLASSES = 'flex items-center gap-2 flex-[1_1_auto] min-w-0 max-[340px]:flex-col'
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

const PP_TABS_CLASSES = 'flex border-b-[0.5px] border-[var(--border)] mx-[-16px] px-4'
const PP_TAB_BASE_CLASSES = 'pp-tab flex-1 py-[10px] text-[13px] font-semibold bg-transparent border-0 border-b-2 cursor-pointer [transition:all_0.15s]'
const PP_TAB_INACTIVE_CLASSES = 'text-[color:var(--text-muted)] border-b-transparent'
const PP_TAB_ACTIVE_CLASSES = 'text-[color:var(--red-bright)] border-b-[var(--red-bright)]'
function ppTabClasses(active) { return `${PP_TAB_BASE_CLASSES} ${active ? PP_TAB_ACTIVE_CLASSES : PP_TAB_INACTIVE_CLASSES}` }
const PP_METRIC_SELECT_CLASSES = 'text-[11px] text-[color:var(--text)] bg-[var(--bg2)] border-[0.5px] border-[var(--border)] rounded-md py-[3px] px-[6px]'

const SEASON_LABEL = '2025–26';

// SKATER_STATS moved to utils/pwhlPlayerStats.js (Session 91).

// SKATER_STATS/GOALIE_STATS/PWHL_STAT_PCT_MAP/posLabel/groupStats moved to
// utils/pwhlPlayerStats.js (Session 91) so PlayerComparisonPopup.jsx can
// reuse them without a circular import back into this file.

// ── Helpers ───────────────────────────────────────────────────

function fmtBirth(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

function PWHLPercentileTile({ label, pct }) {
  return (
    <div className={PP_QUICKSTAT_CLASSES}>
      <span className={PP_QUICKSTAT_VAL_CLASSES}>{pct != null ? Math.round(pct) : '—'}</span>
      <span className={PP_QUICKSTAT_LABEL_CLASSES}>{label}</span>
    </div>
  );
}

// Header panel (Session 85) — PWHL's equivalent of NHL PlayerPopup's
// SkaterHeaderPanel. Substitutes a 2x2 percentile-tile grid for NHL's
// radar + G/A/P/TOI totals since PWHL only computes 4 percentile
// categories today (pwhl_percentiles.py) and has no radar-worthy stat
// set to plot. Reuses the same percentiles/pctMap the Stats tab's
// TileStatSection already fetches -- no second request.
// `comparisonEntry` (the "vs Player" button, Session 91) stacks below the
// quickstats grid rather than sitting inline as a sibling of this panel --
// matching the fix applied to NHL's SkaterHeaderPanel after the inline
// placement was reported to squeeze that header row.
function PWHLHeaderPanel({ percentiles, comparisonEntry }) {
  if (!percentiles) return null;
  const tiles = [
    { statKey: 'goals',    label: 'G' },
    { statKey: 'assists',  label: 'A1' },
    { statKey: 'pim',      label: 'PIM' },
    { statKey: 'shot_pct', label: 'S%' },
  ];
  return (
    <div className={PP_HEADER_RADAR_CLASSES}>
      <div className={PP_QUICKSTATS_COL_CLASSES}>
        <div className={PP_QUICKSTATS_CLASSES}>
          {tiles.map(t => (
            <PWHLPercentileTile key={t.statKey} label={t.label}
              pct={percentiles[PWHL_STAT_PCT_MAP[t.statKey]]?.pct} />
          ))}
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

function PWHLHeatMap({ playerId, season, isGoalie, teamId }) {
  const [filter, setFilter] = useState('all');

  const { data: shotData, loading } = useFetch(
    () => !isGoalie && playerId ? fetchPWHLPlayerShots(playerId, season) : Promise.resolve(null),
    [playerId, season]
  );

  if (isGoalie) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🥅</div>
        <div>Goalie shot maps not yet available.</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>Coming in a future update.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>Loading shot data…</div>
      </div>
    );
  }

  if (!shotData || !shotData.shots?.length) {
    return (
      <div className={PP_HEATMAP_EMPTY_CLASSES}>
        <div className={PP_HEATMAP_ICON_CLASSES}>🎯</div>
        <div>No shot data for this player.</div>
        <div className={PP_HEATMAP_SUB_CLASSES}>Data builds up as games complete.</div>
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
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_GOAL_CLASSES}`}>{goals}</span><span>Goals</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_SOG_CLASSES}`}>{sog}</span><span>SOG</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{total}</span><span>Total</span></div>
        <div className={PP_HEATMAP_STAT_CLASSES}><span className={`${PP_HEATMAP_NUM_BASE_CLASSES} ${PP_HEATMAP_NUM_DEFAULT_CLASSES}`}>{sh}%</span><span>SH%</span></div>
      </div>
      <div className={PP_HEATMAP_FILTERS_CLASSES}>
        {[
          { key: 'all',   label: `All (${total})` },
          { key: 'goals', label: `Goals (${goals})` },
          { key: 'sog',   label: `SOG (${sog})` },
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
            <IceRink events={filtered} roster={{}} hidePlayerFilter
              teamAbbr={tAbbr} teamColor={tColor} />
          </div>
        );
      })()}
    </div>
  );
}

// ── Scouting blurb ────────────────────────────────────────────

function PWHLScout({ player, isGoalie, seasonLabel }) {
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
          <div style={{ marginBottom: 12 }}>Generate an AI scouting report for {name}.</div>
          <button
            onClick={generate}
            style={{
              padding: '8px 20px', background: 'var(--team-primary)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            Generate Report
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
            <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
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
          <div>Failed to generate report. Try again.</div>
          <button onClick={() => { setGenerated(false); }} style={{ marginTop: 8, padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={SCOUT_WRAP_CLASSES}>
      <div className={SCOUT_HEADER_CLASSES}>
        <span className={SCOUT_LABEL_CLASSES}>Scouting Report</span>
        <span className={SCOUT_SEASON_CLASSES}>{seasonLabel}</span>
      </div>
      <div className={SCOUT_BLURB_CLASSES}>{blurb}</div>
      <div className={SCOUT_FOOTER_CLASSES}>AI-generated · EyeWall Analytics</div>
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
  const groups = stats ? pwhlGroupStats(defs, stats) : [];
  if (loading) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className="skeleton" style={{ height: 11, width: '60%', margin: '8px 0' }} /></div>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="stat-section">
        <div className="stat-section-header"><span className="stat-section-label">{label}</span></div>
        <div className="stat-section-body"><div className="pp-no-stats">No data for this player in {label}.</div></div>
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

  // ── Percentiles (Session 80) — precomputed by eyewall-pipeline's
  // pwhl_percentiles.py, served as-is by the poller's
  // /pwhl/player/percentiles. Skaters only, current season only, same
  // scope NHL's PlayerPopup already applies to its own percentile tiles.
  const { data: pctData } = useFetch(
    () => (!isGoalie && playerId) ? fetchPWHLPlayerPercentiles(playerId, season) : Promise.resolve(null),
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
  // skaters with percentile data, same condition NHL's showHeaderReflow
  // uses -- goalies and the pre-percentiles loading flash keep the
  // original single-block header.
  const showHeaderReflow = !isGoalie && !!pctData?.percentiles;
  const bioFields = [
    { label: 'Height',    value: fmtHeight(p.height_inches) },
    { label: 'Weight',    value: null },
    { label: 'Shoots',    value: p.shoots ? (p.shoots === 'L' ? 'Left' : p.shoots === 'R' ? 'Right' : p.shoots) : null },
    { label: 'Age',       value: p.birth_date ? calcAge(p.birth_date) : null },
    { label: 'Birthdate', value: p.birth_date ? fmtBirth(p.birth_date) : null },
    { label: 'Hometown',  value: p.birth_city || null },
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
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={`pp-header ${showHeaderReflow ? 'pp-header-reflow' : ''}`}>
          <div className="pp-photo-wrap">
            {!imgErr ? (
              <img src={headshot} alt={name} className={PP_PHOTO_CLASSES} onError={() => setImgErr(true)} />
            ) : (
              <div className={PP_PHOTO_FALLBACK_CLASSES}>{initials}</div>
            )}
          </div>
          <div className="pp-identity">
            {p.jersey_number && <div className={PP_NUM_CLASSES}>#{p.jersey_number}</div>}
            <div className="pp-name">
              <span className="pp-first">{firstName}</span>
              <span className={`${PP_LAST_CLASSES} ${showHeaderReflow ? PP_LAST_REFLOW_CLASSES : ''}`}>{lastName}</span>
            </div>
            <div className={PP_CHIPS_CLASSES}>
              {p.position && <span className={PP_POS_CHIP_CLASSES}>{posLabel(p.position)}</span>}
              {!showHeaderReflow && p.shoots && <span className={PP_CHIP_CLASSES}>Shoots {p.shoots === 'L' ? 'Left' : p.shoots === 'R' ? 'Right' : p.shoots}</span>}
            </div>
            {!showHeaderReflow && p.birth_date && (
              <div className="pp-birth">
                {fmtBirth(p.birth_date)} · Age {calcAge(p.birth_date)}
                {p.birth_city ? ` · ${p.birth_city}` : ''}
              </div>
            )}
          </div>
          {showHeaderReflow && <PWHLHeaderPanel percentiles={pctData.percentiles} comparisonEntry={comparisonEntry} />}
          {!showHeaderReflow && comparisonEntry}
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
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

        {/* ── Tabs ── */}
        <div className={PP_TABS_CLASSES}>
          <button className={ppTabClasses(ppTab === 'stats')} onClick={() => setPpTab('stats')}>📊 Stats</button>
          {!isGoalie && (
            <button className={ppTabClasses(ppTab === 'heatmap')} onClick={() => setPpTab('heatmap')}>🎯 Heat Map</button>
          )}
          <button className={ppTabClasses(ppTab === 'scout')} onClick={() => setPpTab('scout')}>🔍 Scout</button>
          <button className={ppTabClasses(ppTab === 'compare')} onClick={() => setPpTab('compare')}>🆚 Compare</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className="pp-body">
            {statsLoading ? (
              <div className={PP_HEATMAP_EMPTY_CLASSES}>
                <div className={PP_HEATMAP_ICON_CLASSES}>📊</div>
                <div>Loading stats…</div>
              </div>
            ) : (
              <>
                {currentGroups.length > 0
                  ? <TileStatSection
                      label={`${seasonLabel} Regular Season`}
                      groups={currentGroups}
                      highlight
                      percentiles={!isGoalie ? pctData?.percentiles : undefined}
                      pctMap={PWHL_STAT_PCT_MAP}
                    />
                  : <div className="pp-no-stats">No stats available for this player yet.</div>}
                {(careerRegGroups.length > 0 || careerPOGroups.length > 0) && (
                  <div className="stat-section-peers">
                    {careerRegGroups.length > 0 && <TileStatSection label="Career Regular Season" groups={careerRegGroups} />}
                    {careerPOGroups.length > 0 && <TileStatSection label="Career Playoffs" groups={careerPOGroups} />}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Heat map tab — skaters only ── */}
        {ppTab === 'heatmap' && !isGoalie && (
          <PWHLHeatMap playerId={p.player_id} season={season} isGoalie={isGoalie} teamId={p.team_id} />
        )}

        {/* ── Scout tab ── */}
        {ppTab === 'scout' && (
          <PWHLScout player={p} isGoalie={isGoalie} seasonLabel={seasonLabel} />
        )}

        {/* ── Compare tab — season-over-season (Session 64) ── */}
        {ppTab === 'compare' && (
          <div className="pp-body">
            <SeasonComparisonPicker
              league="pwhl"
              selected={compareSeasons}
              onChange={setCompareSeasons}
              maxSelected={4}
            />
            {compareSeasons.length === 0 && (
              <div className="pp-no-stats">Select two or more seasons above to compare.</div>
            )}
            {chartableStatDefs.length > 0 && compareSeasons.length > 0 && (
              <div className="stat-section xg-overlay-section">
                <div className="stat-section-header">
                  <span className="stat-section-label">Per-game trend</span>
                  <select
                    className={PP_METRIC_SELECT_CLASSES}
                    value={activeChartDef?.key || ''}
                    onChange={e => setChartMetricKey(e.target.value)}
                    aria-label="Trend metric"
                  >
                    {chartableStatDefs.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="stat-section-body">
                  {gameLogLoading
                    ? <div className="pp-no-stats">Loading chart…</div>
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
