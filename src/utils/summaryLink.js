// utils/summaryLink.js
// `/?summary=2&game=2026020123` -- where tapping an end-of-period or final
// notification lands (eyewall-poller's summaryUrl()). The game view reads
// it and opens that period's summary, or the game's for `summary=game`.
//
// Reached from sw.js's notificationclick on the web, from
// useNotificationTaps on iOS, and from the bell's Recent alerts.
//
// `&team=MTL` says whose alert it was. A followed team's game isn't in the
// favorite's schedule, so / used to drop the link without a word; App.jsx's
// RootRoute now sends it to that game from that team's side
// (/game/:id?as=MTL, GuestGameView.jsx), which opens the summary the same way.

const MAX_PERIOD = 10; // regulation + any number of playoff OTs, generously

// { gameId: number, period: number | 'game' } or null for anything else.
export function parseSummaryLink(searchParams) {
  const rawPeriod = searchParams.get('summary');
  const gameId = Number(searchParams.get('game'));
  if (!rawPeriod || !Number.isInteger(gameId) || gameId <= 0) return null;
  const team = searchParams.get('team')?.toUpperCase();
  const withTeam = link => (team ? { ...link, team } : link);
  if (rawPeriod === 'game') return withTeam({ gameId, period: 'game' });
  const period = Number(rawPeriod);
  if (!Number.isInteger(period) || period < 1 || period > MAX_PERIOD) return null;
  return withTeam({ gameId, period });
}

// Where a link opens: the favorite's own view, or a followed team's game
// from that team's side.
export function summaryHref({ gameId, period, team }, favoriteAbbr) {
  const q = `summary=${encodeURIComponent(period)}&game=${gameId}`;
  return !team || team === favoriteAbbr ? `/?${q}` : `/game/${gameId}?as=${encodeURIComponent(team)}&${q}`;
}

// An alert's url with its team filled in from the alert itself (`NHL:MTL`),
// for alerts sent before eyewall-poller added `&team=`.
export function withAlertTeam(url, teamKey) {
  const [league, abbr] = String(teamKey || '').split(':');
  if (league !== 'NHL' || !abbr) return url;
  const u = new URL(url, 'https://eyewall.invalid');
  if (!parseSummaryLink(u.searchParams) || u.searchParams.has('team')) return url;
  u.searchParams.set('team', abbr);
  return `${u.pathname}${u.search}`;
}

// The same params with the link's taken out, once it's been handled.
export function withoutSummaryLink(searchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete('summary');
  next.delete('game');
  next.delete('team');
  return next;
}
