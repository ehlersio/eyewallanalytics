// src/utils/leagueUtils.js
// Pure grouping/sorting helpers for LeagueView.
// Extracted here so they can be unit-tested independently.

export function groupByDivision(entries) {
  const groups = {};
  for (const e of entries) {
    const div = e.divisionName;
    if (!groups[div]) groups[div] = { conf: e.conferenceName, rows: [] };
    groups[div].rows.push(e);
  }
  for (const g of Object.values(groups)) {
    g.rows.sort((a, b) => a.divisionSequence - b.divisionSequence);
  }
  return groups;
}

export function groupByConference(entries) {
  const groups = {};
  for (const e of entries) {
    const conf = e.conferenceName;
    if (!groups[conf]) groups[conf] = [];
    groups[conf].push(e);
  }
  for (const rows of Object.values(groups)) {
    rows.sort((a, b) => a.conferenceSequence - b.conferenceSequence);
  }
  return groups;
}

export function buildWildCard(entries) {
  const confs = {};
  for (const e of entries) {
    const conf = e.conferenceName;
    if (!confs[conf]) confs[conf] = { divLeaders: {}, wcPool: [] };
    if (e.divisionSequence <= 3) {
      if (!confs[conf].divLeaders[e.divisionName]) confs[conf].divLeaders[e.divisionName] = [];
      confs[conf].divLeaders[e.divisionName].push(e);
    } else {
      confs[conf].wcPool.push(e);
    }
  }
  for (const conf of Object.values(confs)) {
    conf.wcPool.sort((a, b) => a.wildcardSequence - b.wildcardSequence);
    for (const div of Object.values(conf.divLeaders)) {
      div.sort((a, b) => a.divisionSequence - b.divisionSequence);
    }
  }
  return confs;
}

// ── Playoff bracket ───────────────────────────────────────────
// Bracket shape BracketPanel renders: { east, west, final }, each side a
// list of { round, series: [series | null] } (null = a slot not decided
// yet), a series { top, bottom, topWins, bottomWins, topSeed?, bottomSeed?,
// topClinch?, bottomClinch? }.

// Series letters in /playoff-bracket/{year}: A-D the East's first round
// (A+B feed I, C+D feed J), E-H the West's (E+F -> K, G+H -> L), M and N the
// conference finals, O the Cup Final.
const EAST_LETTERS = { 1: ['A', 'B', 'C', 'D'], 2: ['I', 'J'], 3: ['M'] };
const WEST_LETTERS = { 1: ['E', 'F', 'G', 'H'], 2: ['K', 'L'], 3: ['N'] };

function bracketSeries(s) {
  if (!s?.topSeedTeam?.abbrev || !s?.bottomSeedTeam?.abbrev) return null;
  return {
    top: s.topSeedTeam.abbrev,
    bottom: s.bottomSeedTeam.abbrev,
    topWins: s.topSeedWins ?? 0,
    bottomWins: s.bottomSeedWins ?? 0,
    topSeed: s.topSeedRankAbbrev || null,
    bottomSeed: s.bottomSeedRankAbbrev || null,
  };
}

// The NHL's /playoff-bracket/{endYear} as a bracket, or null when it has no
// series (every season before its playoffs start: 200 with series: []).
export function parseNhlBracket(raw) {
  const all = Array.isArray(raw?.series) ? raw.series : [];
  if (!all.length) return null;
  const byLetter = Object.fromEntries(all.map(s => [s.seriesLetter, s]));
  const side = letters => [1, 2, 3].map(round => ({
    round,
    series: letters[round].map(l => bracketSeries(byLetter[l])),
  }));
  return { east: side(EAST_LETTERS), west: side(WEST_LETTERS), final: bracketSeries(byLetter.O) };
}

// "If the playoffs started today", from the NHL's standings: per
// conference, the top 3 of each division plus two wild cards. The division
// winner with the better conference rank plays WC2, the other WC1; 2nd
// plays 3rd in each division. Laid out the way /playoff-bracket orders it
// (Atlantic then Metropolitan, Central then Pacific), so the projection and
// the real bracket line up. The NHL's own sequences already apply its
// tiebreakers. null until every conference has a full field and at least
// one game has been played -- at 0 GP the order is just the feed's.
export function projectNhlBracket(entries) {
  if (!Array.isArray(entries) || !entries.some(e => e.gamesPlayed > 0)) return null;
  const abbr = e => e.teamAbbrev?.default ?? e.teamAbbrev;
  const team = (e, seed) => ({ abbr: abbr(e), seed, clinch: e.clinchIndicator || null });
  const pair = (a, b) => ({
    top: a.abbr, bottom: b.abbr, topWins: 0, bottomWins: 0,
    topSeed: a.seed, bottomSeed: b.seed, topClinch: a.clinch, bottomClinch: b.clinch,
  });

  const side = (conf, divOrder) => {
    const rows = entries.filter(e => e.conferenceAbbrev === conf);
    const divs = divOrder.map(d => rows
      .filter(e => e.divisionAbbrev === d)
      .sort((a, b) => a.divisionSequence - b.divisionSequence));
    if (divs.some(d => d.length < 3)) return null;
    const top3 = new Set(divs.flatMap(d => d.slice(0, 3)));
    const wc = rows.filter(e => !top3.has(e)).sort((a, b) => a.wildcardSequence - b.wildcardSequence);
    if (wc.length < 2) return null;
    const [w1, w2] = [team(wc[0], 'WC1'), team(wc[1], 'WC2')];
    // The better division winner (lower conferenceSequence) gets WC2.
    const firstDivBetter = divs[0][0].conferenceSequence < divs[1][0].conferenceSequence;
    const series = divs.flatMap((d, i) => {
      const winner = team(d[0], 'D1');
      const wildcard = (i === 0) === firstDivBetter ? w2 : w1;
      return [pair(winner, wildcard), pair(team(d[1], 'D2'), team(d[2], 'D3'))];
    });
    return [
      { round: 1, series },
      { round: 2, series: [null, null] },
      { round: 3, series: [null] },
    ];
  };

  const east = side('E', ['A', 'M']);
  const west = side('W', ['C', 'P']);
  if (!east || !west) return null;
  return { east, west, final: null, projected: true };
}
