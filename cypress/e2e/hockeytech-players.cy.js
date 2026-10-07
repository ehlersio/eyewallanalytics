// cypress/e2e/hockeytech-players.cy.js
// AHL/ECHL Players tab: the team roster and season stats.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team }) => {
  describe(`${label} Players`, () => {
    // HockeyTechPlayersView: roster grid, then the 2025-26 stats tables.
    it(`/${key}/players renders the ${team.abbr} roster and 2025-26 stats`, () => {
      visitAs(`/${key}/players`, key, team)
      cy.contains('h2', 'Roster', { timeout: DATA_TIMEOUT }).find(leagueLogo(key, team.abbr)).should('exist')
      cy.contains('.sec-label', 'Defencemen', { timeout: DATA_TIMEOUT }).should('exist')
      cy.get(`img[src*="leaguestat.com/${key}/"]`).should('have.length.at.least', 5)
      cy.contains('button', 'Stats').click()
      cy.contains('button', /^2025-26$/, { timeout: DATA_TIMEOUT }).click()
      cy.get('table tbody tr', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 10)
      cy.contains('button', /^Goalies$/).click()
      cy.contains('th', 'Goalie').should('exist')
      cy.get('table tbody tr').should('have.length.at.least', 1)
      assertNoLoadFailure()
    })
  })
})
