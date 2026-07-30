import { useState, useMemo, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchTeamSeasonsCompare, fetchTeamSeasonsCompareTeams, fetchTeamHeadToHead } from '../utils/nhlApi';
import { fetchPWHLTeamSeasonsCompare, fetchPWHLTeamSeasonsCompareTeams, fetchPWHLTeamHeadToHead } from '../utils/pwhlApi';
import { fetchComparisonSeasons } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import { getTeamXgTrend } from '../utils/supabaseClient';
import { ALL_TEAMS } from '../utils/teamConfig';
import { PWHL_TEAMS } from '../utils/pwhlConfig';
import SeasonComparisonPicker from './SeasonComparisonPicker';
import SeasonOverlayChart from './SeasonOverlayChart';
import TeamOpponentPicker from './TeamOpponentPicker';
import TeamLogo from './TeamLogo';
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

// Resolves {abbr, color} for TeamLogo from whatever value a team is
// keyed by -- an NHL abbr string directly, or a PWHL numeric team_id
// (which <select> always round-trips as a string, so compared loosely
// here rather than assuming a type). Used for both the popup's own team
// and, once picked, its vs-Team opponent (Session 86 header redesign).
function resolveTeamLogo(league, value) {
  if (league === 'pwhl') {
    const t = PWHL_TEAMS.find(t => String(t.teamId) === String(value));
    return { abbr: t?.abbr, color: t?.displayColor };
  }
  return { abbr: value, color: undefined };
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
//
// Opponent is lifted all the way to the parent (Session 88: shared with
// HeadToHeadPanel below, one picker for both sub-tabs) and rendered once
// by the parent, not here -- this panel only owns the season picker.
function FullStatComparisonPanel({ league, teamValue, teamLabel, opponent, opponentLabel, season, onSeasonChange }) {
  const selectedSeason = season[0] ?? null;
  const fetchFn = league === 'pwhl' ? fetchPWHLTeamSeasonsCompareTeams : fetchTeamSeasonsCompareTeams;
  const { data: rows, loading } = useFetch(
    () => (opponent && selectedSeason) ? fetchFn(teamValue, opponent, selectedSeason) : Promise.resolve([]),
    [teamValue, opponent, selectedSeason]
  );

  const rowByTeam = new Map((rows || []).map(r => [String(r.team), r]));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <SeasonComparisonPicker
          league={league}
          selected={season}
          onChange={onSeasonChange}
          maxSelected={1}
        />
      </div>

      {!opponent && (
        <div className="pp-no-stats">Choose an opponent above and a season to compare.</div>
      )}
      {opponent && !selectedSeason && (
        <div className="pp-no-stats">Choose a season above to compare.</div>
      )}

      {loading && opponent && selectedSeason && (
        <div className="pp-no-stats">Loading…</div>
      )}
      {!loading && opponent && selectedSeason && (
        <div className="stat-section-peers">
          <TeamCompareSeasonCard label={teamLabel} row={rowByTeam.get(String(teamValue))} />
          <TeamCompareSeasonCard label={opponentLabel} row={rowByTeam.get(String(opponent))} />
        </div>
      )}
    </>
  );
}

