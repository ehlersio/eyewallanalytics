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
