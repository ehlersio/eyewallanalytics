// utils/hockeyTechLeaders.js
// Which goalies the AHL/ECHL League > Leaders GAA and SV% cards rank.
//
// A flat "5 GP" gate left both cards as empty headers for the first weeks
// of every season (2026-10-06: 57 AHL goalies, nobody past 2 GP). The gate
// now scales with the season: half the busiest goalie's games, at least 1
// and at most 5, so a goalie who has played qualifies on opening weekend
// and the full 5-game bar is back once the leaders reach 10.

export const GOALIE_LEADER_MAX_MIN_GP = 5;

export function goalieLeaderMinGp(goalies) {
  const maxGp = goalies.reduce((m, g) => Math.max(m, g.gp ?? 0), 0);
  return Math.max(1, Math.min(GOALIE_LEADER_MAX_MIN_GP, Math.floor(maxGp / 2)));
}

export function qualifiedGoalies(goalies) {
  const minGp = goalieLeaderMinGp(goalies);
  return goalies.filter(g => g.player_name && (g.gp ?? 0) >= minGp);
}
