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
import '../views/PlayersView.css';

const SEASON_LABEL = '2025–26';

// ── Stat definitions ──────────────────────────────────────────

// `perGame`/`perGameKey` (Session 70) mark which stats have a real
// per-game source in pwhl_skater_game_box/pwhl_goalie_game_box (via the
// poller's /pwhl/player-game-log route) for the Compare tab's trend chart.
// PP/SH/GW goal breakdowns and win/loss/shutout aren't in the box score at
// all (aggregate-only, no per-game path); shot_pct/sv_pct/gaa are left
// tile-only too even though technically derivable, to match exactly the
// 6/11 skater and 2/9 goalie counts scoped and decided on for this pass —
// see SESSION_70_DECISION_compare_tab_layout.md.
const SKATER_STATS = [
  { key: 'goals',      label: 'Goals',  group: 'Scoring', perGame: true,
    tip: 'Total goals scored.',
    why: 'The most direct measure of finishing ability and offensive contribution.' },
  { key: 'assists',    label: 'Assists', group: 'Scoring', perGame: true,
    tip: 'Points credited for setting up a goal.',
    why: 'Reflects playmaking and vision.' },
  { key: 'points',     label: 'Points', group: 'Scoring', perGame: true,
    tip: 'Goals + Assists.',
    why: 'Primary measure of offensive production.' },
  { key: 'plus_minus', label: '+/−',    group: 'Scoring', perGame: true,
    tip: '+1 when on ice for a goal for; −1 for a goal against at even strength.',
    why: 'Rough proxy for two-way effectiveness.' },
  { key: 'gp',         label: 'GP',     group: 'Scoring',
    tip: 'Games played.',
    why: 'Context for all counting stats.' },
  { key: 'pp_goals',   label: 'PPG',    group: 'Special Teams',
    tip: 'Goals scored on the power play.',
    why: 'Indicates value on the man-advantage unit.' },
  { key: 'sh_goals',   label: 'SHG',    group: 'Special Teams',
    tip: 'Goals scored while shorthanded.',
    why: 'Rare and opportunistic — indicates speed and instinct.' },
  { key: 'gw_goals',   label: 'GWG',    group: 'Special Teams',
    tip: 'The goal that proved to be the winning margin.',
    why: 'A measure of clutch scoring.' },
  { key: 'shots',      label: 'Shots',  group: 'Shot Quality', perGame: true,
    tip: 'Shots on goal.',
    why: 'High shot volume indicates offensive presence even when not scoring.' },
  { key: 'shot_pct',   label: 'S%',     group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100.',
    calc: 'S% = (Goals / Shots) × 100',
    why: 'Sustained high S% indicates elite finishing; extreme values often regress.' },
  { key: 'pim',        label: 'PIM',    group: 'Discipline', perGame: true, perGameKey: 'penalty_minutes',
    tip: 'Penalty minutes.',
    why: 'High PIM hurts the team; compare to physical impact for full picture.' },
];

// Box-score stat keys with a backing percentile column in
// /pwhl/player/percentiles -- same small-subset pattern as NHL's
// STAT_PCT_MAP in PlayerPopup.jsx (pwhl_percentiles.py only computes
// these 4 categories today; assists maps to a1/primary-assists rate,
// not the raw all-assist count, same caveat as NHL's own 'assists' tile).
const PWHL_STAT_PCT_MAP = {
  goals:    'goals',
  assists:  'a1',
  pim:      'penalties',
  shot_pct: 'finishing',
};

const GOALIE_STATS = [
  { key: 'gp',           label: 'GP',  group: 'Record',
    tip: 'Games played.', why: 'Context for all other stats.' },
  { key: 'wins',         label: 'W',   group: 'Record',
    tip: 'Wins.', why: 'Primary measure of team contribution.' },
  { key: 'losses',       label: 'L',   group: 'Record',
    tip: 'Regulation losses.', why: 'Combined with OTL gives the full record.' },
  { key: 'ot_losses',    label: 'OTL', group: 'Record',
    tip: 'Overtime/shootout losses (1 point for the team).',
    why: 'Goalies with many OTL often faced close games.' },
  { key: 'sv_pct',       label: 'SV%', group: 'Performance',
    tip: 'Saves ÷ Shots Against.',
    calc: 'SV% = Saves / Shots Against',
    why: 'The most important goalie stat. Even small differences are significant.' },
  { key: 'gaa',          label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes.',
    calc: 'GAA = (Goals Against / Minutes Played) × 60',
    why: 'Best read alongside SV% for full context.' },
  { key: 'shutouts',     label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals.',
    why: 'A prestigious milestone.' },
  { key: 'saves',        label: 'SV',  group: 'Performance', perGame: true,
    tip: 'Total saves made.', why: 'Combined with shots against gives SV%.' },
  { key: 'goals_against',label: 'GA',  group: 'Performance', perGame: true,
    tip: 'Total goals allowed.', why: 'Context for GAA and SV%.' },
];

