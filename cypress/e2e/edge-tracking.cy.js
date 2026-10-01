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
