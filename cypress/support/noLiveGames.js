// cypress/support/noLiveGames.js
// Keeps real games in progress out of the suite.
//
// The app decides a team has a live game from that team's schedule
// (nhlApi.js getLiveGame -> getAllGames: the Worker's KV copy,
// /cache/schedule%3A{TEAM}%3A{season}, then the NHL's club-schedule-season).
// When the default team (CAR) had a real game in progress -- the 2026-27
// opener, 2026-09-29 -- the shot map switched to live mode, hiding the
// season/game selector shot-map.cy.js and summary-link.cy.js drive, and the
// intermission period-summary popup covered the pages player-search.cy.js
// and player-comparison.cy.js click through: 14 failures on main and every
// PR, for as long as the game lasted.
//
// Every spec's real schedule responses pass through here with any LIVE/CRIT
// game relabeled FUT (not yet started), so the suite always sees the "no
// game in progress" state it was written for. Specs that want a live game
// use ?mockGame= (getLiveGame's DEV path forces gameState LIVE itself), and
// a spec's own cy.intercept of these routes takes precedence over this one.

const IN_PROGRESS = new Set(['LIVE', 'CRIT'])

export function withoutLiveGames(games) {
  if (!Array.isArray(games)) return games
  return games.map(g => (g && IN_PROGRESS.has(g.gameState) ? { ...g, gameState: 'FUT' } : g))
}

function relabel(res) {
  if (res.body && Array.isArray(res.body.games)) {
    res.body = { ...res.body, games: withoutLiveGames(res.body.games) }
  } else if (Array.isArray(res.body)) {
    res.body = withoutLiveGames(res.body)
  }
}

// req.on('before:response'), not req.continue(callback): a continue callback
// fails the test when the page navigates away before the response arrives
// ("the connection to the browser closed before a response was received"),
// which every spec that visits twice would hit.
export function interceptLiveGames() {
  // Worker KV copy (a bare games array), the NHL club schedule and the
  // Worker's /schedule route ({ games: [...] }).
  cy.intercept({ method: 'GET', url: /\/(cache\/schedule%3A|club-schedule-season\/|schedule\?team=)/ }, req => {
    req.on('before:response', relabel)
  })
}
