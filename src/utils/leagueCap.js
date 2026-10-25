// ─── League › Cap table helpers ──────────────────────────────
// Pure shaping of GET /contracts/summary (nhlApi.js getLeagueCapSummary)
// for LeagueCapTable.jsx, kept out of the component so it is unit-tested.
//
// What the route gives, and what this table therefore is: every contract
// in the open nhl-contracts dataset that covers the season, grouped by the
// team that SIGNED it (`basis: 'signing_team'`; the dataset has no current
// team). A team's total so includes players it sent to the minors or has
// since traded, and runs above the roster cap hit the Team page shows
// from /contracts?team= (which follows the real roster). It is a table of
// commitments by signing team, not of cap space, and the bar is scaled to
// the league's largest total, not to the ceiling (several totals exceed
// the ceiling, which would read as "over the cap" when they are not).
//
// Arizona: deals signed as ARI that still run belong to Utah, which took
// over the Coyotes' contracts in 2024, so the ARI entry folds into UTA
// (flagged `includesArizona` for the footnote). Any other code that is not
// an NHL team stays as its own row, named by its code.

import { ALL_TEAMS } from './teamConfig';

const FOLD_INTO = { ARI: 'UTA' };

const emptyExpiring = () => ({ ufa: 0, rfa: 0, unknown: 0 });

function mergeEntry(into, entry) {
  into.contracts += entry.contracts || 0;
  into.withFigure += entry.withFigure || 0;
  into.capHitTotal += entry.capHitTotal || 0;
  into.offRoster += entry.offRoster || 0;
  // The Worker's dead cap and cap-space estimate (roster basis, eyewall-poller
  // #237); kept as given, null when unknown.
  if (entry.deadCap != null) into.deadCap = (into.deadCap || 0) + entry.deadCap;
  if (entry.estimate != null) into.estimate = (into.estimate || 0) + entry.estimate;
  for (const k of ['ufa', 'rfa', 'unknown']) into.expiring[k] += entry.expiring?.[k] || 0;
  return into;
}

// summary -> { season, asOf, basis, ceiling, rows, maxTotal, totals, unavailable }
// rows: [{ team, name, shortName, known, contracts, withFigure, capHitTotal,
//          offRoster, expiring, pctOfMax, pctOfCeiling, includesArizona, rank }],
// cap hit total descending; ties keep the Worker's order.
//
// Two bases (the Worker's `basis`): 'signing_team' (the default before
// eyewall-poller #236) sums the deals each team signed, and the bar is
// scaled to the largest total because several run above the ceiling;
// 'roster' sums each team's current NHL roster, the Team page's number,
// and the bar is the share of the ceiling (`barPct`), which is the
// comparison that basis supports. The roster rows carry rosterCount as
// `contracts`, rosterWithFigure as `withFigure`, rosterCapHit as
// `capHitTotal` and offRosterCount as `offRoster`, so the table reads one
// shape; `basis` says which.
export function buildLeagueCapTable(summary, fallbackCeiling = null) {
  const entries = Array.isArray(summary?.teams) ? summary.teams : [];
  const basis = summary?.basis === 'roster' ? 'roster' : 'signing_team';
  const byTeam = new Map();
  const folded = new Set();
  for (const raw of entries) {
    if (!raw?.team) continue;
    const entry = basis === 'roster'
      ? { team: raw.team, contracts: raw.rosterCount, withFigure: raw.rosterWithFigure, capHitTotal: raw.rosterCapHit, offRoster: raw.offRosterCount, expiring: raw.expiring,
          deadCap: raw.deadCap ?? null, estimate: raw.capSpaceEstimate ?? null }
      : raw;
    const code = FOLD_INTO[entry.team] || entry.team;
    if (code !== entry.team) folded.add(code);
    if (!byTeam.has(code)) {
      byTeam.set(code, { team: code, contracts: 0, withFigure: 0, capHitTotal: 0, offRoster: 0, expiring: emptyExpiring(), deadCap: null, estimate: null });
    }
    mergeEntry(byTeam.get(code), entry);
  }

  const ceiling = summary?.capLimits?.ceiling ?? fallbackCeiling ?? null;
  const maxTotal = Math.max(0, ...[...byTeam.values()].map(r => r.capHitTotal));
  const rows = [...byTeam.values()]
    .sort((a, b) => b.capHitTotal - a.capHitTotal)
    .map((r, i) => {
      const cfg = ALL_TEAMS.find(t => t.abbr === r.team);
      return {
        ...r,
        rank: i + 1,
        known: !!cfg,
        name: cfg?.displayName || r.team,
        shortName: cfg?.shortName || r.team,
        pctOfMax: maxTotal > 0 ? Math.round((r.capHitTotal / maxTotal) * 100) : 0,
        pctOfCeiling: ceiling > 0 ? Math.round((r.capHitTotal / ceiling) * 100) : null,
        includesArizona: folded.has(r.team),
      };
    })
    .map(r => ({ ...r, barPct: basis === 'roster' && r.pctOfCeiling != null ? Math.min(r.pctOfCeiling, 100) : r.pctOfMax }));

  const totals = rows.reduce((acc, r) => {
    acc.contracts += r.contracts;
    acc.withFigure += r.withFigure;
    acc.offRoster += r.offRoster;
    acc.expiring.ufa += r.expiring.ufa;
    acc.expiring.rfa += r.expiring.rfa;
    acc.expiring.unknown += r.expiring.unknown;
    return acc;
  }, { contracts: 0, withFigure: 0, offRoster: 0, expiring: emptyExpiring() });

  return {
    season: summary?.season || null,
    asOf: summary?.asOf || null,
    basis,
    teamsKnown: summary?.teamsKnown ?? null,
    // The estimate column is offered only when the Worker had the dead-cap table.
    hasEstimates: basis === 'roster' && summary?.deadCapKnown === true && rows.some(r => r.estimate != null),
    estimateNotes: Array.isArray(summary?.estimateNotes) ? summary.estimateNotes : [],
    ceiling,
    rows,
    maxTotal,
    totals,
    unavailable: !!summary?.unavailable || rows.length === 0,
  };
}

// `$125.4M` for the table's cap-hit column (one decimal, unlike the
// per-player `$9.75M` in capTable.js).
export function fmtCapTotal(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `$${(Number(amount) / 1_000_000).toFixed(1)}M`;
}
