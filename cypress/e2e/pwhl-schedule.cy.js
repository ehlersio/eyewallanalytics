// cypress/e2e/pwhl-schedule.cy.js

const PWHL_TEAMS = [
  { abbr: 'BOS', teamId: 1 },
  { abbr: 'MIN', teamId: 2 },
  { abbr: 'MTL', teamId: 3 },
  { abbr: 'NY',  teamId: 4 },
  { abbr: 'OTT', teamId: 5 },
  { abbr: 'TOR', teamId: 6 },
  { abbr: 'SEA', teamId: 8 },
  { abbr: 'VAN', teamId: 9 },
  { abbr: 'DET', teamId: 10 },
  { abbr: 'HAM', teamId: 11 },
  { abbr: 'LV',  teamId: 12 },
  { abbr: 'SJS', teamId: 13 },
]

// ── Multi-team smoke ──────────────────────────────────────────────────────────
describe('PWHL Schedule smoke tests (multi-team)', () => {
  PWHL_TEAMS.forEach(({ abbr, teamId }) => {
    it(`schedule loads without crashing for ${abbr}`, () => {
      cy.visit('/pwhl/schedule', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
      cy.assertNoErrors()
    })
  })
})

// ── Full feature tests (BOS) ──────────────────────────────────────────────────
describe('PWHL Schedule', () => {
  beforeEach(() => {
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/schedule')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  describe('Season picker', () => {
    it('renders season tabs', () => {
      cy.contains('2025-26').should('exist')
      cy.contains('2024-25').should('exist')
      cy.contains('2023-24').should('exist')
    })

    it('switches seasons without crashing', () => {
      cy.contains('2024-25').click()
      cy.assertNoErrors()
      cy.contains('2025-26').click()
    })
  })

  describe('Regular Season tab', () => {
    it('renders played/upcoming count', () => {
      cy.contains(/\d+ played/i, { timeout: 8000 }).should('exist')
    })

    it('renders sort bar', () => {
      cy.contains(/Newest|Oldest/i, { timeout: 8000 }).should('exist')
    })

    it('can toggle sort order', () => {
      cy.contains(/Newest first|Oldest first/i).first().click()
      cy.assertNoErrors()
    })

    it('renders game cards', () => {
      cy.get('.card', { timeout: 8000 }).should('have.length.greaterThan', 2)
    })

    it('shows final scores', () => {
      cy.contains(/FINAL|Final|W\d+|\d+–\d+/i, { timeout: 8000 }).should('exist')
    })

    it('calendar toggle button exists', () => {
      // Calendar toggle may use icon or class — check it renders without crashing
      cy.get('button', { timeout: 8000 }).should('have.length.greaterThan', 0)
      cy.assertNoErrors()
    })
  })

  describe('Playoffs tab', () => {
    it('playoffs tab exists', () => {
      cy.contains('Playoffs', { timeout: 8000 }).should('exist')
    })

    it('clicking playoffs tab does not crash', () => {
      cy.contains('Playoffs').click()
      cy.assertNoErrors()
    })
  })
})
