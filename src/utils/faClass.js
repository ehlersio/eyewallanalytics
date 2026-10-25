// ─── Free-agent class helpers ────────────────────────────────
// Pure shaping of a GET /contracts payload (nhlApi.js getTeamContracts)
// into the team's free-agent class for the coming summer: every deal that
// ends after the season (`yearsLeft === 0`), grouped by the dataset's
// expiry type (UFA / RFA / unknown), roster players first. Rendered by
// components/FreeAgentClass.jsx inside TeamView's CapTab.
//
// The UFA/RFA split is the dataset's: stated by a source, or derived from
// the player's age under the CBA's rule (`expiryTypeDerived`, marked †).
// Deals the team signed for players off its roster (minors, loans) are
// part of the class too, listed after the roster players as "in the
// system". Ages come from the NHL roster (birthDate), so only roster
// players have one. Nothing here projects a qualifying offer or a
// market value.

import { isReported } from './capTable';

// '2026-27' -> 2027 (the summer the deals expire); null when unparseable.
export function summerYear(season) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(season || ''));
  if (!m) return null;
  const start = Number(m[1]);
  return Math.floor(start / 100) * 100 + Number(m[2]) + (Number(m[2]) < start % 100 ? 100 : 0);
}

// Whole years between a YYYY-MM-DD birth date and `on` (default today).
export function ageOn(birthDate, on = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < mo || (on.getMonth() + 1 === mo && on.getDate() < d)) age -= 1;
  return age >= 0 ? age : null;
}

const byRosterThenCapHit = (a, b) => {
  if (a.onRoster !== b.onRoster) return a.onRoster ? -1 : 1;
  if ((a.capHit == null) !== (b.capHit == null)) return a.capHit == null ? 1 : -1;
  return (b.capHit || 0) - (a.capHit || 0);
};

function shapeRow(r, rosterIndex, now) {
  const roster = rosterIndex?.get(Number(r.playerId)) || null;
  return {
    playerId: r.playerId,
    name: (r.onRoster && roster?.name) || r.name || '',
    position: r.position || roster?.position || null,
    capHit: r.capHit ?? null,
    onRoster: !!r.onRoster,
    expiryType: r.expiryType || null,
    expiryTypeDerived: !!r.expiryTypeDerived,
    reported: isReported(r),
    contractType: r.contractType || null,
    age: roster?.birthDate ? ageOn(roster.birthDate, now) : null,
  };
}

const countTypes = (rows) => rows.reduce((acc, r) => {
  if (r.expiryType === 'UFA') acc.ufa += 1;
  else if (r.expiryType === 'RFA') acc.rfa += 1;
  else acc.unknown += 1;
  return acc;
}, { ufa: 0, rfa: 0, unknown: 0 });

// data -> { season, summer, ufa, rfa, unknown, total, rosterTotal,
//           offRosterTotal, hasDerived, hasReported, nextSummer }
// ufa/rfa/unknown: shaped rows, roster first then cap hit descending;
// nextSummer: counts of the ROSTER deals ending a season later.
export function buildFaClass(data, rosterIndex = null, now = new Date()) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const expiring = rows.filter(r => r.yearsLeft === 0).map(r => shapeRow(r, rosterIndex, now)).sort(byRosterThenCapHit);
  const ufa = expiring.filter(r => r.expiryType === 'UFA');
  const rfa = expiring.filter(r => r.expiryType === 'RFA');
  const unknown = expiring.filter(r => r.expiryType !== 'UFA' && r.expiryType !== 'RFA');
  const rosterTotal = expiring.filter(r => r.onRoster).length;
  return {
    season: data?.season || null,
    summer: summerYear(data?.season),
    ufa,
    rfa,
    unknown,
    total: expiring.length,
    rosterTotal,
    offRosterTotal: expiring.length - rosterTotal,
    hasDerived: expiring.some(r => r.expiryTypeDerived),
    hasReported: expiring.some(r => r.reported),
    nextSummer: countTypes(rows.filter(r => r.yearsLeft === 1 && r.onRoster)),
  };
}
