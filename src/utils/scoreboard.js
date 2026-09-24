// utils/scoreboard.js
// Pure helpers behind the Scoreboard card (all 4 leagues). The Worker's
// /{league}/today routes return whichever day actually has games -- today
// when there are any, otherwise the next day that does -- so every game
// carries its own gameDate and the UI must not assume "today".

// 'YYYY-MM-DD' in the viewer's own timezone, for comparing against a
// game's gameDate (which the leagues keep as an Eastern calendar date).
export function localDateString(now = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 'today' | 'tomorrow' | 'date' — which label the day header should use.
// Anything past tomorrow is just its date; the caller formats it.
export function dayLabelKind(gameDate, now = new Date()) {
  if (!gameDate) return null;
  const today = localDateString(now);
  if (gameDate === today) return 'today';
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return gameDate === localDateString(tomorrow) ? 'tomorrow' : 'date';
}

// A game's start time in the viewer's timezone ("7:00 PM"). Only the NHL
// feed gives a real timestamp; HockeyTech leagues carry their own status
// text instead (statusDetail), which already reads as a start time.
export function startTimeLabel(game, locale = undefined) {
  if (!game?.startTimeUTC) return game?.statusDetail || null;
  const d = new Date(game.startTimeUTC);
  if (Number.isNaN(d.getTime())) return game.statusDetail || null;
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

// Ordinal period label: 1 -> '1st'. OT/SO come through periodType instead,
// so a 4th period in an OT game reads 'OT', not '4th'.
export function periodLabel(game) {
  if (game?.periodType && game.periodType !== 'REG') return game.periodType;
  const n = game?.period;
  if (!n) return null;
  if (n === 4) return 'OT';
  if (n >= 5) return 'SO';
  return ['1st', '2nd', '3rd'][n - 1] || `${n}`;
}

// The line under a live game's badge: "2nd · 12:34", "2nd INT", or just
// the period when the feed has no clock (every HockeyTech league).
export function liveDetail(game, intermissionWord = 'INT') {
  const period = periodLabel(game);
  if (!period) return game?.statusDetail || null;
  if (game.inIntermission) return `${period} ${intermissionWord}`;
  return game.clock ? `${period} · ${game.clock}` : period;
}

// Where a team's row goes: a live NHL game opens in the game view from
// that team's side (GuestGameView.jsx) without touching the favorite, and
// the favorite's own row opens the favorite's own view. null -- a plain,
// untappable row -- for other leagues (their game views don't take a guest
// team) and for any game that isn't live, where there'd be nothing to
// follow. `isNhlTeam` guards against a code ALL_TEAMS doesn't know.
export function teamRowHref(sport, game, code, favoriteAbbr, isNhlTeam) {
  if (sport !== 'nhl' || game?.status !== 'live' || !game.gameId || !isNhlTeam(code)) return null;
  return code === favoriteAbbr ? '/' : `/game/${game.gameId}?as=${encodeURIComponent(code)}`;
}