// ── Helpers ───────────────────────────────────────────────────

function posLabel(code) {
  return { C:'Centre', LW:'Left Wing', RW:'Right Wing', D:'Defence',
           LD:'Left Defence', RD:'Right Defence', G:'Goalie', F:'Forward' }[code] || code;
}

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
    <div className="pp-quickstat">
      <span className="pp-quickstat-val">{pct != null ? Math.round(pct) : '—'}</span>
      <span className="pp-quickstat-label">{label}</span>
    </div>
  );
}

// Header panel (Session 85) — PWHL's equivalent of NHL PlayerPopup's
// SkaterHeaderPanel. Substitutes a 2x2 percentile-tile grid for NHL's
// radar + G/A/P/TOI totals since PWHL only computes 4 percentile
// categories today (pwhl_percentiles.py) and has no radar-worthy stat
// set to plot. Reuses the same percentiles/pctMap the Stats tab's
// TileStatSection already fetches -- no second request.
function PWHLHeaderPanel({ percentiles }) {
  if (!percentiles) return null;
  const tiles = [
    { statKey: 'goals',    label: 'G' },
    { statKey: 'assists',  label: 'A1' },
    { statKey: 'pim',      label: 'PIM' },
    { statKey: 'shot_pct', label: 'S%' },
  ];
  return (
    <div className="pp-header-radar">
      <div className="pp-quickstats">
        {tiles.map(t => (
          <PWHLPercentileTile key={t.statKey} label={t.label}
            pct={percentiles[PWHL_STAT_PCT_MAP[t.statKey]]?.pct} />
        ))}
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

// PWHL's own version of PlayerPopup.jsx's groupStats(), keyed on this
// file's field names (shot_pct/sv_pct/gaa/plus_minus rather than NHL's
// shootingPctg/savePctg/goalsAgainstAvg/plusMinus) -- same {group, items:
// [{def, fmt}]} output shape StatTileGrid (Session 75, shared with NHL)
// expects, so the same formatter runs over current-season, Compare-tab,
// and Career data (the poller's /pwhl/player/career route renames its
// HockeyTech fields to match these same keys for exactly this reason).
function pwhlGroupStats(defs, stats) {
  const groups = {};
  defs.forEach(def => {
    const raw = stats?.[def.key];
    if (raw == null) return;
    let fmt;
    if (def.key === 'shot_pct') fmt = `${Number(raw).toFixed(1)}%`;
    else if (def.key === 'sv_pct') fmt = Number(raw).toFixed(3).replace(/^0\./, '.');
    else if (def.key === 'gaa') fmt = Number(raw).toFixed(2);
    else if (def.key === 'plus_minus') { const n = Number(raw); fmt = n > 0 ? `+${n}` : String(n); }
    else fmt = raw;
    if (!groups[def.group]) groups[def.group] = [];
    groups[def.group].push({ def, fmt });
  });
  return Object.entries(groups).map(([group, items]) => ({ group, items }));
}

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
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🥅</div>
        <div>Goalie shot maps not yet available.</div>
        <div className="pp-heatmap-sub">Coming in a future update.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🎯</div>
        <div>Loading shot data…</div>
      </div>
    );
  }

  if (!shotData || !shotData.shots?.length) {
    return (
      <div className="pp-heatmap-empty">
        <div className="pp-heatmap-icon">🎯</div>
        <div>No shot data for this player.</div>
        <div className="pp-heatmap-sub">Data builds up as games complete.</div>
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
    <div className="pp-heatmap">
      <div className="pp-heatmap-summary">
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num goal-col">{goals}</span><span>Goals</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num sog-col">{sog}</span><span>SOG</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{total}</span><span>Total</span></div>
        <div className="pp-heatmap-stat"><span className="pp-heatmap-num">{sh}%</span><span>SH%</span></div>
      </div>
      <div className="pp-heatmap-filters">
        {[
          { key: 'all',   label: `All (${total})` },
          { key: 'goals', label: `Goals (${goals})` },
          { key: 'sog',   label: `SOG (${sog})` },
        ].map(f => (
          <button key={f.key} className={`pp-heatmap-chip${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {(() => {
        const tAbbr  = getPWHLTeamById(teamId)?.abbr || 'BOS';
        const tTeam  = PWHL_TEAM_MAP[tAbbr];
        const tColor = tTeam?.displayColor || 'var(--team-primary)';
        return (
          <div className="pp-heatmap-rink">
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
      <div className="scout-wrap">
        <div className="scout-empty">
          <div className="scout-empty-icon">📋</div>
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
      <div className="scout-wrap">
        <div className="scout-loading">
          {[95, 88, 72, 90, 65].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 11, width: `${w}%`, marginBottom: 10, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!blurb) {
    return (
      <div className="scout-wrap">
        <div className="scout-empty">
          <div className="scout-empty-icon">📋</div>
          <div>Failed to generate report. Try again.</div>
          <button onClick={() => { setGenerated(false); }} style={{ marginTop: 8, padding: '6px 16px', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="scout-wrap">
      <div className="scout-header">
        <span className="scout-label">Scouting Report</span>
        <span className="scout-season">{seasonLabel}</span>
      </div>
      <div className="scout-blurb">{blurb}</div>
      <div className="scout-footer">AI-generated · EyeWall Analytics</div>
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

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className={`pp-header ${showHeaderReflow ? 'pp-header-reflow' : ''}`}>
          <div className="pp-photo-wrap">
            {!imgErr ? (
              <img src={headshot} alt={name} className="pp-photo" onError={() => setImgErr(true)} />
            ) : (
              <div className="pp-photo-fallback">{initials}</div>
            )}
          </div>
          <div className="pp-identity">
            {p.jersey_number && <div className="pp-num">#{p.jersey_number}</div>}
            <div className="pp-name">
              <span className="pp-first">{firstName}</span>
              <span className="pp-last">{lastName}</span>
            </div>
            <div className="pp-chips">
              {p.position && <span className="pp-pos-chip">{posLabel(p.position)}</span>}
              {!showHeaderReflow && p.shoots && <span className="pp-chip">Shoots {p.shoots === 'L' ? 'Left' : p.shoots === 'R' ? 'Right' : p.shoots}</span>}
            </div>
            {!showHeaderReflow && p.birth_date && (
              <div className="pp-birth">
                {fmtBirth(p.birth_date)} · Age {calcAge(p.birth_date)}
                {p.birth_city ? ` · ${p.birth_city}` : ''}
              </div>
            )}
          </div>
          {showHeaderReflow && <PWHLHeaderPanel percentiles={pctData.percentiles} />}
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Bio row — full width, 6 evenly-spaced columns (Session 85) ── */}
        {showHeaderReflow && (
          <div className="pp-bio-row">
            {bioFields.map(f => (
              <div className="pp-bio-field" key={f.label}>
                <div className="pp-bio-label">{f.label}</div>
                <div className="pp-bio-value">{f.value ?? '—'}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="pp-tabs">
          <button className={`pp-tab${ppTab === 'stats'   ? ' active' : ''}`} onClick={() => setPpTab('stats')}>📊 Stats</button>
          {!isGoalie && (
            <button className={`pp-tab${ppTab === 'heatmap' ? ' active' : ''}`} onClick={() => setPpTab('heatmap')}>🎯 Heat Map</button>
          )}
          <button className={`pp-tab${ppTab === 'scout'   ? ' active' : ''}`} onClick={() => setPpTab('scout')}>🔍 Scout</button>
          <button className={`pp-tab${ppTab === 'compare' ? ' active' : ''}`} onClick={() => setPpTab('compare')}>🆚 Compare</button>
        </div>

        {/* ── Stats tab ── */}
        {ppTab === 'stats' && (
          <div className="pp-body">
            {statsLoading ? (
              <div className="pp-heatmap-empty">
                <div className="pp-heatmap-icon">📊</div>
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
                    className="pp-metric-select"
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
