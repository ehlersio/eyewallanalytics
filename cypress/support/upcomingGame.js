// cypress/support/upcomingGame.js
// A fixture game moved to `daysAhead` days from now (7pm ET), still
// scheduled. Specs that stub a real schedule down to one game and open its
// preview need that game to be upcoming whenever the suite runs: with its
// real date, CAR's 2026-27 opener (2026-09-29) stopped being upcoming the
// day it was played, and probable-starters.cy.js/projected-lines.cy.js
// found no "Matchup breakdown" to open.
export function asUpcoming(game, daysAhead = 1) {
  const start = new Date(Date.now() + daysAhead * 86_400_000)
  start.setUTCHours(23, 0, 0, 0)
  return {
    ...game,
    gameState: 'FUT',
    gameScheduleState: 'OK',
    gameDate: start.toISOString().slice(0, 10),
    startTimeUTC: start.toISOString().replace('.000Z', 'Z'),
  }
}
