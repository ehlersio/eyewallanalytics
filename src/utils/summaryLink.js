// utils/summaryLink.js
// `/?summary=2&game=2026020123` -- where tapping an end-of-period or final
// notification lands (eyewall-poller's summaryUrl()). The game view reads
// it and opens that period's summary, or the game's for `summary=game`.
//
// Reached from sw.js's notificationclick on the web and from
// useNotificationTaps on iOS.

const MAX_PERIOD = 10; // regulation + any number of playoff OTs, generously

// { gameId: number, period: number | 'game' } or null for anything else.
export function parseSummaryLink(searchParams) {
  const rawPeriod = searchParams.get('summary');
  const gameId = Number(searchParams.get('game'));
  if (!rawPeriod || !Number.isInteger(gameId) || gameId <= 0) return null;
  if (rawPeriod === 'game') return { gameId, period: 'game' };
  const period = Number(rawPeriod);
  if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) return null;
  return { gameId, period };
}

// The same params with the link's taken out, once it's been handled.
export function withoutSummaryLink(searchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('summary');
  next.delete('game');
  return next;
}
