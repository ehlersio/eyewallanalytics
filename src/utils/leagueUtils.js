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

// ─── Standings streak ─────────────────────────────────────────────────────────

// The STRK cell: the NHL's own code -- W, L (regulation) or OT
// (overtime/shootout losses) -- and a tone for its colour. OT used to be
// folded into a red 'L' (FLA's 'OT 2' read 'L2' at 1-0-2, audit 2026-10-05
// #26). null when the row has no streak yet.
export function standingsStreak(entry) {
  if (!entry?.streakCode || !entry?.streakCount) return null;
  const code = entry.streakCode;
  const tone = code === 'W' ? 'win' : code === 'OT' ? 'ot' : 'loss';
  return { code, count: entry.streakCount, label: `${code}${entry.streakCount}`, tone };
}

// ─── Power Rankings ───────────────────────────────────────────────────────────

/**
 * Rank all 32 teams using five weighted, normalised components plus a
 * roster talent prior (WAR) that tapers off as the season progresses.
 *
 * Components (full season, alpha = 1.0):
 *   Points %       25%  — season-long win rate
 *   L10 points %   25%  — recent form (drives weekly movement)
 *   Goal diff/GP   20%  — scoring margin strength
 *   5v5 xGF%       20%  — true possession quality (MoneyPuck, nightly)
 *   Special teams  10%  — avg of PP% and PK% (NHL team/summary)
 *
 * Roster WAR blending (early season):
 *   alpha = min(maxGP / 20, 1.0) — reaches 1.0 by game 20
 *   rosterWeight = 0.15 * (1 - alpha) — tapers from 15% → 0%
 *   Other weights scale proportionally to fill the remaining 85%→100%.
 */
// Rankings wait until every team has played this many games -- the same
// rule as eyewall-pipeline's power_rankings.py (MIN_GAMES_TO_RANK). Before
// that every component ties for all 32 teams and the order is just the
// order standings arrive in (2026-09-28: 0 GP, a random top 10).
export const MIN_GAMES_TO_RANK = 3;

export function computePowerRankings(standings, xgData, specialTeams) {
  if (!standings?.length) return [];

  const maxGP = Math.max(...standings.map(t => t.gamesPlayed || 0));
  const alpha = Math.min(maxGP / 20, 1.0);
  const wWar  = 0.15 * (1 - alpha);
  const scale = 1 - wWar;

  const W = {
    pts: 0.25 * scale,
    l10: 0.25 * scale,
    gd:  0.20 * scale,
    xgf: 0.20 * scale,
    sp:  0.10 * scale,
    war: wWar,
  };

  const teams = standings.map(t => {
    const abbr = t.teamAbbrev?.default ?? t.teamAbbrev;
    const gp   = t.gamesPlayed || 1;

    const l10w  = t.l10Wins     ?? 0;
    const l10l  = t.l10Losses   ?? 0;
    const l10ot = t.l10OtLosses ?? 0;
    const l10gp = (l10w + l10l + l10ot) || 10;

    // PP%/PK% (0-1) from the NHL's team/summary (getTeamSpecialTeams):
    // standings carry neither, so this used to read 0 for every team and
    // the 10% Special Teams weight silently did nothing (audit 2026-10-05
    // #25). A team with no number gets null (a neutral 0.5 below, like a
    // missing xGF%), never 0.
    const ppPct = specialTeams?.[abbr]?.ppPct ?? null;
    const pkPct = specialTeams?.[abbr]?.pkPct ?? null;

    return {
      abbr,
      gp,
      wins:      t.wins     ?? 0,
      losses:    t.losses   ?? 0,
      otLosses:  t.otLosses ?? 0,
      ptsPct:    (t.points ?? 0) / (gp * 2),
      l10PtsPct: ((l10w * 2) + l10ot) / (l10gp * 2),
      gdPG:      ((t.goalFor ?? t.goalsFor ?? 0) - (t.goalAgainst ?? t.goalsAgainst ?? 0)) / gp,
      xgfPct:    xgData?.[abbr]?.xgfPct    ?? null,
      rosterWar: xgData?.[abbr]?.rosterWar ?? null,
      spPct:     ppPct != null && pkPct != null ? (ppPct + pkPct) / 2 : null,
      ppPct,
      pkPct,
      l10: `${l10w}-${l10l}-${l10ot}`,
    };
  });

  function normalise(key) {
    const vals  = teams.map(t => t[key]).filter(v => v != null);
    if (!vals.length) return () => 0.5;
    const min   = Math.min(...vals);
    const range = Math.max(...vals) - min || 1;
    return (v) => v == null ? 0.5 : (v - min) / range;
  }

  const normPts = normalise('ptsPct');
  const normL10 = normalise('l10PtsPct');
  const normGD  = normalise('gdPG');
  const normXGF = normalise('xgfPct');
  const normSP  = normalise('spPct');
  const normWar = normalise('rosterWar');

  // Per-component league rank for display (1 = best)
  // A team without the number has no rank for it (null), not last place.
  function leagueRank(key) {
    const sorted = teams.filter(t => t[key] != null).sort((a, b) => b[key] - a[key]);
    const map = {};
    sorted.forEach((t, i) => { map[t.abbr] = i + 1; });
    return map;
  }
  const rankPts = leagueRank('ptsPct');
  const rankL10 = leagueRank('l10PtsPct');
  const rankGD  = leagueRank('gdPG');
  const rankXGF = leagueRank('xgfPct');
  const rankSP  = leagueRank('spPct');

  return teams
    .map(t => ({
      ...t,
      score:
        normPts(t.ptsPct)    * W.pts +
        normL10(t.l10PtsPct) * W.l10 +
        normGD(t.gdPG)       * W.gd  +
        normXGF(t.xgfPct)    * W.xgf +
        normSP(t.spPct)      * W.sp  +
        normWar(t.rosterWar) * W.war,
      leagueRanks: {
        pts: rankPts[t.abbr],
        l10: rankL10[t.abbr],
        gd:  rankGD[t.abbr],
        xgf: rankXGF[t.abbr],
        sp:  rankSP[t.abbr],
      },
    }))
    .sort((a, b) => b.score - a.score)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}
