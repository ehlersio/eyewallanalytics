import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchTeamSeasonsCompare } from '../utils/nhlApi';
import { fetchPWHLTeamSeasonsCompare } from '../utils/pwhlApi';
import { fetchComparisonSeasons, fetchSeasonsConfig } from '../utils/seasonClient';
import { normalizeComparisonSeasons } from '../utils/seasonComparison';
import SeasonComparisonPicker from './SeasonComparisonPicker';
// Reuses PlayerPopup's popup shell + stat-section/stat-row classes
// (.popup-backdrop, .player-popup, .pp-header, .stat-section, .stat-row,
// etc) rather than duplicating them in a new stylesheet.
import '../views/PlayersView.css';

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

function TeamCompareSeasonCard({ label, row, isPending }) {
  return (
    <div className="stat-section">
      <div className="stat-section-header">
        <span className="stat-section-label">{label}</span>
      </div>
      <div className="stat-section-body">
        {isPending && (
          <div className="pp-no-stats">Data pending — check back soon.</div>
        )}
        {!isPending && !row && (
          <div className="pp-no-stats">Not yet available for this season.</div>
        )}
        {!isPending && row && METRICS.map(m => <MetricRow key={m.key} label={m.label} value={row[m.key]} fmt={m.fmt} />)}
      </div>
    </div>
  );
}

// Generic team-level season-over-season comparison popup — one component
// for both leagues (per Session 64's "no PWHL-specific" mandate), same
// pattern as SeasonComparisonPicker itself. `teamValue` is a team abbr for
// NHL, a numeric team_id for PWHL — whatever fetchTeamSeasonsCompare /
// fetchPWHLTeamSeasonsCompare expect.
export default function TeamComparisonPopup({ league, teamValue, teamLabel, onClose }) {
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

  const rowBySeason = new Map((rows || []).map(r => [r.season, r]));

  // ── TEMPORARY interim mitigation (2026-07-18) ──────────────────────────
  // A manual KV override (config:season:nhl:override, NHL only -- verified
  // no equivalent PWHL override is active) currently forces GET
  // /config/seasons to report the *unstarted* 2026-27 season as "current."
  // The pipeline's fetch_standings_l10() doesn't validate that its own
  // resolved season matches the real seasonId embedded in the NHL API rows
  // it fetches -- so it's been upserting real, correct 2025-26 final
  // standings (wins/losses/points/games_played, tragic_number, clinched/
  // eliminated) under the 20262027 label. NHL team_seasons.season for the
  // "current" season can NOT be trusted right now.
  //
  // Deliberately NHL-only, not applied to PWHL: an earlier version of this
  // checked both leagues defensively ("the same failure mode could recur"),
  // but that's wrong today -- verified live that PWHL's real current season
  // (season_id 8, "2025-26") has correct, non-contaminated data, and
  // blanket-hiding it behind a false "pending" card actively broke a
  // working display. Re-scope to both leagues only if/when a PWHL override
  // is ever actually set.
  //
  // Remove this block once BOTH are done: (1) the NHL override is confirmed
  // removed / resolution is confirmed correct at the real season boundary,
  // and (2) fetch_standings_l10() in eyewall-pipeline validates each row's
  // real seasonId instead of blindly trusting the resolved NHL_SEASON
  // constant. Tracked as the immediate next priority, not deferred.
  const { data: liveSeasonsConfig } = useFetch(fetchSeasonsConfig, []);
  const currentSeasonValue = league === 'nhl' && liveSeasonsConfig?.nhl?.seasonId != null
    ? Number(liveSeasonsConfig.nhl.seasonId)
    : null;

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="player-popup" onClick={e => e.stopPropagation()}>
        <div className="pp-header">
          <div className="pp-identity">
            <div className="pp-name"><span className="pp-first">Compare Seasons</span></div>
            <div className="pp-birth">{teamLabel}</div>
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pp-body">
          <SeasonComparisonPicker
            league={league}
            selected={compareSeasons}
            onChange={setCompareSeasons}
            maxSelected={4}
          />
          {compareSeasons.length === 0 && (
            <div className="pp-no-stats">Select two or more seasons above to compare.</div>
          )}
          {loading && compareSeasons.length > 0 && (
            <div className="pp-no-stats">Loading…</div>
          )}
          {!loading && [...compareSeasons].sort((a, b) => b - a).map(season => (
            <TeamCompareSeasonCard
              key={season}
              label={labelFor(season)}
              row={rowBySeason.get(season)}
              isPending={currentSeasonValue != null && season === currentSeasonValue}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
