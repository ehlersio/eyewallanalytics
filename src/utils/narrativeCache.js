// utils/narrativeCache.js
// The Worker caches each summary narrative it generates in KV, one per
// game, period and team -- every team that watches a game gets its own
// perspective. These keys must match the ones the Worker writes
// (eyewall-poller: nhl.js /summary/narrative, pwhl.js /pwhl/summary/narrative),
// abbr upper-cased as the Worker does; a key without the team never hits.
// They're read back through the Worker's plain /cache/:key route, which
// isn't rate-limited the way the narrative routes are.

const WORKER_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKER_URL
  : null;

// period: a period number or 'game'. No team abbr, no key -- the Worker
// files an abbr-less request under 'UNK', which no real view should read.
export function nhlNarrativeCacheKey(period, gameId, carAbbr) {
  if (period == null || !gameId || !carAbbr) return null;
  return `narrative:${period}:${gameId}:${String(carAbbr).toUpperCase()}`;
}

export function pwhlNarrativeCacheKey(period, gameId, carAbbr) {
  if (period == null || !gameId || !carAbbr) return null;
  return `pwhl:narrative:${period}:${gameId}:${String(carAbbr).toUpperCase()}`;
}

// { narrative, cardNarrative } from Worker KV, or null when nothing is
// cached (404) or the lookup fails.
export async function fetchCachedNarrative(key) {
  if (!WORKER_URL || !key) return null;
  try {
    const res = await fetch(`${WORKER_URL}/cache/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.narrative) return null;
    return { narrative: data.narrative, cardNarrative: data.cardNarrative || null };
  } catch { return null; }
}

// AHL/ECHL (eyewall-poller hockeytech.js /{league}/summary/narrative):
// filed by team id, not abbr, and by language (':fr'). The period segment
// is the Worker's narrativePeriodKey(): '1'-'3', then overtimes by their
// label -- period 4 is 'OT', 5 '2OT', 6 '3OT' (so period=4 and period=OT
// share a key) -- or 'game'. The shootout (7) has no narrative: null.
export function hockeyTechNarrativePeriodKey(period) {
  if (period === 'game') return 'game';
  const s = String(period ?? '').trim().toUpperCase();
  const ot = s.match(/^([2-9]?)OT$/);
  if (ot) return `${ot[1]}OT`;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n === 7 || n > 99) return null;
  if (n <= 3) return String(n);
  return n === 4 ? 'OT' : `${n - 3}OT`;
}

export function hockeyTechNarrativeCacheKey(leagueKey, period, gameId, teamId, locale = 'en') {
  const periodKey = hockeyTechNarrativePeriodKey(period);
  if (!leagueKey || !periodKey || !gameId || teamId == null) return null;
  return `${leagueKey}:narrative:${periodKey}:${gameId}:${teamId}${locale === 'fr' ? ':fr' : ''}`;
}
