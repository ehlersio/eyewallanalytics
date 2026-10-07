// cypress/e2e/hockeytech-league.cy.js
// AHL/ECHL League tab: Scoreboard, standings by division, leaders and the player popup.
// Split from hockeytech-routes.cy.js (Phase 3); fixtures and helpers are in
// ../support/hockeytech.js.

import { LEAGUES, visitAs, leagueLogo, assertNoLoadFailure } from '../support/hockeytech'

LEAGUES.forEach(({ key, label, team, divisions }) => {
  describe(`${label} League`, () => {
    it(`/${key}/league renders the Scoreboard, then ${label} standings by division`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-view').should('exist')
      cy.get('.league-tab').eq(0).should('contain', 'Scoreboard')
      cy.get('.league-tab').contains('Standings').click()
      cy.get('.lv-div-card', { timeout: DATA_TIMEOUT }).should('have.length.at.least', 1)
      cy.get('.lv-div-card').first().invoke('text').then(text => {
        expect(divisions.some(d => text.startsWith(d)), `first division of ${text.slice(0, 20)}`).to.equal(true)
      })
      cy.get('.lv-div-card').find(leagueLogo(key, team.abbr)).should('exist')
      cy.get('.league-tab').contains('Leaders').click()
      cy.get('body', { timeout: DATA_TIMEOUT }).should($body => {
        const settled = $body.find('.lv-leaders-card').length > 0
          || /No leader data available/.test($body.text())
        expect(settled, 'leaders cards or the leaders empty state').to.equal(true)
      })
      assertNoLoadFailure()
    })

    // HockeyTechLeagueView's leader rows open the league's player popup.
    it(`/${key}/league leader rows open the ${label} player popup`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab').contains('Leaders').click()
      cy.get('.lv-leaders-row', { timeout: DATA_TIMEOUT }).first().then($row => {
        const name = $row.find('span').eq(1).text()
        cy.wrap($row).click()
        cy.get('.pp-last', { timeout: DATA_TIMEOUT }).should($last => {
          expect(name).to.contain($last.text())
        })
      })
      cy.get('.pp-tab').should('have.length.at.least', 2)
      assertNoLoadFailure()
    })

    // League rank badges (HockeyTechPlayerPopup, from the same
    // /league-players the Leaders cards use): the points leader is 1st by
    // points; the SV% leader 1st by SV%, with a GAA rank too.
    it(`/${key}/league leaders' popups show their league rank`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab').contains('Leaders').click()
      cy.contains('.lv-leaders-card', 'Points', { timeout: DATA_TIMEOUT }).find('.lv-leaders-row').first().click()
      cy.get('[data-testid="pp-rank-banner"]', { timeout: DATA_TIMEOUT })
        .should('contain', 'Ranked by points').and('contain', '1st').and('contain', 'League')
      cy.get('.popup-backdrop').click('topLeft', { force: true })
      cy.contains('.lv-leaders-card', 'Save percentage').find('.lv-leaders-row').first().click()
      cy.get('[data-testid="pp-rank-banner"]', { timeout: DATA_TIMEOUT })
        .should('contain', 'Ranked by SV%').and('contain', '1st').and('contain', 'Ranked by GAA')
      assertNoLoadFailure()
    })

    // Scorecard tab (Phase 3 B5): this device's graded predictions, from
    // the league's prediction store ('eyewall_<key>_predictions_v1');
    // the NHL scorecard's empty state while nothing is graded.
    it(`/${key}/league Scorecard tab shows this device's prediction record`, () => {
      visitAs(`/${key}/league`, key, team)
      cy.get('.league-tab').contains('Scorecard').click()
      cy.get('[data-testid="local-scorecard"]').should('contain', 'Your prediction record').and('contain', 'No scorecard yet.')

      cy.visit(`/${key}/league`, {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', key)
          win.localStorage.setItem(`eyewall:${key}_team`, JSON.stringify(team))
          win.localStorage.setItem(`eyewall_${key}_predictions_v1`, JSON.stringify([
            { gameId: 1, gameDate: '2026-10-10', opponent: 'OPA', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 2, teamActual: 4, oppActual: 2, teamWon: true, correct: true, scoreDiff: 1 },
            { gameId: 2, gameDate: '2026-10-12', opponent: 'OPB', predictedTeamWin: true, predictedTeamScore: 3, predictedOppScore: 3, teamActual: 1, oppActual: 2, teamWon: false, correct: false, scoreDiff: 3 },
            { gameId: 3, gameDate: '2026-10-15', opponent: 'OPC', predictedTeamWin: false, predictedTeamScore: 2, predictedOppScore: 3 },
          ]))
        },
      })
      cy.get('.league-tab', { timeout: 10000 }).contains('Scorecard').click()
      cy.get('[data-testid="local-scorecard"]')
        .should('contain', '50%').and('contain', '2 graded')
        .and('contain', 'vs OPB: predicted a win, final 1–2')
        .and('not.contain', 'OPC')
      cy.assertNoErrors()
    })
  })
})
