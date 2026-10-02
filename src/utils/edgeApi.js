// src/utils/edgeApi.js
// One player's NHL EDGE tracking stats, via the Worker's
// /nhl/edge/(skater|goalie)/:playerId/:season/:gameType (eyewall-poller's
// edge.js) -- for the player Analytics tab.
//
// The Worker tells "no data" from "failed", and so does this:
//   200 -> { status: 'ok', data }
//   404 -> { status: 'none' }   the NHL has no EDGE numbers for this player,
//                              season and game type -- asking again won't help
//   anything else -> retried (a 502 is the NHL being down, a thrown fetch
//   the network), then thrown, so the caller shows nothing this time and a
//   fresh open of the player asks again.
// EDGE has no preseason (gameType 1) -- callers don't ask for it.

import { fetchWithRetry } from './retryFetch';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || null;

export const EDGE_RETRY_DELAYS_MS = [1000, 3000];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// GET a Worker /nhl/edge path with the rules above
async function fetchEdge(path, { workerUrl = WORKER_URL, delays = EDGE_RETRY_DELAYS_MS } = {}) {
  if (!workerUrl) return { status: 'none' };
  const url = `${workerUrl}${path}`;
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    try {
      const res = await fetchWithRetry(url);
      if (res.status === 404) return { status: 'none' };
      if (res.ok) {
        const data = await res.json();
        return data?.available ? { status: 'ok', data } : { status: 'none' };
      }
      lastError = new Error(`EDGE ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const validGameType = gt => gt === 2 || gt === 3;

export async function getPlayerEdge(kind, playerId, season, gameType, opts) {
  if (!playerId || !season || !validGameType(gameType)) return { status: 'none' };
  return fetchEdge(`/nhl/edge/${kind}/${playerId}/${season}/${gameType}`, opts);
}

// The NHL's EDGE top 10s (fastest skaters, hardest shots, distance, offensive-
// zone time) for the League view's leaders -- /nhl/edge/leaders.
export async function getEdgeLeaders(season, gameType = 2, opts) {
  if (!season || !validGameType(gameType)) return { status: 'none' };
  return fetchEdge(`/nhl/edge/leaders/${season}/${gameType}`, opts);
}
