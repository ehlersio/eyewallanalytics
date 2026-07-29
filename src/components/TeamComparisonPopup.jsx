import { useState, useMemo } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchTeamSeasonsCompare, fetchTeamSeasonsCompareTeams } from '../utils/nhlApi';
import { fetchPWHLTeamSeasonsCompare, fetchPWHLTeamSeasonsCompareTeams } from '../utils/pwhlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { getTeamXgTrend } from '../utils/supabaseClient';
import { ALL_TEAMS } from '../utils/teamConfig';
import { PWHL_TEAMS } from '../utils/pwhlConfig';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import SeasonOverlayChart from './SeasonOverlayChart';
import TeamOpponentPicker from './TeamOpponentPicker';
// Reuses PlayerPopup's popup shell + stat-section/stat-row classes
// (.popup-backdrop, .player-popup, .pp-header, .stat-section, .stat-row,
// etc) rather than duplicating them in a new stylesheet.
import '../views/PlayersView.css';

// A season with zero comparable seasons shouldn't lock the picker down to
// maxSelected=0 (which would make every chip permanently disabled) --
// fall back to unlimited (null) until the real count is known.
const FALLBACK_MAX_SELECTED = null;

// Up to ~3 visually distinct dash patterns before they blur together --
// used as a secondary cue alongside the color ramp below, cycling if more
// seasons than patterns are selected (per Session 66's spec: dash pattern
// alone doesn't scale, so it's never the only distinguishing signal).
const DASH_PATTERNS = [undefined, '6 4', '2 3'];

// Newest selected season gets full team-color saturation; older seasons
// fade toward a floor alpha so the chart still reads past ~3-4 overlaid
// seasons instead of becoming an indistinguishable knot of full-opacity
// lines. `index` is position within seasons sorted newest-first.
function hexToRgba(hex, alpha) {
  const clean = String(hex).replace('#', '');
  if (clean.length !== 6) return hex; // not a hex color (unexpected) -- pass through
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

// Box-score fields only for v1 (Session 64 locked decision) -- Corsi/xG/WAR
// excluded because they're null across every season for both leagues right
// now, not just older ones (SESSION_63_FINDINGS.md). fmt defaults to the
// raw value; pct fields are stored as 0-1 fractions in Supabase.
const METRICS = [
  { key: 'gamesPlayed',  label: 'GP' },
  { key: 'wins',         label: 'W' },
  { key: 'losses',       label: 'L' },
  { key: 'otLosses',     label: 'OTL' },
  { key: 'points',       label: 'PTS' },
  { key: 'goalsFor',     label: 'GF' },
  { key: 'goalsAgainst', label: 'GA' },
  { key: 'ppPct',        label: 'PP%', fmt: v => `${(v * 100).toFixed(1)}%` },
  { key: 'pkPct',        label: 'PK%', fmt: v => `${(v * 100).toFixed(1)}%` },
];

function MetricRow({ label, value, fmt }) {
  // Row exists (team has data for this season) but this specific field is
  // null -- "not tracked yet" state, distinct from the whole-season "not
  // yet available" case in TeamCompareSeasonCard below.
  const display = value == null ? '—' : (fmt ? fmt(value) : value);
  return (
    <div className="stat-row">
      <div className="stat-row-left"><span className="stat-row-label">{label}</span></div>
      <span className="stat-row-value">{display}</span>
    </div>
  );
}

function TeamCompareSeasonCard({ label, row }) {
  return (
    <div className="stat-section">
      <div className="stat-section-header">
        <span className="stat-section-label">{label}</span>
      </div>
      <div className="stat-section-body">
        {!row && (
          <div className="pp-no-stats">Not yet available for this season.</div>
        )}
        {row && METRICS.map(m => <MetricRow key={m.key} label={m.label} value={row[m.key]} fmt={m.fmt} />)}
      </div>
    </div>
  );
}

// Mode 1 of Team vs Team (Session 86): two teams, one season. Reuses
// TeamCompareSeasonCard's exact "row present vs Not yet available" shape,
// just keyed by team instead of season -- the underlying Worker routes
// (/team-seasons/compare-teams, /pwhl/team-seasons/compare-teams) already
// return a gap the same way /team-seasons/compare does.
function FullStatComparisonPanel({ league, teamValue, teamLabel }) {
  const [opponent, setOpponent] = useState(null);
  const [season, setSeason] = useState([]); // SeasonComparisonPicker-shaped: 0 or 1 value

  const opponentOptions = league === 'pwhl'
    ? PWHL_TEAMS.map(t => ({ value: t.teamId, label: t.displayName }))
    : ALL_TEAMS.map(t => ({ value: t.abbr, label: t.displayName }));

  const { data: comparisonConfig } = useFetch(fetchComparisonSeasons, []);
  const seasonOptions = normalizeComparisonSeasons(league, comparisonConfig?.[league]?.seasons);
  const labelFor = (val) => seasonOptions.find(s => s.value === val)?.label || `Season ${val}`;

  const selectedSeason = season[0] ?? null;
  const fetchFn = league === 'pwhl' ? fetchPWHLTeamSeasonsCompareTeams : fetchTeamSeasonsCompareTeams;
  const { data: rows, loading } = useFetch(
    () => (opponent && selectedSeason) ? fetchFn(teamValue, opponent, selectedSeason) : Promise.resolve([]),
    [teamValue, opponent, selectedSeason]
  );

  const rowByTeam = new Map((rows || []).map(r => [String(r.team), r]));
  const opponentLabel = opponentOptions.find(t => String(t.value) === String(opponent))?.label || 'Opponent';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <TeamOpponentPicker teams={opponentOptions} value={opponent} onChange={setOpponent} excludeValue={teamValue} />
        <SeasonComparisonPicker
          league={league}
          selected={season}
          onChange={setSeason}
          maxSelected={1}
        />
      </div>

      {!opponent && (
        <div className="pp-no-stats">Choose an opponent and a season above to compare.</div>
      )}
      {opponent && !selectedSeason && (
        <div className="pp-no-stats">Choose a season above to compare.</div>
      )}

      {loading && opponent && selectedSeason && (
        <div className="pp-no-stats">Loading…</div>
      )}
      {!loading && opponent && selectedSeason && (
        <>
          <div className="pp-birth" style={{ marginTop: 8 }}>{labelFor(selectedSeason)}</div>
          <div className="stat-section-peers">
            <TeamCompareSeasonCard label={teamLabel} row={rowByTeam.get(String(teamValue))} />
            <TeamCompareSeasonCard label={opponentLabel} row={rowByTeam.get(String(opponent))} />
          </div>
        </>
      )}
    </>
  );
}

