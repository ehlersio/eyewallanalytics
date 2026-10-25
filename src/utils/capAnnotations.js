// ─── Cap-hit annotations ─────────────────────────────────────
// Small contract facts next to a player's name outside the Cap tab: the
// call-up watch (is the prospect on a one-way or two-way deal, what does
// the injured NHL player cost) and the trade trees (what the traded
// player costs today). All from one league-wide payload, the Worker's
// GET /contracts/players (nhlApi.js getLeagueContractPlayers, memoized 15
// min and shared with League › Cap), indexed by NHL playerId here.
//
// A player with no row in the index gets no annotation at all: the
// dataset may lack the deal, or the player may be unsigned or retired,
// and nothing here tells those apart, so nothing is claimed. The figure
// is the CURRENT season's cap hit of the player's current contract, which
// for a trade years ago is not the deal he was traded on; the trade-tree
// label says "now".

import { isReported } from './capTable';

// /contracts/players payload -> Map(playerId -> row), rows with a contract only.
export function contractIndex(payload) {
  const map = new Map();
  for (const r of payload?.players || []) {
    if (r?.contractKey && r.playerId != null) map.set(Number(r.playerId), r);
  }
  return map;
}

// The facts a chip shows for one player, or null when the index has no
// row (or the row has no public figure and no one-way/two-way fact).
//   { capHit, twoWay: true | false | null, isELC, expiresAfter, yearsLeft, reported, team }
export function capFacts(index, playerId) {
  if (!index || playerId == null) return null;
  const r = index.get(Number(playerId));
  if (!r) return null;
  const twoWay = r.oneWay === true ? false : r.oneWay === false ? true : null;
  if (r.capHit == null && twoWay == null) return null;
  return {
    capHit: r.capHit ?? null,
    twoWay,
    isELC: r.contractType === 'ELC',
    expiresAfter: r.expiresAfter || null,
    yearsLeft: r.yearsLeft ?? null,
    reported: isReported(r),
    team: r.currentTeam || r.team || null,
  };
}
