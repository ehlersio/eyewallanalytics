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
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchPWHLPlayerShots, fetchPWHLPlayerLanding } from '../utils/pwhlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { PWHL_CURRENT_SEASON, PWHL_TEAM_MAP } from '../utils/pwhlConfig';

const TEAM_CODES = {1:'BOS',2:'MIN',3:'MTL',4:'NY',5:'OTT',6:'TOR',8:'SEA',9:'VAN'};

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
import IceRink from './IceRink';
import InfoTip from './InfoTip';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import '../views/PlayersView.css';

const SEASON_LABEL = '2025–26';

// ── Stat definitions ──────────────────────────────────────────

const SKATER_STATS = [
  { key: 'goals',      label: 'Goals',  group: 'Scoring',
    tip: 'Total goals scored.',
    why: 'The most direct measure of finishing ability and offensive contribution.' },
  { key: 'assists',    label: 'Assists', group: 'Scoring',
    tip: 'Points credited for setting up a goal.',
    why: 'Reflects playmaking and vision.' },
  { key: 'points',     label: 'Points', group: 'Scoring',
    tip: 'Goals + Assists.',
    why: 'Primary measure of offensive production.' },
  { key: 'plus_minus', label: '+/−',    group: 'Scoring',
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
  { key: 'shots',      label: 'Shots',  group: 'Shot Quality',
    tip: 'Shots on goal.',
    why: 'High shot volume indicates offensive presence even when not scoring.' },
  { key: 'shot_pct',   label: 'S%',     group: 'Shot Quality',
    tip: 'Goals ÷ Shots on Goal × 100.',
    why: 'Sustained high S% indicates elite finishing; extreme values often regress.' },
  { key: 'pim',        label: 'PIM',    group: 'Discipline',
    tip: 'Penalty minutes.',
    why: 'High PIM hurts the team; compare to physical impact for full picture.' },
];

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
    why: 'The most important goalie stat. Even small differences are significant.' },
  { key: 'gaa',          label: 'GAA', group: 'Performance',
    tip: 'Goals allowed per 60 minutes.',
    why: 'Best read alongside SV% for full context.' },
  { key: 'shutouts',     label: 'SO',  group: 'Performance',
    tip: 'Games where the goalie allowed zero goals.',
    why: 'A prestigious milestone.' },
  { key: 'saves',        label: 'SV',  group: 'Performance',
    tip: 'Total saves made.', why: 'Combined with shots against gives SV%.' },
  { key: 'goals_against',label: 'GA',  group: 'Performance',
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

// ── Stat components ───────────────────────────────────────────

function StatRow({ def, value }) {
  let fmt = value;
  if (def.key === 'shot_pct' && value != null) fmt = `${Number(value).toFixed(1)}%`;
  else if (def.key === 'sv_pct' && value != null) fmt = Number(value).toFixed(3).replace('0.', '.');
  else if (def.key === 'gaa'    && value != null) fmt = Number(value).toFixed(2);
  else if (def.key === 'plus_minus' && value != null) fmt = value > 0 ? `+${value}` : String(value);
  if (fmt == null) return null;
  return (
    <div className="stat-row">
      <div className="stat-row-left">
        <span className="stat-row-label">{def.label}</span>
        <InfoTip text={`${def.tip}${def.why ? ` — ${def.why}` : ''}`} position="above" />
      </div>
      <span className="stat-row-value">{fmt}</span>
    </div>
  );
}

function StatsSection({ label, stats, defs, highlight }) {
  const [open, setOpen] = useState(highlight);
  if (!stats) return null;
  const groups = [...new Set(defs.map(d => d.group))];
  const hasAny = defs.some(d => stats[d.key] != null);
  if (!hasAny) return null;
  return (
    <div className={`stat-section${highlight ? ' highlight-section' : ''}`}>
      <button className="stat-section-header" onClick={() => setOpen(o => !o)}>
        <span className="stat-section-label">{label}</span>
        {highlight && <span className="stat-section-current">Current</span>}
        <span className="stat-section-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="stat-section-body">
          {groups.map(g => {
            const rows = defs.filter(d => d.group === g && stats[d.key] != null);
            if (!rows.length) return null;
            return (
              <div key={g} className="stat-group">
                <div className="stat-group-label">{g}</div>
                {rows.map(def => <StatRow key={def.key} def={def} value={stats[def.key]} />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
        const tAbbr  = TEAM_CODES[teamId] || 'BOS';
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

function PWHLCompareSection({ label, stats, defs, loading }) {
  const hasAny = stats && defs.some(d => stats[d.key] != null);
  return (
    <div className="stat-section">
      <div className="stat-section-header">
        <span className="stat-section-label">{label}</span>
      </div>
      <div className="stat-section-body">
        {loading && <div className="skeleton" style={{ height: 11, width: '60%', margin: '8px 0' }} />}
        {!loading && !hasAny && <div className="pp-no-stats">No data for this player in {label}.</div>}
        {!loading && hasAny && [...new Set(defs.map(d => d.group))].map(g => {
          const rows = defs.filter(d => d.group === g && stats[d.key] != null);
          if (!rows.length) return null;
          return (
            <div key={g} className="stat-group">
              <div className="stat-group-label">{g}</div>
              {rows.map(def => <StatRow key={def.key} def={def} value={stats[def.key]} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const name      = p.player_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  const firstName = p.first_name || name.split(' ')[0] || '';
  const lastName  = p.last_name  || name.split(' ').slice(1).join(' ') || '';
  const headshot  = p.headshot || `https://assets.leaguestat.com/pwhl/240x240/${p.player_id}.jpg`;
  const initials  = (firstName[0] || '') + (lastName[0] || '');

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pp-header">
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
              {p.shoots    && <span className="pp-chip">Shoots {p.shoots === 'L' ? 'Left' : p.shoots === 'R' ? 'Right' : p.shoots}</span>}
            </div>
            {p.birth_date && (
              <div className="pp-birth">
                {fmtBirth(p.birth_date)} · Age {calcAge(p.birth_date)}
                {p.birth_city ? ` · ${p.birth_city}` : ''}
              </div>
            )}
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

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
                <StatsSection
                  label={`${seasonLabel} Regular Season`}
                  stats={p}
                  defs={defs}
                  highlight
                />
                {!defs.some(d => p[d.key] != null) && (
                  <div className="pp-no-stats">No stats available for this player yet.</div>
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
