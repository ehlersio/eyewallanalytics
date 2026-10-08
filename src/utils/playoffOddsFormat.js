// utils/playoffOddsFormat.js
// Playoff-odds numbers as every league's card shows them (TeamView's NHL
// card, LeaguePlayoffOddsCard for PWHL/AHL/ECHL). Probabilities are 0-1
// fractions, as the routes return them.

// Odds lean mostly on last season's ratings before this many games
// (eyewall-pipeline's backtest: preseason odds barely beat a coin flip).
export const PLAYOFF_ODDS_EARLY_GP = 20;

// '64%', '<1%', '>99%' -- never a flat 0% or 100% for something that
// happened in some simulations but not all. '—' with no number.
export function formatOddsPct(p) {
  if (p == null) return '—';
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

// The PWHL/AHL/ECHL card (contract C10) from /{league}/playoff-odds:
// null when it shouldn't show (no run, or the route unavailable); else
// what to show. `formatKnown` false: the league's playoff format for the
// season isn't verified, so make_playoffs_pct is null and only projected
// points are shown. `gamesPlayed`: the team's GP in the odds' season, when
// the view knows it (no early-season note without it).
export function leagueOddsView(data, gamesPlayed = null) {
  const latest = data?.latest;
  if (!latest) return null;
  const formatKnown = latest.make_playoffs_pct != null;
  const history = (data.history || []).filter(h => h?.run_date);
  const trend = formatKnown
    ? history.filter(h => h.make_playoffs_pct != null).map(h => ({ value: h.make_playoffs_pct * 100 }))
    : history.filter(h => h.proj_points_p50 != null).map(h => ({ value: h.proj_points_p50 }));
  return {
    latest,
    formatKnown,
    showDivision: formatKnown && latest.win_division_pct != null,
    stale: !!data.stale,
    early: !data.stale && gamesPlayed != null && gamesPlayed < PLAYOFF_ODDS_EARLY_GP,
    trend: trend.length >= 2 ? trend : [],
  };
}
