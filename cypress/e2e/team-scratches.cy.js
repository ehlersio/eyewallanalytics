// cypress/e2e/team-scratches.cy.js
// Scratches card on the Team page's Overview tab (2026-09). The Worker's
// /scratches route is stubbed with cy.intercept so the assertions don't
// depend on live data (and so both the "last season, unclassified" and the
// "classified" shapes can be exercised) -- the route's own query,
// fallback, and summary logic is covered by eyewall-poller's Vitest suite
// (scratches.test.js, nhl-routes.test.js). Works for whichever team the
// spec run has selected: the route is stubbed for any ?team=.

const player = (id, name, total, split = {}, last = '2026-04-07') => ({
  player_id: id, player_name: name, total,
  healthy: 0, injured: 0, suspended: 0, unknown: 0, ...split, last_date: last,
})

// Last season, before any classification existed -- totals only.
const STALE_UNCLASSIFIED = {
  team: 'CAR', season: 20252026, gameType: 2, stale: true, classified: false,
  games_with_scratches: 82,
  totals: { healthy: 0, injured: 0, suspended: 0, unknown: 104 },
  players: [
    player(1, 'Mike Reilly', 40, { unknown: 40 }),
    player(2, 'Jesperi Kotkaniemi', 36, { unknown: 36 }),
    player(3, 'Shayne Gostisbehere', 24, { unknown: 24 }, '2026-04-13'),
    player(4, 'Player Four', 4, { unknown: 4 }),
    player(5, 'Player Five', 4, { unknown: 4 }),
    player(6, 'Player Six', 3, { unknown: 3 }),
    player(7, 'Player Seven', 2, { unknown: 2 }),
    player(8, 'Player Eight', 1, { unknown: 1 }),
    player(9, 'Player Nine', 1, { unknown: 1 }),
  ],
}

// A classified current season.
const CLASSIFIED = {
  team: 'CAR', season: 20262027, gameType: 2, stale: false, classified: true,
  games_with_scratches: 3,
  totals: { healthy: 3, injured: 1, suspended: 0, unknown: 0 },
  players: [player(1, 'Mike Reilly', 3, { healthy: 2, injured: 1 }, '2026-10-14')],
}

describe('Team page Scratches card', () => {
  it('shows last season labeled as stale, totals only, top 8 with a show-all toggle', () => {
    cy.intercept('GET', '**/scratches?team=*', STALE_UNCLASSIFIED).as('scratches')
    cy.visit('/team')
    cy.wait('@scratches')
    cy.get('.scratches-card').should('exist').within(() => {
      cy.contains('Scratches').should('exist')
      cy.get('.scratches-stale').should('contain', '2025-26')
      cy.get('.scratches-row').should('have.length', 8)
      cy.get('.scratches-row').first().should('contain', 'Mike Reilly').and('contain', '40')
      cy.contains(/Healthy vs\. injured isn't known/).should('exist')
      cy.contains('H ').should('not.exist')
      cy.get('.scratches-toggle').should('contain', 'Show all 9').click()
      cy.get('.scratches-row').should('have.length', 9)
      cy.get('.scratches-toggle').should('contain', 'Show fewer')
    })
  })

  it('shows the healthy/injured split once scratches are classified', () => {
    cy.intercept('GET', '**/scratches?team=*', CLASSIFIED).as('scratches')
    cy.visit('/team')
    cy.wait('@scratches')
    cy.get('.scratches-card').within(() => {
      cy.get('.scratches-stale').should('not.exist')
      cy.get('.scratches-row').first().should('contain', 'H 2').and('contain', 'Inj 1').and('contain', '3')
      cy.contains(/isn't known/).should('not.exist')
    })
  })

  it('shows an empty state when no scratches are recorded', () => {
    cy.intercept('GET', '**/scratches?team=*', { ...CLASSIFIED, players: [], classified: false }).as('scratches')
    cy.visit('/team')
    cy.wait('@scratches')
    cy.get('.scratches-card').should('contain', 'No scratches recorded yet.')
  })

  it('shows an unavailable state when the Worker fails', () => {
    cy.intercept('GET', '**/scratches?team=*', { statusCode: 502, body: {} }).as('scratches')
    cy.visit('/team')
    cy.wait('@scratches')
    cy.get('.scratches-card').should('contain', "Scratch data isn't available right now.")
  })
})
