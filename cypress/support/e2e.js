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

// ── Team fixtures ─────────────────────────────────────────────
// cy.team()        — returns the default CAR fixture (backward compat)
// cy.team('VGK')   — returns the fixture for a specific team
// cy.teams()       — returns all 32 teams
// cy.fullTeams()   — returns only teams with full line data
Cypress.Commands.add('team', (abbr) => {
  return cy.fixture('teams').then(teams => {
    const match = abbr
      ? teams.find(t => t.abbr === abbr)
      : teams.find(t => t.abbr === 'CAR')
    if (!match) throw new Error(`No fixture found for team: ${abbr}`)
    return match
  })
})

Cypress.Commands.add('teams', () => cy.fixture('teams'))

Cypress.Commands.add('fullTeams', () =>
  cy.fixture('teams').then(teams => teams.filter(t => t.line1))
)

// ── Pre-set localStorage so TeamPicker never blocks tests ─────
// Uses CAR by default; individual tests can call setTeam() to switch
Cypress.Commands.add('setTeam', (abbr) => {
  cy.window().then(win => {
    win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr }))
  })
})

beforeEach(() => {
  cy.fixture('teams').then(teams => {
    const car = teams.find(t => t.abbr === 'CAR')
    cy.window().then(win => {
      win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr: car.abbr }))
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
