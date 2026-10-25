// ─── Cap tab helpers ─────────────────────────────────────────
// Pure shaping of a GET /contracts payload (nhlApi.js getTeamContracts) for
// TeamView's CapTab, kept out of the component so the math is unit-tested:
// which rows are roster/off-roster, the roster cap hit against the ceiling,
// the official/reported provenance counts, and the row markers.
//
// Dataset tiers: A-C come from official sources (club release, NHL.com,
// ESPN wire) and carry `official: true`; D-E are reported figures (PuckPedia
// posts, archived CapFriendly) and are marked as such in the table.
// `expiryTypeDerived` means the UFA/RFA status was derived from the
// player's age rather than stated by a source; marked too.

import { CAP_CEILING } from './contractValue';

export const REPORTED_TIERS = new Set(['D', 'E']);

export const isReported = (row) => REPORTED_TIERS.has(row?.tier);

// `$9.75M`; null in, null out (the caller shows "no public figure").
export function fmtCapHit(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  return `$${(Number(amount) / 1_000_000).toFixed(2)}M`;
}

// Whole-percent share of the ceiling, null without both numbers.
export function capHitPct(capHit, ceiling) {
  if (capHit == null || !(ceiling > 0)) return null;
  return Math.round((capHit / ceiling) * 100);
}

// getRoster()'s payload ({ all: [...] } or the raw NHL groups) -> Map of
// playerId -> "First Last". The dataset's player_name sometimes carries a
// prefix ("Hurricanes.Andrei Svechnikov"), so roster rows prefer this name.
export function rosterNameMap(roster) {
  const map = new Map();
  const players = roster?.all
    || [...(roster?.forwards || []), ...(roster?.defensemen || []), ...(roster?.goalies || [])];
  for (const p of players) {
    if (!p?.id) continue;
    const name = [p.firstName?.default, p.lastName?.default].filter(Boolean).join(' ');
    if (name) map.set(Number(p.id), name);
  }
  return map;
}

// getRoster()'s payload -> Map of playerId -> { name, birthDate, position },
// for the free-agent class (ages) and anything else that wants more than
// the name. rosterNameMap() above stays the cheap name-only view.
export function rosterIndex(roster) {
  const map = new Map();
  const players = roster?.all
    || [...(roster?.forwards || []), ...(roster?.defensemen || []), ...(roster?.goalies || [])];
  for (const p of players) {
    if (!p?.id) continue;
    map.set(Number(p.id), {
      name: [p.firstName?.default, p.lastName?.default].filter(Boolean).join(' ') || null,
      birthDate: p.birthDate || null,
      position: p.positionCode || null,
    });
  }
  return map;
}

export function displayName(row, rosterNames = null) {
  return (row.onRoster && rosterNames?.get(Number(row.playerId))) || row.name || '';
}

// { official, reported } over the rows (every row counts once).
export function provenanceCounts(rows) {
  let official = 0;
  for (const r of rows || []) if (r.official) official += 1;
  return { official, reported: (rows || []).length - official };
}

// Everything CapTab renders, from the route payload and (optionally) the
// roster names. `fallbackCeiling` stands in when the Worker has no cap
// limits for the season (it then reads contractValue.js's live value).
export function buildCapTable(data, rosterNames = null, fallbackCeiling = CAP_CEILING) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const shaped = rows.map(r => ({
    ...r,
    displayName: displayName(r, rosterNames),
    reported: isReported(r),
    expiring: r.yearsLeft === 0,
  }));
  const rosterRows    = shaped.filter(r => r.onRoster);
  const offRosterRows = shaped.filter(r => !r.onRoster);
  const missing = Array.isArray(data?.missing) ? data.missing : [];

  const summary = data?.summary || {};
  const ceiling = summary.capLimits?.ceiling ?? fallbackCeiling ?? null;
  const rosterCapHit = summary.rosterCapHit
    ?? rosterRows.reduce((s, r) => s + (r.capHit ?? 0), 0);
  const expiring = {
    ufa: summary.expiring?.ufa ?? 0,
    rfa: summary.expiring?.rfa ?? 0,
    unknown: summary.expiring?.unknown ?? 0,
  };
  // Dead cap and the Worker's cap-space ESTIMATE (eyewall-poller #237):
  // ceiling - roster cap hit - retained salary and buyouts the dataset
  // knows. Null until the Worker has the table (`deadCapKnown`), and never
  // called cap space: LTIR, bonus overages and recapture are not in it.
  const deadCapKnown = data?.deadCapKnown === true && !!summary.deadCap;
  const deadCapRows = deadCapKnown && Array.isArray(data?.deadCap) ? data.deadCap : [];

  return {
    season: data?.season || null,
    asOf: data?.asOf || null,
    rosterRows,
    offRosterRows,
    missing,
    ceiling,
    rosterCapHit,
    capPct: capHitPct(rosterCapHit, ceiling),
    rosterCount: summary.rosterCount ?? rosterRows.length + missing.length,
    rosterWithFigure: summary.rosterWithFigure ?? rosterRows.filter(r => r.capHit != null).length,
    provenance: provenanceCounts(shaped),
    expiring,
    expiringTotal: expiring.ufa + expiring.rfa + expiring.unknown,
    hasDerived: shaped.some(r => r.expiryTypeDerived),
    hasReported: shaped.some(r => r.reported),
    deadCapKnown,
    deadCap: deadCapKnown ? summary.deadCap : null,
    deadCapRows,
    estimate: deadCapKnown ? (summary.capSpaceEstimate ?? null) : null,
    estimateNotes: deadCapKnown && Array.isArray(summary.estimateNotes) ? summary.estimateNotes : [],
  };
}
