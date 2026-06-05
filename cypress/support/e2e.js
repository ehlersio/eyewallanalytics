// cypress/support/e2e.js
// Runs before every test file.

// ── Console error tracking ────────────────────────────────────────────────
// Collect console errors so tests can assert no unexpected errors occurred.
// Excludes known benign warnings (React StrictMode double-invoke, hot reload noise).
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
    // Store for later assertion
    win.__cypressErrors = win.__cypressErrors || []
    win.__cypressErrors.push(msg)
  })
})

// ── Custom commands ───────────────────────────────────────────────────────

// Wait for the loading skeleton to disappear and real content to appear.
// Uses a generous timeout since NHL API + Supabase calls can be slow.
Cypress.Commands.add('waitForContent', (selector, options = {}) => {
  const timeout = options.timeout || 8000
  cy.get(selector, { timeout }).should('be.visible')
})

// Navigate to a route and wait for it to settle (no loading skeletons).
Cypress.Commands.add('goTo', (path) => {
  cy.visit(path)
  // Wait for the skeleton animation to clear (skeletons have this class)
  cy.get('.skeleton', { timeout: 500 }).should('not.exist').then(
    () => {},
    () => {} // Ignore if no skeletons — page may load instantly from cache
  )
})

// Click a bottom nav tab by its label text.
Cypress.Commands.add('navTo', (label) => {
  cy.get('nav').contains(label).click()
  cy.url().should('not.eq', 'about:blank')
})

// Assert no unexpected console errors occurred during the test.
Cypress.Commands.add('assertNoErrors', () => {
  cy.window().then(win => {
    const errors = win.__cypressErrors || []
    expect(errors, `Unexpected console errors: ${errors.join(', ')}`).to.have.length(0)
  })
})
