// utils/playerSearch.js
// Fuzzy player search across NHL + PWHL, backed by the Worker's flat
// player index (GET /players-search-index — id/name/team/position/sport,
// ~1,600 players total). Small enough to ship once per session and match
// client-side via Fuse.js rather than round-tripping a query to Supabase
// per keystroke.

import Fuse from 'fuse.js';
import { cached, TTL } from './cache.js';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

// threshold 0.35 balances typo tolerance ("crosbey" -> Crosby, "matthws"
// -> Matthews) against precision — pushing it higher (0.45+) starts
// surfacing noisy unrelated results for short queries without actually
// fixing the harder cases (very short single-word surnames with a
// dropped letter, e.g. "makr" for Makar, don't reliably rank #1 at any
// threshold — real usage tends to type enough of the name, or first+last,
// which both match well; see SESSION handoff notes for the tested cases).
let fuse = null;
let indexedPlayers = null;

async function fetchSearchIndex() {
  if (!WORKER_URL) return [];
  try {
    const res = await fetch(`${WORKER_URL}/players-search-index`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`playerSearch ${res.status}: /players-search-index`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('playerSearch fetch error:', err.message);
    return [];
  }
}

/** Loads (and memoizes) the search index, (re)building the Fuse instance only when the underlying data actually changes. */
export async function loadPlayerSearchIndex() {
  const players = await cached('players-search-index', fetchSearchIndex, TTL.PLAYER_SEARCH_INDEX);
  if (players !== indexedPlayers) {
    fuse = new Fuse(players, {
      keys: ['name'],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    indexedPlayers = players;
  }
  return players;
}

/**
 * Fuzzy-search players by name across NHL + PWHL.
 * Returns up to `limit` {id, name, team, position, sport} results.
 */
export async function searchPlayers(query, limit = 8) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  await loadPlayerSearchIndex();
  if (!fuse) return [];
  return fuse.search(q, { limit }).map(r => r.item);
}
