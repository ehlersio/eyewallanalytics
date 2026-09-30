// cypress/e2e/projected-lines.cy.js
// "Projected lines" block in the Scouting tab (2026-09), from the Worker's
// /projected-lines route (eyewall-pipeline's nightly projected_lines.py).
// The team schedule and /projected-lines are stubbed, same setup as
// probable-starters.cy.js: the real 2026-27 CAR schedule cut to its opener
// (2026020001 CAR-FLA). The route's own query/caching logic is covered by
// eyewall-poller's Vitest suite (nhl-routes.test.js, projectedLines.test.js).

import { asUpcoming } from '../support/upcomingGame'

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

// /team-lines rows: three of this season's lines and one carried over from
// last season to fill Line 4 (line_combinations.source).
const line = (rank, source, names) => ({
  unit_type: 'F', rank, source,
  name_a: names[0], name_b: names[1], name_c: names[2],
  pos_a: 'L', pos_b: 'C', pos_c: 'R', toi_secs: 3600, xgf_pct: 0.55,
})
const TEAM_LINES = [
  line(1, 'current', ['Andrei Svechnikov', 'Sebastian Aho', 'Seth Jarvis']),
  line(2, 'current', ['Taylor Hall', 'Logan Stankoven', 'Jackson Blake']),
  line(3, 'current', ['Nikolaj Ehlers', 'Jordan Staal', 'Jordan Martinook']),
  line(4, 'prior_season', ['William Carrier', 'Mark Jankowski', 'Eric Robinson']),
]

function openScouting(projectedReply, teamLines = TEAM_LINES) {
  cy.fixture('schedule-car-2026-27.json').then(schedule => {
    const games = schedule.games.slice(0, 1).map(g => asUpcoming(g))
    cy.intercept('GET', /\/cache\/schedule%3ACAR%3A\d{8}/, games).as('scheduleKv')
    cy.intercept('GET', '**/club-schedule-season/CAR/**', { ...schedule, games }).as('schedule')
  })
  cy.intercept('GET', '**/projected-lines?team=*', projectedReply).as('projected')
  cy.intercept('GET', '**/team-lines?*', teamLines).as('teamLines')
  cy.setTeam('CAR')
  cy.visit('/schedule')
  cy.contains('.gc-abbr', 'FLA', { timeout: 15000 }).should('exist')
  cy.contains('Matchup breakdown').first().click()
  cy.get('.md-tab').contains('Scouting').click()
  cy.wait('@projected')
}

describe('Scouting tab — Projected lines', () => {
  it('before the opener shows only the projection, with its basis, accuracy and fill-ins', () => {
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
    // No regular-season game yet: no "most-used lines this season" block,
    // even though /team-lines (or the static fallback) has units -- they'd
    // be last season's, not this season's. Waits for the lines response
    // first, so the block being absent isn't just "not loaded yet".
    cy.wait('@teamLines')
    cy.get('.scouting-section-label').should($labels => {
      const text = [...$labels].map(el => el.innerText.toLowerCase())
      expect(text.some(t => t.includes('projected lines'))).to.equal(true)
      expect(text.some(t => t.includes('most-used lines'))).to.equal(false)
    })
  })

  it('in season shows the projection above the season lines, tagging carried-over units', () => {
    openScouting({ ...PROJECTION, basis: 'last_game', basisGameId: 2026020001, basisGames: 1 })
    cy.get('.sc-projected-basis', { timeout: 15000 }).should('contain', 'Based on the last game')
    cy.get('.sc-projected-accuracy').should('contain', 'last two seasons')
    cy.wait('@teamLines').its('request.url').should('include', 'gameType=2')
    // .should, not .then: it retries until the lines block has rendered.
    cy.get('.scouting-section-label').should($labels => {
      const text = [...$labels].map(el => el.innerText.toLowerCase())
      const projected = text.findIndex(t => t.includes('projected lines'))
      const mostUsed = text.findIndex(t => t.includes('most-used lines'))
      expect(projected).to.be.greaterThan(-1)
      expect(mostUsed).to.be.greaterThan(projected)
    })
    cy.get('.sc-line-carried').should('have.length', 1).and('contain', 'Last season')
    cy.get('.sc-line-unit').not('.sc-projected-unit').eq(3).find('.sc-line-carried').should('exist')
  })

  it('renders nothing when there is no projection yet', () => {
    openScouting({ team: 'CAR', basis: null, basisGameId: null, basisGames: null, generatedAt: null, lines: [], pairs: [] })
    cy.get('.scouting-wrap', { timeout: 15000 }).should('exist')
    cy.get('.sc-projected-lines').should('not.exist')
  })
})
