// cypress/e2e/navigation.cy.js

// ── Multi-team smoke — all routes load for representative teams ───────────
describe('Navigation smoke tests (multi-team)', () => {
  const SAMPLE_TEAMS = ['CAR', 'VGK', 'TOR', 'CHI', 'BOS', 'EDM']

  SAMPLE_TEAMS.forEach(abbr => {
    it(`all routes load without crashing for ${abbr}`, () => {
      const routes = ['/', '/schedule', '/players', '/team', '/news']
      routes.forEach(path => {
        cy.visit(path, {
          onBeforeLoad(win) {
            win.localStorage.setItem('eyewall:team', JSON.stringify({ abbr }))
          },
        })
        cy.get('.topbar', { timeout: 10000 }).should('exist')
        cy.get('body').should('not.contain', 'Something went wrong')
        cy.assertNoErrors()
      })
    })
  })
})

// ── PWHL multi-team smoke ────────────────────────────────────────────────────
describe('PWHL Navigation smoke tests (multi-team)', () => {
  const PWHL_TEAMS = [
    { abbr: 'BOS', teamId: 1 },
    { abbr: 'MIN', teamId: 2 },
    { abbr: 'MTL', teamId: 3 },
    { abbr: 'NY',  teamId: 4 },
    { abbr: 'OTT', teamId: 5 },
    { abbr: 'TOR', teamId: 6 },
    { abbr: 'SEA', teamId: 8 },
    { abbr: 'VAN', teamId: 9 },
  ]

  PWHL_TEAMS.forEach(({ abbr, teamId }) => {
    it(`all PWHL routes load without crashing for ${abbr}`, () => {
      const routes = ['/pwhl/shots', '/pwhl/schedule', '/pwhl/players', '/pwhl/team', '/pwhl/league', '/pwhl/news', '/pwhl/dev']
      routes.forEach(path => {
        cy.visit(path, {
          onBeforeLoad(win) {
            win.localStorage.setItem('eyewall:sport', 'pwhl')
            win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
          },
        })
        cy.get('.topbar', { timeout: 10000 }).should('exist')
        cy.get('body').should('not.contain', 'Something went wrong')
        cy.assertNoErrors()
      })
    })
  })
})

describe('Navigation', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.contains('EyeWall Analytics', { timeout: 10000 }).should('be.visible')
  })

  it('loads the home page (Shot Map)', () => {
    cy.url().should('include', '/')
    cy.get('.topbar').should('be.visible')
    cy.contains('Hockey Intelligence').should('exist')
  })

  it('bottom nav renders all 5 tabs', () => {
    ['Shot Map', 'Schedule', 'Players', 'Team', 'News'].forEach(tab =>
      cy.contains(tab).should('exist')
    )
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
    ['/schedule', '/players', '/team', '/news', '/'].forEach(route => {
      cy.visit(route)
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.get('body').should('not.contain', 'Something went wrong')
    })
  })
})
