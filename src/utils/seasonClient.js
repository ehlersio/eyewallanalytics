// utils/seasonClient.js
//
// Single shared fetch for the Worker's /config/seasons endpoint, used by
// both teamConfig.js and pwhlConfig.js. Without this, a PWHL user hits the
// Worker twice on load — once when teamConfig.js's eager import in App.jsx
// runs, and again whenever pwhlConfig.js loads (inside a lazy PWHL route
// chunk, or inside SportContext — doesn't matter which, this doesn't need
// to know). The promise is memoized so whichever module asks first
// triggers the real fetch, and the other just gets the same in-flight
// promise instead of firing a second request.
//
// This is also now the ONE place WORKER_BASE is hardcoded, instead of a
// separate copy in each config file.

export const WORKER_BASE = 'https://eyewall-poller.billowing-queen-bf23.workers.dev';

let inFlight = null;

export function fetchSeasonsConfig() {
  if (!inFlight) {
    inFlight = fetch(`${WORKER_BASE}/config/seasons`)
      .then((res) => {
        if (!res.ok) throw new Error(`config/seasons ${res.status}`);
        return res.json();
      })
      .catch((e) => {
        // Reset on failure so a later caller gets a fresh retry instead of
        // being stuck with a permanently-rejected cached promise — e.g. if
        // teamConfig.js's fetch fails due to a transient network blip
        // before pwhlConfig.js even gets a chance to try.
        inFlight = null;
        throw e;
      });
  }
  return inFlight;
}

// Separate memoized fetch for /config/seasons/comparison (Session 64 —
// season-over-season comparison). Kept independent from fetchSeasonsConfig
// above rather than merged into one call: that endpoint answers "what's
// current," this one answers "what's comparable," and they're consumed by
// different things at different times (app-boot vs. opening a comparison
// picker) — no reason to force one to wait on the other.
let comparisonInFlight = null;

export function fetchComparisonSeasons() {
  if (!comparisonInFlight) {
    comparisonInFlight = fetch(`${WORKER_BASE}/config/seasons/comparison`)
      .then((res) => {
        if (!res.ok) throw new Error(`config/seasons/comparison ${res.status}`);
        return res.json();
      })
      .catch((e) => {
        comparisonInFlight = null;
        throw e;
      });
  }
  return comparisonInFlight;
}
