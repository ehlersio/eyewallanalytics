// utils/hockeyTechBracket.js
// What the AHL/ECHL League › Bracket tab shows (contract C11), from the
// Worker's /{league}/bracket (HockeyTech's own bracket feed for a playoff
// season) and /{league}/bracket/projected ("if the playoffs started
// today", from the live division standings and the league's verified
// format). Both answer { format, rounds: [{ name, bestOf, series: [{ id,
// name, top: { teamId, seed, wins }, bottom, status, winnerTeamId?,
// games? }] }], byes?, reason?, source }.

// The playoff season to read for the current one: itself when it's a
// playoff season, else the playoffs paired with it (none paired yet: null).
export function currentPlayoffSeason(config) {
  const current = config.currentSeason;
  if (current == null) return null;
  return config.isPlayoffSeason(current) ? current : (config.playoffSeasonMap?.[current] ?? null);
}

const hasRounds = b => (b?.rounds || []).some(r => r.series?.length);

// { mode, bracket, reason }: 'real' -- this year's playoffs have series;
// 'projected' -- no playoffs yet, the standings projection; 'note' -- no
// projection, for a reason the Worker gives ('format-unverified': the
// league hasn't published this season's format; 'no-games': the season
// hasn't started); 'loading'; or 'none' (nothing to show: no tab).
export function bracketTabState(real, projected, loading) {
  if (hasRounds(real)) return { mode: 'real', bracket: real, reason: null };
  if (hasRounds(projected)) return { mode: 'projected', bracket: projected, reason: null };
  if (loading) return { mode: 'loading', bracket: null, reason: null };
  if (['format-unverified', 'no-games'].includes(projected?.reason)) return { mode: 'note', bracket: null, reason: projected.reason };
  return { mode: 'none', bracket: null, reason: null };
}

// Wins a series needs: from the round's best-of, else from the series
// itself (whoever has the most wins, at least 1 -- a feed round without a
// verified format).
export function winsNeeded(bestOf, series) {
  if (Number.isInteger(bestOf) && bestOf > 0) return Math.ceil(bestOf / 2);
  return Math.max(1, series?.top?.wins ?? 0, series?.bottom?.wins ?? 0);
}

// 'wins' | 'leads' | 'tied' and the score from the leader's side, for the
// card's line under a series that has started.
export function seriesStanding(series, need) {
  const a = series.top?.wins ?? 0, b = series.bottom?.wins ?? 0;
  const winner = series.winnerTeamId ?? (a >= need ? series.top?.teamId : b >= need ? series.bottom?.teamId : null);
  if (winner != null) {
    const topWon = winner === series.top?.teamId;
    return { kind: 'wins', teamId: winner, score: topWon ? `${a}–${b}` : `${b}–${a}` };
  }
  if (a !== b) return { kind: 'leads', teamId: a > b ? series.top?.teamId : series.bottom?.teamId, score: a > b ? `${a}–${b}` : `${b}–${a}` };
  return { kind: 'tied', teamId: null, score: `${a}–${b}` };
}

// 'OT', '2OT' or 'SO' from HockeyTech's game status ('Final OT', 'Final
// 2OT', 'Final SO'), else ''.
export function gameSuffix(status) {
  const m = String(status || '').match(/\b(\d?OT|SO)\b/i);
  return m ? m[1].toUpperCase() : '';
}
