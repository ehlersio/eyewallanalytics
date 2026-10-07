// utils/summaryList.js
// The period summaries a game view holds (usePeriodSummary for the NHL,
// usePWHLPeriodSummary for the PWHL), one per period, in period order.

// One game, whether its id came as a number or a string. No id is no game.
export const sameGame = (a, b) => a != null && b != null && String(a) === String(b);

// `list` with `summary` in its period's place -- unless `summary` is
// another game's than `gameId`, the game on screen now. Building one
// awaits the network (landing, the cached narrative), and a build started
// for the game shown before (the last final, while the game that just went
// live is still being looked up) can finish after the view has moved on.
// Filed into the new game's list, it showed in the bell as one of that
// game's summaries, never marked seen (2026-10-07, period-summary.cy.js).
export function withSummary(list, summary, gameId) {
  if (!sameGame(summary?.gameId, gameId)) return list;
  return [...list.filter(s => s.period !== summary.period), summary].sort((a, b) => a.period - b.period);
}
