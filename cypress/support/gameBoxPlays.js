// cypress/support/gameBoxPlays.js
// Gives a real /{league}/game-box answer one goal and two penalty shots
// (contract C6's `goals`/`penaltyShots`), built from that answer's own
// skater and goalie rows -- the pipeline tables behind them are empty for
// most games until the owner's backfill, so the popups' Goals and Penalty
// shots sections would otherwise only show by chance. The browser cache is
// turned off around it: a cached box score never reaches the intercept.
export function withGameBoxPlays(urlGlob) {
  if (Cypress.isBrowser({ family: 'chromium' })) {
    cy.wrap(Cypress.automation('remote:debugger:protocol', { command: 'Network.setCacheDisabled', params: { cacheDisabled: true } }))
  }
  cy.intercept('GET', urlGlob, req => {
    req.on('before:response', res => {
      const skaters = res.body?.skaters || []
      const goalies = res.body?.goalies || []
      const [scorer, helper] = skaters
      const other = skaters.find(s => s.team_id !== scorer?.team_id)
      const goalie = goalies.find(g => g.team_id !== scorer?.team_id) || goalies[0]
      if (!scorer) return
      res.body = {
        ...res.body,
        goals: [{
          period: 2, time: '4:08', team_id: scorer.team_id, scorer_id: scorer.player_id, scorer_name: scorer.player_name,
          assist_ids: helper ? [helper.player_id] : [], plus_player_ids: [scorer.player_id], minus_player_ids: other ? [other.player_id] : [],
          strength: 'PP',
        }],
        penaltyShots: [
          { period: 3, time: '12:00', team_id: scorer.team_id, shooter_id: scorer.player_id, shooter_name: scorer.player_name, goalie_id: goalie?.player_id ?? null, result: 'miss' },
        ],
      }
    })
  }).as('gameBox')
}

export function restoreHttpCache() {
  if (Cypress.isBrowser({ family: 'chromium' })) {
    cy.wrap(Cypress.automation('remote:debugger:protocol', { command: 'Network.setCacheDisabled', params: { cacheDisabled: false } }))
  }
}
