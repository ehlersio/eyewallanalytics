// utils/summaryTeam.js
// The team a Worker game summary was written for: its own `team` field
// when it has one, else the side its isHome flag names -- every summary
// stored so far carries isHome and oppAbbr, both from that team's side.
// null when the summary doesn't fit this game (oppAbbr isn't the other
// team), so it's never shown under the wrong team.
export function summaryTeam(summary, game) {
  const home = game?.homeTeam?.abbrev, away = game?.awayTeam?.abbrev;
  if (!summary || !home || !away) return null;
  const team = summary.team ?? (summary.isHome === true ? home : summary.isHome === false ? away : null);
  if (team !== home && team !== away) return null;
  if (summary.oppAbbr && summary.oppAbbr !== (team === home ? away : home)) return null;
  return team;
}
