// cypress/e2e/navigation.cy.js
// Verifies every route loads without crashing and the nav bar works.

describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.contains('EyeWall Analytics', { timeout: 10000 }).should('be.visible')
  })

  it('loads the home page (Shot Map)', () => {
    cy.url().should('include', '/')
    cy.get('.topbar').should('be.visible')
    cy.contains('Carolina Hurricanes').should('exist')
  })

  it('bottom nav renders all 5 tabs', () => {
    const tabs = ['Shot Map', 'Schedule', 'Players', 'Team', 'News']
    tabs.forEach(tab => {
      cy.contains(tab).should('exist')
    })
  })

  it('navigates to Schedule', () => {
    cy.contains('Schedule').click()
    cy.url().should('include', '/schedule')
    cy.get('body').should('not.contain', 'Error')
  })

  it('navigates to Players', () => {
    cy.contains('Players').click()
    cy.url().should('include', '/players')
    cy.get('body').should('not.contain', 'Error')
  })

  it('navigates to Team', () => {
    cy.contains('Team').click()
    cy.url().should('include', '/team')
    cy.get('body').should('not.contain', 'Error')
  })

  it('navigates to News', () => {
    cy.contains('News').click()
    cy.url().should('include', '/news')
    cy.get('body').should('not.contain', 'Error')
  })

  it('can navigate between all tabs without crashing', () => {
    const routes = ['/schedule', '/players', '/team', '/news', '/']
    routes.forEach(route => {
      cy.visit(route)
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.get('body').should('not.contain', 'Something went wrong')
    })
  })
})
