// cypress/e2e/projected-lines.cy.js
// "Projected lines" block in the Scouting tab (2026-09), from the Worker's
// /projected-lines route (eyewall-pipeline's nightly projected_lines.py).
// The team schedule and /projected-lines are stubbed, same setup as
// probable-starters.cy.js: the real 2026-27 CAR schedule cut to its opener
// (2026020001 CAR-FLA). The route's own query/caching logic is covered by
// eyewall-poller's Vitest suite (nhl-routes.test.js, projectedLines.test.js).

const player = (id, name, pos, filled = false) => ({ id, name, pos, filled })

const PROJECTION = {
  team: 'CAR',
  basis: 'preseason',
  basisGameId: 2026010042,
  basisGames: 5,
  generatedAt: '2026-09-28T08:00:00Z',
  lines: [
    { rank: 1, players: [player(8480039, 'Andrei Svechnikov', 'L'), player(8478427, 'Sebastian Aho', 'C'), player(8481708, 'Seth Jarvis', 'R')] },
    { rank: 2, players: [player(8474581, 'Taylor Hall', 'L'), player(8482702, 'Logan Stankoven', 'C'), player(8484801, 'Jackson Blake', 'R', true)] },
  ],
  pairs: [
    { rank: 1, players: [player(8476958, 'Jaccob Slavin', 'D'), player(8479402, 'Jalen Chatfield', 'D')] },
  ],
}

function openScouting(projectedReply) {
  cy.fixture('schedule-car-2026-27.json').then(schedule => {
    const games = schedule.games.slice(0, 1)
    cy.intercept('GET', /\/cache\/schedule%3ACAR%3A\d{8}/, games).as('scheduleKv')
    cy.intercept('GET', '**/club-schedule-season/CAR/**', { ...schedule, games }).as('schedule')
  })
  cy.intercept('GET', '**/projected-lines?team=*', projectedReply).as('projected')
  cy.setTeam('CAR')
  cy.visit('/schedule')
  cy.contains('.gc-abbr', 'FLA', { timeout: 15000 }).should('exist')
  cy.contains('Matchup breakdown').first().click()
  cy.get('.md-tab').contains('Scouting').click()
  cy.wait('@projected')
}

describe('Scouting tab — Projected lines', () => {
  it('shows the projection above the season lines, with its basis, accuracy and fill-ins', () => {
    openScouting(PROJECTION)
    cy.get('.sc-projected-lines', { timeout: 15000 }).within(() => {
      cy.contains('CAR projected lines').should('exist')
      cy.get('.sc-projected-basis').should('contain', 'Based on 5 preseason games')
      cy.get('.sc-projected-accuracy').should('contain', 'opening nights')
      cy.get('.sc-projected-unit').should('have.length', 3)
      cy.get('.sc-projected-unit').first().should('contain', 'Line 1').and('contain', 'Sebastian Aho')
      cy.get('.sc-projected-filled').should('have.length', 1)
      cy.get('.sc-projected-unit').eq(1).find('.sc-projected-filled').should('contain', 'fill-in')
      cy.contains('Defence pairs').should('exist')
    })
    // renamed so the two blocks aren't confused (only when season lines exist)
    cy.get('.scouting-section-label').then($labels => {
      const text = [...$labels].map(el => el.innerText.toLowerCase())
      const projected = text.findIndex(t => t.includes('projected lines'))
      const mostUsed = text.findIndex(t => t.includes('most-used lines'))
      expect(projected).to.be.greaterThan(-1)
      if (mostUsed > -1) expect(mostUsed).to.be.greaterThan(projected)
    })
  })

  it('uses in-season copy for a last-game projection', () => {
    openScouting({ ...PROJECTION, basis: 'last_game', basisGameId: 2026020001, basisGames: 1 })
    cy.get('.sc-projected-basis', { timeout: 15000 }).should('contain', 'Based on the last game')
    cy.get('.sc-projected-accuracy').should('contain', 'last two seasons')
  })

  it('renders nothing when there is no projection yet', () => {
    openScouting({ team: 'CAR', basis: null, basisGameId: null, basisGames: null, generatedAt: null, lines: [], pairs: [] })
    cy.get('.scouting-wrap', { timeout: 15000 }).should('exist')
    cy.get('.sc-projected-lines').should('not.exist')
  })
})
