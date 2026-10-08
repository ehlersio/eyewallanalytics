// cypress/e2e/hockeytech-bracket.cy.js
// AHL/ECHL League › Bracket (contract C11; HockeyTechBracketPanel.jsx).
// The Worker's real answers, saved 2026-10-08 in
// src/utils/__tests__/fixtures/hockeytech-bracket/, are replayed through
// stubs so the tab is the same every run:
//   - this year's playoffs: a 2027 playoff season is added to the league's
//     season list and its /bracket answers with the real 2026 bracket
//     (Calder Cup, season 92; Kelly Cup, season 76);
//   - before the playoffs: /bracket/projected, a made-up projection in its
//     shape, then its real answers today ('format-unverified' for the AHL,
//     'no-games' for the ECHL).

import { LEAGUES, visitAs } from '../support/hockeytech'

const FIXTURES = 'src/utils/__tests__/fixtures/hockeytech-bracket'
const CASES = {
  ahl:  { real: 'ahl-bracket-92', rounds: 5, first: 'First Round', label: '2026 Calder Cup Playoffs', projected: 'ahl-projected-94',
          reason: 'format-unverified', note: "the AHL hasn't published this season's playoff format",
          // HER's 2026 run: beat BRI 2-0, lost to LV (316) 1-3.
          mySeries: 'Division Semifinals', opp: 316, result: 'wins the series', playoffId: 95, startYear: 2027 },
  echl: { real: 'echl-bracket-76', rounds: 4, first: 'Division Semifinals', label: '2026 Kelly Cup Playoffs', projected: 'echl-projected-78',
          reason: 'no-games', note: "the ECHL season hasn't started",
          // ADK's 2026 run: lost the North semifinal to 82 in seven.
          mySeries: 'Division Semifinals', opp: 82, result: 'wins the series', playoffId: 81, startYear: 2027 },
}

LEAGUES.forEach(({ key, label, team }) => {
  const c = CASES[key]
  const workerUrl = Cypress.expose('WORKER_URL')

  // The league's real season list, with next spring's playoffs in it, so the
// current regular season has playoffs paired with it.
  const withPlayoffs = () => cy.request(`${workerUrl}/config/seasons/${key}-seasons`).then(({ body }) => {
    cy.intercept('GET', `${workerUrl}/config/seasons/${key}-seasons*`, [
      { seasonId: c.playoffId, seasonName: `${c.startYear} ${label === 'AHL' ? 'Calder' : 'Kelly'} Cup Playoffs`, seasonType: 'playoffs', startYear: c.startYear },
      ...body,
    ])
  })

  describe(`${label} League › Bracket`, () => {
    // No playoff series this year unless a test says otherwise.
    beforeEach(() => {
      cy.intercept('GET', `${workerUrl}/${key}/bracket?season=*`, { season: c.playoffId, format: null, rounds: [], source: 'feed' })
    })

    it('shows this year’s bracket: every round, the followed team’s series, and a series’ games', () => {
      withPlayoffs()
      cy.readFile(`${FIXTURES}/${c.real}.json`).then(real => {
        // Whichever playoffs the league's current season pairs with -- the
        // ECHL's current season is still 2025-26 until its opener.
        cy.intercept('GET', `${workerUrl}/${key}/bracket?season=*`, { ...real, season: c.playoffId }).as('bracket')
      })
      cy.intercept('GET', `${workerUrl}/${key}/bracket/projected*`, { rounds: [], reason: 'no-games' })
      visitAs(`/${key}/league`, key, team)
      cy.wait('@bracket', { timeout: DATA_TIMEOUT })
      cy.get('.league-tab').contains('Playoff bracket').click()

      cy.get('.hockeytech-bracket').should('contain', c.label).and('not.contain', 'If the playoffs started today')
      cy.get('.bkt-round-col').should('have.length', c.rounds)
      cy.get('.bkt-round-label').first().should('have.text', c.first)
      cy.get('.bkt-card--primary').should('have.length.at.least', 1)
      cy.contains('.bkt-round-col', c.mySeries).find('.bkt-card--primary').first().click()
      cy.get('.series-modal').should('contain', c.mySeries).and('contain', team.abbr).and('contain', c.result)
      cy.get('.series-modal__game-row').should('have.length.at.least', 4)
      cy.get('.series-modal .pp-close').click()
      cy.get('.series-modal').should('not.exist')
      cy.assertNoErrors()
    })

    it('projects the bracket from the standings before the playoffs', () => {
      cy.intercept('GET', `${workerUrl}/${key}/bracket/projected*`, {
        season: 1, source: 'standings',
        format: { label: c.label, bestOf: [7, 7, 7, 7], source: 'https://example.org' },
        rounds: [{ name: c.first, bestOf: 7, series: [
          { id: 'A-1v4', name: `A ${c.first}`, top: { teamId: team.teamId, seed: 1, wins: 0 }, bottom: { teamId: c.opp, seed: 4, wins: 0 }, status: 'scheduled' },
        ] }],
        byes: [{ teamId: c.opp, seed: 1, division: 'B' }],
      }).as('projected')
      visitAs(`/${key}/league`, key, team)
      cy.wait('@projected', { timeout: DATA_TIMEOUT })
      cy.get('.league-tab').contains('Playoff bracket').click()
      cy.get('.hockeytech-bracket').should('contain', 'If the playoffs started today')
      cy.get('.bkt-card--primary').should('contain', team.abbr).find('.bkt-seed').should('contain', '1')
      cy.get('.bkt-card--primary .bkt-dot').should('not.exist')
      cy.get('.hockeytech-bracket-byes').should('contain', 'First-round byes')
      cy.get('.bkt-card--clickable').should('not.exist')
    })

    it(`says why there's no projection yet (${c.reason})`, () => {
      cy.readFile(`${FIXTURES}/${c.projected}.json`).then(body => {
        cy.intercept('GET', `${workerUrl}/${key}/bracket/projected*`, body).as('projected')
      })
      visitAs(`/${key}/league`, key, team)
      cy.wait('@projected', { timeout: DATA_TIMEOUT })
      cy.get('.league-tab').contains('Playoff bracket').click()
      cy.get('.hockeytech-bracket-note').should('contain', c.note)
      cy.get('.bkt-card').should('not.exist')
    })

    it('offers no tab when neither route has anything', () => {
      cy.intercept('GET', `${workerUrl}/${key}/bracket/projected*`, { rounds: [], byes: [] }).as('projected')
      visitAs(`/${key}/league`, key, team)
      cy.wait('@projected', { timeout: DATA_TIMEOUT })
      cy.get('.league-tab').contains('Standings').should('exist')
      cy.get('.league-tab').contains('Playoff bracket').should('not.exist')
    })
  })
})
