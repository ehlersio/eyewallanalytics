// cypress/e2e/hockeytech-team.cy.js
// AHL/ECHL Team tab: every tab of the team page renders.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team, teamName, upcoming }) => {
  describe(`${label} Team`, () => {
    // HockeyTechTeamView: header, then every tab renders (Overview record,
    // Stats rows, Splits/Trends cards) with no load failure. Before the
    // team's first game of a new season the view shows its newest season
    // with games instead (the next test), so the rows are real either way.
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

    // A team that hasn't played in the current season yet (ECHL ADK until
    // its 2026-27 opener on 2026-10-17) opens on its newest season with
    // games, labelled, rather than an empty Stats tab. The current season
    // is pinned to the fixture's 2026-27 and its schedule stubbed to one
    // unplayed game; the 2025-26 data is the Worker's own.
    it(`/${key}/team falls back to 2025-26 before ${team.abbr}'s first 2026-27 game`, () => {
      cy.intercept('GET', '**/config/seasons', req => {
        req.continue(res => {
          res.body[key] = { ...res.body[key], seasonId: upcoming.season_id, seasonType: 'regular' }
        })
      })
      cy.intercept('GET', `**/${key}/schedule?teamId=${team.teamId}&season=${upcoming.season_id}`,
        [{ ...upcoming, game_state: '7:00PM', home_score: null, away_score: null }])
      visitAs(`/${key}/team`, key, team)
      cy.get('[data-testid="hockeytech-team-season-note"]', { timeout: DATA_TIMEOUT })
        .should('contain', `${team.abbr} hasn't played a 2026-27 game yet`)
        .and('contain', 'showing 2025-26')
      cy.contains('.view-sub', '2025-26 season').should('exist')
      cy.get('.records-row', { timeout: DATA_TIMEOUT }).should('contain', 'pts')
      cy.contains('.team-tab', 'Stats').click()
      cy.get('.adv-stat-row', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      assertNoLoadFailure()
    })
  })
})
