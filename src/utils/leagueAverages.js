// src/utils/leagueAverages.js
// League averages for the Team page's Advanced tab, computed from the NHL's
// own season totals for every team (stats API team reports: summary,
// realtime, powerplay, penaltykill) -- replacing a hardcoded table of
// "2024-25 approximations" (2026-10). Weighted the way the NHL computes the
// team numbers themselves: a league PP% is every PP goal over every PP
// opportunity, not the mean of 32 percentages; per-game averages are totals
// over team-games. Checked against 2025-26: these formulas reproduce each
// team's own powerPlayPct/NetPct, penaltyKillPct/NetPct exactly.
//
// Pure functions; nhlApi.js does the fetching.

const sum = (rows, f) => rows.reduce((t, r) => t + (Number(f(r)) || 0), 0);
const ratio = (a, b) => (b > 0 ? a / b : null);

// One team's shot attempts from the NHL realtime report:
//   CF = totalShotAttempts (shots + missed + own attempts blocked)
//   CF% = satPct, so CA = CF x (1 - satPct) / satPct
// (league-wide that CA matches CF to 0.01% -- checked 2025-26).
export function teamShotAttempts(realtime, gamesPlayed) {
  const cf = realtime?.totalShotAttempts;
  const satPct = realtime?.satPct;
  if (typeof cf !== 'number' || typeof satPct !== 'number' || satPct <= 0 || satPct >= 1 || !gamesPlayed) return null;
  const ca = (cf * (1 - satPct)) / satPct;
  return {
    corsiForPct: satPct,
    satFor: cf,
    satAgainst: ca,
    satForPerGame: cf / gamesPlayed,
    satAgainstPerGame: ca / gamesPlayed,
  };
}

/**
 * @param {{ summary: object[], realtime?: object[], powerplay?: object[], penaltykill?: object[] }} reports
 *   each the `data` rows of that NHL team report for one season + game type
 * @returns {object|null} null when there's no summary data
 */
export function leagueTeamAverages({ summary, realtime = [], powerplay = [], penaltykill = [] }) {
  if (!summary?.length) return null;
  const gp = sum(summary, r => r.gamesPlayed);
  if (!gp) return null;
  const sf = sum(summary, r => r.shotsForPerGame * r.gamesPlayed);
  const sa = sum(summary, r => r.shotsAgainstPerGame * r.gamesPlayed);
  const gf = sum(summary, r => r.goalsFor);
  const ga = sum(summary, r => r.goalsAgainst);
  const shPct = ratio(gf, sf);
  const svPct = sa > 0 ? 1 - ga / sa : null;

  const rtGp = sum(realtime, r => r.gamesPlayed);
  const attempts = realtime.map(r => teamShotAttempts(r, r.gamesPlayed)).filter(Boolean);
  const attemptsGp = sum(realtime.filter(r => teamShotAttempts(r, r.gamesPlayed)), r => r.gamesPlayed);

  const ppOpps = sum(powerplay, r => r.ppOpportunities);
  const timesSh = sum(penaltykill, r => r.timesShorthanded);

  return {
    teams: summary.length,
    gamesPlayed: gp,
    shotsForPerGame: sf / gp,
    shotsAgainstPerGame: sa / gp,
    goalsForPerGame: gf / gp,
    goalsAgainstPerGame: ga / gp,
    shPct,
    svPct,
    pdo: shPct != null && svPct != null ? (shPct + svPct) * 100 : null,
    blockedForPerGame: rtGp ? sum(realtime, r => r.blockedShots) / rtGp : null,
    blockedAgainstPerGame: rtGp ? sum(realtime, r => r.shotAttemptsBlocked) / rtGp : null,
    satForPerGame: attemptsGp ? sum(attempts, a => a.satFor) / attemptsGp : null,
    satAgainstPerGame: attemptsGp ? sum(attempts, a => a.satAgainst) / attemptsGp : null,
    ppPct: ratio(sum(powerplay, r => r.powerPlayGoalsFor), ppOpps),
    netPpPct: ratio(sum(powerplay, r => r.ppNetGoals), ppOpps),
    pkPct: timesSh > 0 ? 1 - sum(penaltykill, r => r.ppGoalsAgainst) / timesSh : null,
    netPkPct: ratio(sum(penaltykill, r => r.timesShorthanded - r.ppGoalsAgainst + r.shGoalsFor), timesSh),
  };
}
