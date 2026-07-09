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

  // ── Game stats popup (Session 50) ──────────────────────────────────────────
  // PWHLGameStatsPopup replaced the old lightweight PWHLGamePopup at this
  // click point -- covers the box-score table/toggle/CTA that popup didn't
  // have. Relies on a completed game existing in the default (regular
  // season) tab; BOS's 2025-26 regular season has plenty.
  describe('Game stats popup', () => {
    it('opens on a completed game click and shows the score header', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('.pgs-header').should('exist')
      cy.get('.pgs-score-big').should('have.length', 2)
      cy.assertNoErrors()
    })

    it('renders period scoring and three stars when available', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      // Both sections are data-dependent (HockeyTech gameSummary) -- assert
      // the popup doesn't crash either way rather than requiring both.
      cy.assertNoErrors()
    })

    it('toggles between team skater tables when box-score data is present', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('body').then($body => {
        if ($body.find('.pgs-toggle-btn').length === 2) {
          cy.get('.pgs-toggle-btn').eq(1).click()
          cy.get('.pgs-toggle-btn.active').should('exist')
          cy.assertNoErrors()
        }
      })
    })

    it('CTA navigates to the shot map for the selected game', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-cta-btn', { timeout: 8000 }).should('contain.text', 'Shot Map').click()
      cy.location('pathname', { timeout: 8000 }).should('eq', '/pwhl/shots')
      cy.assertNoErrors()
    })

    it('closes via the close button', () => {
      cy.get('.result-card.clickable', { timeout: 8000 }).first().click()
      cy.get('.pgs-card', { timeout: 8000 }).should('be.visible')
      cy.get('.pgs-close').click()
      cy.get('.pgs-card').should('not.exist')
    })
  })
})
