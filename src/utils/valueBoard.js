// ─── Contract-value leaderboard helpers ──────────────────────
// Pure shaping for League › Cap's contract-value board: every NHL skater
// and goalie scored with the same helpers the player popup uses
// (contractValue.js: points and WAR per $1M of cap hit for skaters, GSAX
// per $1M for goalies), from four league-wide payloads:
//   contracts  GET /contracts/players (nhlApi.js getLeagueContractPlayers)
//   skaters    NHL skater/summary rows (getLeagueSkaterSummary): points, GP
//   analytics  getPlayerAnalytics() map by playerId: war, gp
//   goalies    getGoalieAnalytics() map by playerId: gsax, gp
// Who is rated: players with a public cap hit, enough games this season
// (`minGp` for skaters, `minGpGoalies` for goalies, who start about half
// their team's games), and not on an ELC (contractValue() also returns
// null under the $1.2M floor and for ELCs, same as the popup). Under WAR_TIER_MIN_GP games
// the skater score is points-only (`method: 'points'`), as in the popup.
// Nothing here projects or invents a figure: a player without a cap hit or
// without the games is simply not rated, and `counts` says how many are.

import { contractValue, goalieContractValue, valueLabel, goalieValueLabel } from './contractValue';
import { warPer82 } from './warTier';
import { isReported } from './capTable';

export const VALUE_BOARD_MIN_GP = 10;
export const VALUE_BOARD_MIN_GP_GOALIES = 5;

const byId = (rows, key) => {
  const map = new Map();
  for (const r of rows || []) if (r?.[key] != null) map.set(Number(r[key]), r);
  return map;
};

const splitName = (full, last) => {
  const name = String(full || '').trim();
  if (!name) return { first: '', last: last || '' };
  if (last && name.endsWith(last)) return { first: name.slice(0, name.length - last.length).trim(), last };
  const i = name.lastIndexOf(' ');
  return i > 0 ? { first: name.slice(0, i), last: name.slice(i + 1) } : { first: '', last: name };
};

// A player object PlayerPopup accepts ({ id, firstName, lastName, teamAbbrev, positionCode }).
export function popupPlayer(row) {
  const { first, last } = splitName(row.name, row.lastName);
  return { id: row.playerId, firstName: { default: first }, lastName: { default: last }, teamAbbrev: row.team, positionCode: row.position };
}

export function buildValueBoard({ contracts, skaters, analytics, goalies, minGp = VALUE_BOARD_MIN_GP, minGpGoalies = VALUE_BOARD_MIN_GP_GOALIES } = {}) {
  const players = Array.isArray(contracts?.players) ? contracts.players : [];
  const skaterById = byId(skaters, 'playerId');
  const counts = { skaters: 0, skatersRated: 0, goalies: 0, goaliesRated: 0, noFigure: 0, elc: 0, underMinGp: 0 };

  const skaterRows = [];
  const goalieRows = [];
  for (const c of players) {
    const id = Number(c.playerId);
    const isELC = c.contractType === 'ELC';
    const stat = skaterById.get(id) || null;
    const g = goalies?.[String(id)] || null;
    const isGoalie = c.position === 'G' || (!stat && !!g);
    const base = {
      playerId: id,
      name: stat?.skaterFullName || c.name || '',
      lastName: stat?.lastName || null,
      team: c.currentTeam || stat?.teamAbbrevs?.split(',').pop() || c.team || null,
      position: c.position || stat?.positionCode || (isGoalie ? 'G' : null),
      capHit: c.capHit ?? null,
      isELC,
      reported: isReported(c),
      expiresAfter: c.expiresAfter || null,
      yearsLeft: c.yearsLeft ?? null,
    };

    if (isGoalie) {
      counts.goalies += 1;
      const gp = g?.gp ?? 0;
      if (base.capHit == null) { counts.noFigure += 1; continue; }
      if (isELC) { counts.elc += 1; continue; }
      if (gp < minGpGoalies) { counts.underMinGp += 1; continue; }
      const score = goalieContractValue(g?.gsax ?? null, gp, base.capHit, isELC);
      if (score == null) continue;
      counts.goaliesRated += 1;
      goalieRows.push({ ...base, gp, gsax: g.gsax, score, label: goalieValueLabel(score) });
      continue;
    }

    counts.skaters += 1;
    const gp = stat?.gamesPlayed ?? 0;
    if (base.capHit == null) { counts.noFigure += 1; continue; }
    if (isELC) { counts.elc += 1; continue; }
    if (!stat || gp < minGp) { counts.underMinGp += 1; continue; }
    const a = analytics?.[String(id)] || null;
    const war = warPer82(a?.war, a?.gp);
    const result = contractValue(stat.points ?? 0, gp, base.capHit, isELC, war);
    if (!result) continue;
    counts.skatersRated += 1;
    skaterRows.push({ ...base, gp, points: stat.points ?? 0, war: a?.war ?? null, score: result.score, method: result.method, label: valueLabel(result.score) });
  }

  const desc = (a, b) => b.score - a.score || (a.capHit ?? 0) - (b.capHit ?? 0) || a.playerId - b.playerId;
  skaterRows.sort(desc);
  goalieRows.sort(desc);
  skaterRows.forEach((r, i) => { r.rank = i + 1; });
  goalieRows.forEach((r, i) => { r.rank = i + 1; });

  return {
    season: contracts?.season || null,
    asOf: contracts?.asOf || null,
    minGp,
    minGpGoalies,
    skaters: skaterRows,
    goalies: goalieRows,
    counts,
    available: skaterRows.length > 0 || goalieRows.length > 0,
  };
}
