// cypress/e2e/hockeytech-team.cy.js
// AHL/ECHL Team tab: every tab of the team page renders.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team, teamName }) => {
  describe(`${label} Team`, () => {
    // HockeyTechTeamView: header, then every tab renders (Overview record,
    // Stats rows, Splits/Trends cards) with no load failure.
    it(`/${key}/team renders every ${team.abbr} tab`, () => {
      // TeamPicker stores the whole team config, display name included.
      // The stored team here is just { abbr, teamId }: the header falls back
      // to the config's displayName.
      visitAs(`/${key}/team`, key, team)
      cy.contains('h2', teamName, { timeout: DATA_TIMEOUT }).should('exist')
      cy.get('.team-view').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.records-row', { timeout: DATA_TIMEOUT }).should('contain', 'pts')
      cy.contains('.team-tab', 'Stats').click()
      cy.get('.adv-stat-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.contains('.team-tab', 'Splits').click()
      cy.get('.team-view .card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.contains('.team-tab', 'Trends').click()
      cy.get('.team-view .card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      assertNoLoadFailure()
    })
  })
})
