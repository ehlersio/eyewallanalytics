// src/utils/retryFetch.js
// fetch() with a client-side time budget and one retry on a transient
// failure.
//
// Every *Api.js module here gives a Worker request 8 seconds and, on
// failure, hands its view a null that renders a terminal "Failed to
// load..." card with no way back. That budget is a guess about the
// network, not the server's answer: these routes are served from the
// Worker's KV in well under a second, and even a cold miss that falls
// through to Supabase measured 0.3-0.8s. So a timeout here means the
// request never got out -- a stalled connection, a dropped packet --
// which is exactly the kind of failure a second attempt fixes.
//
// Only a *thrown* fetch (timeout or network error) is retried. An HTTP
// error status is the server's real answer; asking again just repeats it.
export const FETCH_TIMEOUT_MS = 8000;
export const RETRY_DELAY_MS   = 400;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] per-attempt budget (not a total)
 * @param {number} [opts.retries]   extra attempts after the first
 * @param {number} [opts.delayMs]   pause between attempts
 * @param {object} [opts.init]      fetch init; its `signal` is replaced
 * @returns {Promise<Response>} resolves on any response, ok or not
 * @throws the last attempt's error when every attempt threw
 */
export async function fetchWithRetry(url, {
  timeoutMs = FETCH_TIMEOUT_MS,
  retries   = 1,
  delayMs   = RETRY_DELAY_MS,
  init      = {},
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastError;
}
