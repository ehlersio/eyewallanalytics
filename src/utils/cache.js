// ─── In-memory cache with TTL ─────────────────────────────────
// Survives tab navigation (module-level), cleared on page refresh.
// Deduplicates in-flight requests so two concurrent calls to the
// same key share one network request.

const store   = new Map(); // key → { value, expiresAt }
const inflight = new Map(); // key → Promise

// TTLs in milliseconds
export const TTL = {
  STANDINGS:     5 * 60_000,  // 5 min  — changes infrequently
  PLAYOFF_GAMES: 10 * 60_000, // 10 min — series results
  TEAM_STATS:    5 * 60_000,  // 5 min
  PLAYER_STATS:  10 * 60_000, // 10 min — per-player landing page
  RANKINGS:      15 * 60_000, // 15 min — league-wide leaderboards
  SCHEDULE:      10 * 60_000, // 10 min
  GAME_DATA:     2 * 60_000,  // 2 min  — live/recent boxscore
  ADVANCED:      10 * 60_000, // 10 min — team corsi/pp/pk
  SHORT:         60_000,      // 1 min  — live-ish data
  PLAYER_SEARCH_INDEX: 30 * 60_000, // 30 min — flat NHL+PWHL player list for search
};

/** Fetch with caching + in-flight deduplication.
 *  @param {string}   key    Cache key (should be URL or descriptive string)
 *  @param {function} fn     Async function that fetches data
 *  @param {number}   ttl    TTL in ms (use TTL constants above)
 */
export async function cached(key, fn, ttl = TTL.SCHEDULE) {
  // Return cached value if still fresh
  const hit = store.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;

  // Deduplicate concurrent requests for the same key
  if (inflight.has(key)) return inflight.get(key);

  const promise = fn().then(value => {
    store.set(key, { value, expiresAt: Date.now() + ttl });
    inflight.delete(key);
    return value;
  }).catch(err => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/** Manually invalidate a cache entry (e.g. after a mutation). */
export function invalidate(key) {
  store.delete(key);
  inflight.delete(key);
}

/** Clear everything (useful in dev). */
export function clearAll() {
  store.clear();
  inflight.clear();
}
