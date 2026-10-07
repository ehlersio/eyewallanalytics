// utils/workerCache.js
// How a GET to the Worker uses the browser's HTTP cache.
//
// The Worker answers every GET with Cache-Control and a weak ETag (Phase 1,
// eyewall-poller): live routes (/today, /live, the in-season schedules)
// max-age=5, news 30 min, standings and box scores an hour. Requests used to
// send `cache: 'no-store'`, which threw all of that away and re-downloaded
// every response (audit 2026-10-06 §14). They now use the default mode, so
// a repeat inside max-age is served locally and an older copy is
// revalidated with If-None-Match (a 304, no body). Live polling still sees
// every change: it polls every 10-30 s against a 5 s max-age.
//
// A user's explicit "refresh" (and a retry after an empty answer) asks for
// `fresh`: `cache: 'no-cache'` always revalidates with the Worker, so it
// can't be handed the same 30-minute-old copy, but still costs only a 304
// when nothing changed.

export function workerFetchInit({ fresh = false } = {}) {
  return fresh ? { cache: 'no-cache' } : {};
}
