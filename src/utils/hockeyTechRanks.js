// utils/hockeyTechRanks.js
// A PWHL/AHL/ECHL player's league ranks for the player popup's rank badges,
// from the Worker's /{league}/league-players (the League > Leaders data:
// every goalie, and the top 600 skaters by points -- a skater below that
// has no row, so no badge).
//
// Skaters rank by points; goalies by SV% and by GAA among the goalies the
// Leaders cards rank (qualifiedGoalies: the GP gate that scales with the
// season), so the popup and the Leaders tab never disagree. Ties share a
// rank (1, 2, 2, 4). Null when the player has no row -- the badges hide.

import { qualifiedGoalies } from './hockeyTechLeaders';

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// 1 + the number of rows strictly better than `value`.
function rankAmong(rows, value, field, higherIsBetter) {
  if (value == null) return null;
  let better = 0;
  for (const r of rows) {
    const v = num(r[field]);
    if (v != null && (higherIsBetter ? v > value : v < value)) better += 1;
  }
  return better + 1;
}

// { points } for a skater, { svPct, gaa } for a goalie (each a rank), or null.
export function playerLeagueRanks(leaguePlayers, playerId, isGoalie) {
  if (!leaguePlayers || playerId == null) return null;
  const id = Number(playerId);
  if (isGoalie) {
    const pool = qualifiedGoalies(leaguePlayers.goalies || []);
    const row = pool.find(g => Number(g.player_id) === id);
    if (!row) return null;
    const svPct = rankAmong(pool, num(row.sv_pct), 'sv_pct', true);
    const gaa = rankAmong(pool, num(row.gaa), 'gaa', false);
    return svPct || gaa ? { svPct, gaa } : null;
  }
  const skaters = leaguePlayers.skaters || [];
  const row = skaters.find(s => Number(s.player_id) === id);
  if (!row) return null;
  const points = rankAmong(skaters, num(row.points), 'points', true);
  return points ? { points } : null;
}
