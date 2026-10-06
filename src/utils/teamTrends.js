// utils/teamTrends.js
// Team > Trends (NHL): one team's finished games of ONE game type, and the
// quick stats drawn from them. Pure, so the record math is unit-tested
// against a real club-schedule-season response.
//
// Audit 2026-10-05 #8: the game log used to keep every finished game of the
// season, preseason included, and the quick stats always divided by 10. In
// CAR's first week (4 preseason games, then 1-1-1) that showed "Last 10
// games 4–6" and "Win % L10 40%". Preseason, regular season and playoffs
// are kept separate everywhere in the app; the quick stats now count only
// the games actually played.

const FINISHED = ['OFF', 'FINAL', 'F'];

// Finished games of `gameType` (2 regular season, 3 playoffs) for
// `teamAbbr`, the last `count` of them, oldest first. `games` is
// club-schedule-season's `games` array.
export function buildTeamGameLog(games, teamAbbr, gameType, count = 20) {
  return (games || [])
    .filter(g => g.gameType === gameType && FINISHED.includes(g.gameState))
    .sort((a, b) => (a.gameDate < b.gameDate ? 1 : a.gameDate > b.gameDate ? -1 : 0))
    .slice(0, count)
    .reverse()
    .map(g => {
      const home     = g.homeTeam?.abbrev === teamAbbr;
      const carScore = home ? (g.homeTeam?.score ?? 0) : (g.awayTeam?.score ?? 0);
      const oppScore = home ? (g.awayTeam?.score ?? 0) : (g.homeTeam?.score ?? 0);
      const opp      = home ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
      const won      = carScore > oppScore;
      // The schedule says how the game ended (REG/OT/SO); older payloads
      // without gameOutcome fall back to the last period played.
      const lastPeriod = g.gameOutcome?.lastPeriodType
        ?? (g.periodDescriptor?.number > 3 ? 'OT' : 'REG');
      // A playoff game lost in overtime is a loss: there's no OTL point.
      const ot       = !won && lastPeriod !== 'REG' && g.gameType !== 3;
      return {
        date:     g.gameDate,
        gameId:   g.id,
        opp,
        carScore,
        oppScore,
        home,
        won,
        ot,
        result:   won ? 'W' : (ot ? 'OTL' : 'L'),
        isPlayoff: g.gameType === 3,
      };
    });
}

// Record over the last `n` games of the log (fewer when fewer were played):
// { games, wins, losses, otLosses, winPct } -- winPct 0-100 over the games
// actually played, null with no games.
export function recentRecord(gameLog, n = 10) {
  const recent = (gameLog || []).slice(-n);
  const wins     = recent.filter(g => g.result === 'W').length;
  const otLosses = recent.filter(g => g.result === 'OTL').length;
  const losses   = recent.length - wins - otLosses;
  return {
    games: recent.length,
    wins,
    losses,
    otLosses,
    winPct: recent.length ? Math.round((wins / recent.length) * 100) : null,
  };
}

// Current streak the way the NHL standings give it: W, L (regulation) or
// OT (overtime/shootout losses). { code, count }, or null with no games.
export function currentStreak(gameLog) {
  const log = gameLog || [];
  if (!log.length) return null;
  const codeOf = g => (g.result === 'W' ? 'W' : g.result === 'OTL' ? 'OT' : 'L');
  const code = codeOf(log[log.length - 1]);
  let count = 0;
  for (let i = log.length - 1; i >= 0 && codeOf(log[i]) === code; i--) count++;
  return { code, count };
}
