// cypress/support/e2e.js

const IGNORED_ERRORS = [
  /ResizeObserver loop/,
  /Non-passive event listener/,
  /\[hmr\]/,
  /Download the React DevTools/,
]

Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'error').callsFake((...args) => {
    const msg = args.join(' ')
    if (IGNORED_ERRORS.some(re => re.test(msg))) return
    win.__cypressErrors = win.__cypressErrors || []
    win.__cypressErrors.push(msg)
  })
})

// ── Team fixture ──────────────────────────────────────────────
// cy.team() returns the fixture. Use inside tests as:
//   cy.team().then(t => cy.contains(t.displayName))
Cypress.Commands.add('team', () => cy.fixture('team'))

// ── Pre-set localStorage so TeamPicker never blocks tests ─────
beforeEach(() => {
  cy.fixture('team').then(team => {
    cy.window().then(win => {
      win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: team.abbr }))
    })
  })
})

// ── Custom commands ───────────────────────────────────────────
Cypress.Commands.add('waitForContent', (selector, options = {}) => {
  cy.get(selector, { timeout: options.timeout || 8000 }).should('be.visible')
})

Cypress.Commands.add('goTo', (path) => {
  cy.visit(path)
  cy.get('.skeleton', { timeout: 500 }).should('not.exist').then(() => {}, () => {})
})

Cypress.Commands.add('navTo', (label) => {
  cy.get('nav').contains(label).click()
  cy.url().should('not.eq', 'about:blank')
})

Cypress.Commands.add('assertNoErrors', () => {
  cy.window().then(win => {
    const errors = win.__cypressErrors || []
    expect(errors, `Unexpected console errors: ${errors.join(', ')}`).to.have.length(0)
  })
})