// Head-to-Head (Mode 2) is a separate, larger build -- league-specific
// query patterns for "all games between two teams across all seasons"
// (see TEAM_VS_TEAM_COMPARISON_BRIEF.md's Mode 2 notes) plus derived-
// insight logic that doesn't exist yet. Placeholder until that lands.
function HeadToHeadPanel() {
  return <div className="pp-no-stats">Head-to-head history is coming in a follow-up build.</div>;
}

// Generic team-level season-over-season comparison popup — one component
// for both leagues (per Session 64's "no PWHL-specific" mandate), same
// pattern as SeasonComparisonPicker itself. `teamValue` is a team abbr for
// NHL, a numeric team_id for PWHL — whatever fetchTeamSeasonsCompare /
// fetchPWHLTeamSeasonsCompare expect.
export default function TeamComparisonPopup({ league, teamValue, teamLabel, onClose }) {
  const [mode, setMode] = useState('season'); // 'season' | 'team'
  const [teamSubMode, setTeamSubMode] = useState('full'); // 'full' | 'h2h', only relevant when mode === 'team'
  const [compareSeasons, setCompareSeasons] = useState([]);

  const fetchFn = league === 'pwhl' ? fetchPWHLTeamSeasonsCompare : fetchTeamSeasonsCompare;
  const { data: rows, loading } = useFetch(
    () => compareSeasons.length ? fetchFn(teamValue, compareSeasons) : Promise.resolve([]),
    [teamValue, compareSeasons.join(',')]
  );

  // Reuses the same memoized fetch SeasonComparisonPicker itself calls --
  // purely for season labels ("2025-26 Playoffs" etc), no second request.
  const { data: comparisonConfig } = useFetch(fetchComparisonSeasons, []);
  const seasonOptions = normalizeComparisonSeasons(league, comparisonConfig?.[league]?.seasons);
  const labelFor = (val) => seasonOptions.find(s => s.value === val)?.label || `Season ${val}`;

  // Session 66: no artificial 4-season ceiling. This is the same
  // /config/seasons/comparison-backed list SeasonComparisonPicker itself
  // renders chips from -- the least-bad existing source of "how many
  // seasons exist to compare" (there's no per-team team_seasons count
  // endpoint; see Session 63/65 notes on the missing NHL season-list
  // source of truth). It's a league-wide list, not literally scoped to
  // this team, but it's what's already being fetched here and it's what
  // bounds the picker's own chip set, so it can't ever under-count what's
  // actually selectable.
  const maxSelected = seasonOptions.length > 0 ? seasonOptions.length : FALLBACK_MAX_SELECTED;

  const rowBySeason = new Map((rows || []).map(r => [r.season, r]));

  // ── xGF% overlay chart (Session 66, NHL-only v1) ───────────────────────
  // getTeamXgTrend is the one metric with real per-game trend data already
  // plumbed end-to-end (see XgfSparkline in TeamView.jsx for the
  // single-season version this generalizes). GF/GA/PP%/PK% per-game trends
  // need new poller work and are explicitly out of scope for this pass.
  const isNhl = league === 'nhl';
  const { data: xgTrendsBySeason, loading: xgLoading } = useFetch(
    () => (isNhl && compareSeasons.length)
      ? Promise.all(compareSeasons.map(season => getTeamXgTrend(teamValue, season)))
      : Promise.resolve([]),
    [isNhl, teamValue, compareSeasons.join(',')]
  );

  const teamColor = isNhl
    ? (getComputedStyle(document.documentElement).getPropertyValue('--team-primary').trim() || '#e63946')
    : null;

  const sortedDesc = useMemo(() => [...compareSeasons].sort((a, b) => b - a), [compareSeasons]);

  const chartSeries = useMemo(() => {
    if (!isNhl || !xgTrendsBySeason) return [];
    const trendBySeason = new Map(compareSeasons.map((s, i) => [s, xgTrendsBySeason[i] || null]));
    return sortedDesc.map((season, idx) => {
      const games = trendBySeason.get(season)?.season || [];
      return {
        seasonLabel: labelFor(season),
        color: seasonRampColor(teamColor, idx, sortedDesc.length),
        dashPattern: DASH_PATTERNS[idx % DASH_PATTERNS.length],
        dataPoints: games.map((g, i) => ({ gameNumber: i + 1, value: g.xgfPct })),
      };
    });
  }, [isNhl, xgTrendsBySeason, compareSeasons, sortedDesc, teamColor]);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>
        <div className="pp-header">
          <div className="pp-identity">
            <div className="pp-name"><span className="pp-first">{mode === 'team' ? 'Compare Teams' : 'Compare Seasons'}</span></div>
            <div className="pp-birth">{teamLabel}</div>
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pp-body">
          <div className="compare-mode-toggle" role="group" aria-label="Comparison mode">
            <button
              type="button"
              className={'compare-mode-btn' + (mode === 'season' ? ' compare-mode-btn-active' : '')}
              aria-pressed={mode === 'season'}
              onClick={() => setMode('season')}
            >
              vs Season
            </button>
            <button
              type="button"
              className={'compare-mode-btn' + (mode === 'team' ? ' compare-mode-btn-active' : '')}
              aria-pressed={mode === 'team'}
              onClick={() => setMode('team')}
            >
              vs Team
            </button>
          </div>

          {mode === 'season' && (
            <>
              <SeasonComparisonPicker
                league={league}
                selected={compareSeasons}
                onChange={setCompareSeasons}
                maxSelected={maxSelected}
              />
              {compareSeasons.length === 0 && (
                <div className="pp-no-stats">Select two or more seasons above to compare.</div>
              )}

              {isNhl && compareSeasons.length > 0 && (
                // xg-overlay-section keeps the .stat-section visual styling (card
                // shell, header, body) but is deliberately excluded by that class
                // alone -- team.cy.js counts ".stat-section" to mean "one card
                // per selected season," and this section isn't one of those.
                <div className="stat-section xg-overlay-section">
                  <div className="stat-section-header">
                    <span className="stat-section-label">xGF% per game · 5v5</span>
                  </div>
                  <div className="stat-section-body">
                    {xgLoading
                      ? <div className="pp-no-stats">Loading chart…</div>
                      : (
                        <SeasonOverlayChart
                          series={chartSeries}
                          metricLabel="xGF% (5v5)"
                          valueFormatter={(v) => `${v}%`}
                          yDomain={[0, 100]}
                          referenceValue={50}
                        />
                      )}
                  </div>
                </div>
              )}

              {loading && compareSeasons.length > 0 && (
                <div className="pp-no-stats">Loading…</div>
              )}
              {!loading && sortedDesc.length > 0 && (
                <div className="stat-section-peers">
                  {sortedDesc.map(season => (
                    <TeamCompareSeasonCard
                      key={season}
                      label={labelFor(season)}
                      row={rowBySeason.get(season)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {mode === 'team' && (
            <>
              <div className="compare-mode-toggle compare-submode-toggle" role="group" aria-label="Team comparison type">
                <button
                  type="button"
                  className={'compare-mode-btn' + (teamSubMode === 'full' ? ' compare-mode-btn-active' : '')}
                  aria-pressed={teamSubMode === 'full'}
                  onClick={() => setTeamSubMode('full')}
                >
                  Full Stat Comparison
                </button>
                <button
                  type="button"
                  className={'compare-mode-btn' + (teamSubMode === 'h2h' ? ' compare-mode-btn-active' : '')}
                  aria-pressed={teamSubMode === 'h2h'}
                  onClick={() => setTeamSubMode('h2h')}
                >
                  Head-to-Head
                </button>
              </div>

              {teamSubMode === 'full'
                ? <FullStatComparisonPanel league={league} teamValue={teamValue} teamLabel={teamLabel} />
                : <HeadToHeadPanel />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
