// utils/hockeyTechPowerRankings.js
// AHL/ECHL power rankings (contract C12) as the app shows them, from the
// Worker's /{league}/power-rankings: the pipeline's nightly
// hockeytech_power_rankings.py ranks every team, so nothing is computed
// here beyond turning its rows into the table's and the share card's.
//
// A row's `components` (hockeytech_power_rankings.py team_components()):
//   gp, points, record 'W-L-OTL', pts_pct, l10 'W-L-OTL' | null,
//   l10_pts_pct, gd_pg, pp_pct, pk_pct, special_teams (fractions),
//   ranks { pts_pct, l10_pts_pct, gd_pg, special_teams, ... } (1 = best)
//   PWHL rows also carry cf_pct (Corsi for %, a fraction).
// A component the league doesn't have is null, never filled in. The PWHL
// League view's table reads the same rows (PWHLLeagueView).

// The pipeline's fixed weights for AHL/ECHL (its WEIGHTS: the PWHL's 35/20/
// 20/10 with Corsi's 15 dropped, scaled to 100). Shown in "How is this
// calculated?"; the ranking itself happens in the pipeline.
export const HOCKEYTECH_RANKING_WEIGHTS = [
  { key: 'pts_pct',       raw: 35 },
  { key: 'l10_pts_pct',   raw: 20 },
  { key: 'gd_pg',         raw: 20 },
  { key: 'special_teams', raw: 10 },
];

// '41.2%' and so on, from the raw weights.
export function rankingWeightLabels(weights = HOCKEYTECH_RANKING_WEIGHTS) {
  const total = weights.reduce((n, w) => n + w.raw, 0);
  return Object.fromEntries(weights.map(w => [w.key, `${((w.raw / total) * 100).toFixed(1)}%`]));
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function splitRecord(record) {
  const [wins, losses, otLosses] = String(record || '').split('-').map(n => parseInt(n, 10));
  return { wins: wins || 0, losses: losses || 0, otLosses: otLosses || 0 };
}

// The route's rows as the table and PowerRankingsCanvas take them, best
// first. `abbrOf(teamId)` names each team; a team it doesn't know keeps
// its id. Rows without a rank are dropped.
export function hockeyTechRankedRows(latest, abbrOf) {
  return (latest || [])
    .filter(r => Number.isInteger(r?.rank))
    .sort((a, b) => a.rank - b.rank)
    .map(r => {
      const c = r.components || {};
      const ranks = c.ranks || {};
      return {
        teamId:    r.team_id,
        abbr:      abbrOf(r.team_id) || String(r.team_id),
        rank:      r.rank,
        priorRank: Number.isInteger(r.prior_rank) ? r.prior_rank : null,
        score:     num(r.score),
        ...splitRecord(c.record),
        gp:        num(c.gp),
        ptsPct:    num(c.pts_pct) ?? 0,
        l10:       c.l10 || null,
        l10PtsPct: num(c.l10_pts_pct),
        gdPG:      num(c.gd_pg) ?? 0,
        spPct:     num(c.special_teams),
        cfPct:     num(c.cf_pct), // the PWHL's only (null for AHL/ECHL)
        leagueRanks: { pts: ranks.pts_pct ?? null, l10: ranks.l10_pts_pct ?? null, gd: ranks.gd_pg ?? null, sp: ranks.special_teams ?? null },
      };
    });
}

// Places moved since the run before: positive up, negative down, 0 the
// same, null with no earlier run.
export function rankMovement(rank, priorRank) {
  return priorRank == null || rank == null ? null : priorRank - rank;
}

// The route's history for the sparkline: [{ date, rank }], oldest first.
export function rankHistory(history) {
  return (history || []).filter(h => h?.run_date && Number.isInteger(h.rank)).map(h => ({ date: h.run_date, rank: h.rank }));
}

// The tab's state from the route's answer: 'loading' (none yet), 'rows'
// (something to show), 'unavailable' (the Worker couldn't read the tables:
// a note, not an empty table) or 'empty' (no run yet -- the tab is hidden).
export function rankingsState(data, loading) {
  if (loading && !data) return 'loading';
  if (data?.latest?.length) return 'rows';
  if (data?.unavailable) return 'unavailable';
  return 'empty';
}