// AI narrative layer on top of the templated head-to-head stats above
// (Session 90 fast-follow). Posts the derived-insight fields the Worker
// already computed (record/window/streak/isThinSample) back to it --
// deliberately not the full h2h.games array, which the narrative route
// never reads and which can run long for teams with several seasons of
// history; no point shipping that on every popup open. Auto-generates on
// mount and the Worker caches in KV so only the first viewer of a given
// pair pays the generation cost, same UX pattern as PeriodSummary.jsx's
// game/period narratives.
function HeadToHeadNarrativeCard({ league, h2h, teamADisplay, teamBDisplay }) {
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const { teamA, teamB, totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample } = h2h;

  useEffect(() => {
    let cancelled = false;
    setNarrative(null);
    setFailed(false);
    setLoading(true);

    const workerUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WORKER_URL : null;
    if (!workerUrl) { setLoading(false); setFailed(true); return undefined; }

    const path = league === 'pwhl'
      ? '/pwhl/team-seasons/head-to-head/narrative'
      : '/team-seasons/head-to-head/narrative';

    fetch(`${workerUrl}${path}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        teamA, teamB, teamADisplay, teamBDisplay,
        totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample,
      }),
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`Worker ${res.status}`)))
      .then(data => {
        if (cancelled) return;
        if (data.narrative) setNarrative(data.narrative);
        else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [league, teamA, teamB, totalMeetings, teamADisplay, teamBDisplay]);

  if (failed) return null;

  return (
    <div className="h2h-narrative">
      <div className="h2h-narrative-label"><span>⚡</span> EyeWall AI</div>
      {loading ? (
        <div className="h2h-narrative-loading">
          <div className="h2h-narrative-dot" />
          Generating analysis…
        </div>
      ) : (
        <div className="h2h-narrative-text">{narrative}</div>
      )}
    </div>
  );
}

// Mode 2 of Team vs Team (Session 88): all-time head-to-head record,
// recent-window record, and current streak between two teams, across
// every season on record. Derived-insight math (record/streak/window)
// is computed server-side (buildHeadToHeadPayload in eyewall-poller's
// shared.js) -- this component only renders what the route already
// returns, no client-side recomputation.
// Scoreboard layout (Session 88 follow-up, Option B of 3 mockups) -- leads
// with both team logos and a big win-count split rather than a label/value
// stat-row list, with recent-window and streak as secondary pills below.
// "Since 2023-24" (not "All-time") because that's genuinely as far back as
// this app's own game_log/pwhl_game_log goes for either league -- see
// HEAD_TO_HEAD_BRIEF.md's historical-depth note. Don't relabel this
// "all-time" even though the underlying route has no season filter.
function HeadToHeadPanel({ league, teamValue, opponent, teamLabel, opponentLabel }) {
  const fetchFn = league === 'pwhl' ? fetchPWHLTeamHeadToHead : fetchTeamHeadToHead;
  const { data: h2h, loading } = useFetch(
    () => opponent ? fetchFn(teamValue, opponent) : Promise.resolve(null),
    [teamValue, opponent]
  );

  if (!opponent) {
    return <div className="pp-no-stats">Choose an opponent above to see head-to-head history.</div>;
  }
  if (loading) {
    return <div className="pp-no-stats">Loading…</div>;
  }
  if (!h2h || h2h.totalMeetings === 0) {
    return <div className="pp-no-stats">No meetings on record between these teams yet.</div>;
  }

  const { totalMeetings, allTimeRecord, recentWindow, currentStreak, isThinSample } = h2h;
  const isNhl = league === 'nhl';
  const sport = isNhl ? 'nhl' : 'pwhl';
  const { abbr: teamAbbr } = resolveTeamLogo(league, teamValue);
  const { abbr: opponentAbbr } = resolveTeamLogo(league, opponent);
  const streakAbbr = currentStreak?.holder === 'A' ? teamAbbr : opponentAbbr;

  return (
    <>
      <div className="h2h-scoreboard">
        <div className="h2h-scoreboard-label">Since 2023-24</div>
        <div className="h2h-scoreboard-teams">
          <div className="h2h-scoreboard-team">
            <TeamLogo abbr={teamAbbr} sport={sport} size={36} />
            <div className="h2h-scoreboard-wins">{allTimeRecord.teamAWins}</div>
          </div>
          <div className="h2h-scoreboard-vs">wins</div>
          <div className="h2h-scoreboard-team">
            <TeamLogo abbr={opponentAbbr} sport={sport} size={36} />
            <div className="h2h-scoreboard-wins">{allTimeRecord.teamBWins}</div>
          </div>
        </div>
        <div className="h2h-scoreboard-pills">
          {recentWindow.size < totalMeetings && (
            <span className="h2h-pill">Last {recentWindow.size}: {recentWindow.teamAWins}-{recentWindow.teamBWins}</span>
          )}
          {currentStreak && (
            <span className="h2h-pill">{streakAbbr} won {currentStreak.count} straight</span>
          )}
        </div>
        {isThinSample && (
          <div className="pp-no-stats" style={{ marginTop: 10 }}>
            Only {totalMeetings} meeting{totalMeetings === 1 ? '' : 's'} on record — too few to call a trend.
          </div>
        )}
      </div>
      <HeadToHeadNarrativeCard league={league} h2h={h2h} teamADisplay={teamLabel} teamBDisplay={opponentLabel} />
    </>
  );
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

  // vs-Team opponent/season selection (Session 86 header redesign) --
  // lifted here, not owned by FullStatComparisonPanel, so the header can
  // read "Team A vs Team B" once both are picked.
  const [vsTeamOpponent, setVsTeamOpponent] = useState(null);
  const [vsTeamSeason, setVsTeamSeason] = useState([]); // SeasonComparisonPicker-shaped: 0 or 1 value
  const opponentOptions = league === 'pwhl'
    ? PWHL_TEAMS.map(t => ({ value: t.teamId, label: t.displayName }))
    : ALL_TEAMS.map(t => ({ value: t.abbr, label: t.displayName }));

  // Header logo -- current team, always; opponent, once picked (Option C:
  // the header itself becomes the toggle). Opponent selection is shared
  // across both vs-Team sub-tabs (Session 88), so this no longer checks
  // teamSubMode -- Full Stat Comparison and Head-to-Head show the same
  // "Team A vs Team B" header once an opponent is picked, regardless of
  // which sub-tab is active.
  const { abbr: logoAbbr, color: logoColor } = resolveTeamLogo(league, teamValue);
  const showOpponentInHeader = mode === 'team' && !!vsTeamOpponent;
  const { abbr: opponentLogoAbbr, color: opponentLogoColor } = showOpponentInHeader
    ? resolveTeamLogo(league, vsTeamOpponent)
    : {};
  const opponentLabel = vsTeamOpponent
    ? (opponentOptions.find(t => String(t.value) === String(vsTeamOpponent))?.label || 'Opponent')
    : null;

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

  // Header content (Option C, Session 86): the identity row itself carries
  // the vs-Team state once an opponent is picked, rather than a generic
  // title that never changes. Falls back to the plain team label/name for
  // every other state (vs-Season mode, or vs-Team mode with nothing picked
  // yet) so there's no empty/broken-looking header while the user is still
  // choosing.
  const headerTitle = showOpponentInHeader ? `${teamLabel} vs ${opponentLabel}` : (mode === 'team' ? 'Compare Teams' : 'Compare Seasons');
  // Season label only applies to Full Stat Comparison -- Head-to-Head
  // spans all seasons, so it has no single season to show here.
  const headerSubtitle = showOpponentInHeader && teamSubMode === 'full' && vsTeamSeason[0]
    ? labelFor(vsTeamSeason[0])
    : (showOpponentInHeader && teamSubMode === 'h2h' ? 'Since 2023-24' : teamLabel);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>
        <div className="pp-header">
          <div className="cvt-team-logos">
            <div className="pp-photo-wrap">
              <TeamLogo abbr={logoAbbr} sport={league === 'pwhl' ? 'pwhl' : 'nhl'} size={44} color={logoColor} />
            </div>
            {showOpponentInHeader && (
              <>
                <span className="cvt-vs">vs</span>
                <div className="pp-photo-wrap">
                  <TeamLogo abbr={opponentLogoAbbr} sport={league === 'pwhl' ? 'pwhl' : 'nhl'} size={44} color={opponentLogoColor} />
                </div>
              </>
            )}
          </div>
          <div className="pp-identity">
            <div className="pp-name"><span className="pp-first">{headerTitle}</span></div>
            <div className="pp-birth">{headerSubtitle}</div>
          </div>
          <div className="cvt-mode-switch" role="group" aria-label="Comparison mode">
            <button
              type="button"
              className={mode === 'season' ? 'cvt-mode-switch-active' : ''}
              aria-pressed={mode === 'season'}
              onClick={() => setMode('season')}
              title="vs Season"
              aria-label="Compare vs season"
            >
              📅
            </button>
            <button
              type="button"
              className={mode === 'team' ? 'cvt-mode-switch-active' : ''}
              aria-pressed={mode === 'team'}
              onClick={() => setMode('team')}
              title="vs Team"
              aria-label="Compare vs team"
            >
              🆚
            </button>
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pp-body">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <TeamOpponentPicker teams={opponentOptions} value={vsTeamOpponent} onChange={setVsTeamOpponent} excludeValue={teamValue} />
              </div>

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
                ? (
                  <FullStatComparisonPanel
                    league={league}
                    teamValue={teamValue}
                    teamLabel={teamLabel}
                    opponent={vsTeamOpponent}
                    opponentLabel={opponentLabel}
                    season={vsTeamSeason}
                    onSeasonChange={setVsTeamSeason}
                  />
                )
                : (
                  <HeadToHeadPanel
                    league={league}
                    teamValue={teamValue}
                    opponent={vsTeamOpponent}
                    teamLabel={teamLabel}
                    opponentLabel={opponentLabel}
                  />
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
