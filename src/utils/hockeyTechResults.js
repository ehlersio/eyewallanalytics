// utils/hockeyTechResults.js
//
// AHL/ECHL game results from a team's side. Their game_log rows carry
// ended_in ('OT' | 'SO' | null) -- an overtime or shootout loss is worth a
// point and is not a regulation loss, so it's its own result ('OTL') in
// last-5 chips, streaks, L10 and points percentage. (These views used to
// count every non-win as a plain loss.)

// { won, result: 'W' | 'OTL' | 'L', endedIn, my, op } for one final game.
export function gameResultFor(g, teamId) {
  const isHome  = g.home_team_id === teamId;
  const my      = isHome ? g.home_score : g.away_score;
  const op      = isHome ? g.away_score : g.home_score;
  const endedIn = g.ended_in === 'OT' || g.ended_in === 'SO' ? g.ended_in : null;
  const won     = my > op;
  return { won, result: won ? 'W' : endedIn ? 'OTL' : 'L', endedIn, my, op };
}

// Current streak from results oldest-first: { type: 'W' | 'L' | 'OT', count },
// or null with no games. Consecutive OT/SO losses make an 'OT' streak, the
// NHL's streak code -- never part of a regulation-loss ('L') streak.
export function currentStreak(results) {
  if (!results?.length) return null;
  const code = (r) => (r === 'W' ? 'W' : r === 'OTL' ? 'OT' : 'L');
  const type = code(results[results.length - 1]);
  let count = 0;
  for (let i = results.length - 1; i >= 0 && code(results[i]) === type; i--) count++;
  return { type, count };
}

// Points percentage: 2 points a win, 1 an OT/SO loss, out of 2 a game.
// null with no games played.
export function pointsPct({ w = 0, otl = 0, gp = 0 }) {
  return gp > 0 ? (2 * w + otl) / (2 * gp) : null;
}

// Text color for a streak / STRK code: green for wins, amber for OT/SO
// losses, red for regulation losses.
export function streakColor(type) {
  return type === 'W' ? 'var(--green)' : type === 'OT' ? 'var(--amber)' : 'var(--red-bright)';
}
