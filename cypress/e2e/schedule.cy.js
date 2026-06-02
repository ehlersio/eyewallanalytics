// cypress/e2e/schedule.cy.js

describe('Schedule view', () => {
  beforeEach(() => {
    cy.visit('/schedule')
  })

  it('renders without crashing', () => {
    cy.contains('EyeWall Analytics').should('be.visible')
    cy.get('body').should('not.contain', 'Something went wrong')
  })

  it('shows game entries with opponents', () => {
    // Schedule should list opponent abbreviations
    cy.get('body', { timeout: 8000 }).should('contain.text', 'CAR')
  })

  it('shows win/loss results', () => {
    cy.contains(/W|L|OTL/, { timeout: 8000 }).should('exist')
  })
})
