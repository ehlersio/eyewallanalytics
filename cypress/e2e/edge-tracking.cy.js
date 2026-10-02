// cypress/e2e/edge-tracking.cy.js
// NHL EDGE tracking on the player Analytics tab. The Worker's /nhl/edge is
// stubbed (fixtures/edge-skater.json: a real 82-GP response, McDavid
// 2025-26) so these don't depend on the NHL's EDGE feed or on the player's
// games played so far this season.

const openAnalytics = () => {
  cy.setTeam('CAR')
  cy.visit('/players')
  cy.contains('Forwards', { timeout: 15000 }).should('exist')
  cy.team('CAR').then(t => cy.contains(t.skater).first().click())
  cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).contains('Analytics').click()
}

describe('NHL EDGE tracking section', () => {
  it('shows headline values and percentile bars from the NHL', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { fixture: 'edge-skater.json' }).as('edge')
    openAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('82 GP')
      cy.contains('24.6 mph')
      cy.contains('Top speed')
      cy.contains('Bursts 20+ mph')
      cy.contains('100th')
      cy.contains('NHL EDGE')
    })
  })

  it('reads speeds and distances in metric once chosen', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { fixture: 'edge-skater.json' }).as('edge')
    cy.window().then(win => win.localStorage.setItem('eyewall:units', 'metric'))
    openAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.contains('39.6 km/h')
      cy.contains('16.9 km')
      cy.contains('Bursts 32+ km/h')
    })
  })

  it('shows nothing when the NHL has no EDGE data', () => {
    cy.intercept('GET', '**/nhl/edge/skater/**', { statusCode: 404, body: { available: false } }).as('edge')
    openAnalytics()
    cy.wait('@edge')
    cy.get('.pa-wrap, .pp-heatmap-empty', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="edge-tracking"]').should('not.exist')
  })
})

describe('Goalie shot-area map (Analytics tab)', () => {
  // fixtures/edge-goalie.json: a real 39-GP response (Blackwood 2025-26)
  // with the NHL's per-area numbers (`areas`).
  const openGoalieAnalytics = () => {
    cy.setTeam('CAR')
    cy.visit('/players')
    cy.contains('Goalies', { timeout: 15000 }).should('exist')
    cy.team('CAR').then(t => cy.contains(t.goalie).first().click())
    cy.get('.pp-tab', { timeout: DATA_TIMEOUT }).contains('Analytics').click()
  }

  it('shows save % by NHL shot area, colored by percentile, tappable', () => {
    cy.intercept('GET', '**/nhl/edge/goalie/**', { fixture: 'edge-goalie.json' }).as('edge')
    openGoalieAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"] [data-testid="goalie-area-map"]', { timeout: DATA_TIMEOUT }).within(() => {
      cy.get('path.rhr-area').should('have.length', 17)
      // Low Slot: 229 shots, .825, 61st percentile -> the middle color
      cy.get('path[data-area="Low Slot"]').should('have.attr', 'fill', '#fbbf24')
      // L Corner: 2 shots -- too few to color, however the NHL ranks it
      cy.get('path[data-area="L Corner"]').should('have.attr', 'fill', 'transparent')
      cy.get('path[data-area="Low Slot"]').click({ force: true })
      cy.contains('Low slot · 229 shots · .825 · 61st percentile')
      cy.get('path[data-area="L Corner"]').click({ force: true })
      cy.contains('too few to rate')
    })
  })

  it('leaves the map out when the NHL has no area data', () => {
    cy.fixture('edge-goalie.json').then(body => {
      cy.intercept('GET', '**/nhl/edge/goalie/**', { ...body, areas: null }).as('edge')
    })
    openGoalieAnalytics()
    cy.wait('@edge')
    cy.get('[data-testid="edge-tracking"]', { timeout: DATA_TIMEOUT }).should('exist')
    cy.get('[data-testid="goalie-area-map"]').should('not.exist')
  })
})

describe('Units setting', () => {
  it('follows the language until chosen, then keeps the choice', () => {
    cy.visit('/')
    cy.get('.notif-bell').click()
    cy.get('.settings-units-imperial').should('have.attr', 'aria-checked', 'true')
    cy.get('.settings-units-metric').click()
    cy.get('.settings-units-metric').should('have.attr', 'aria-checked', 'true')
    cy.window().then(win => {
      expect(win.localStorage.getItem('eyewall:units')).to.equal('metric')
    })
  })
})
