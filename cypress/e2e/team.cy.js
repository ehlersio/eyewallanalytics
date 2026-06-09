// cypress/e2e/team.cy.js

describe('Team view', () => {
  beforeEach(() => {
    cy.visit('/team')
    cy.contains('Carolina Hurricanes').should('be.visible')
  })

  // ── Tab navigation ─────────────────────────────────────────
  it('renders all 5 tab buttons', () => {
    const tabs = ['Overview', 'Advanced', 'Splits', 'Trends', 'Cap & Picks']
    tabs.forEach(tab => cy.contains(tab).should('be.visible'))
  })

  // ── Overview ───────────────────────────────────────────────
  describe('Overview tab', () => {
    it('shows season record', () => {
      // Record should appear inside the overview section, not just anywhere on page
      cy.contains('Season stats').should('be.visible')
      cy.contains(/\d+–\d+–\d+/).should('be.visible')
    })

    it('shows season stats with league ranks', () => {
      cy.contains('Season stats').should('be.visible')
      cy.contains(/Goals\/GP|GA\/GP|PP%|PK%/).should('be.visible')
      // Rank badge must show a number followed by an ordinal suffix —
      // guards against the r.rank bug where only "th" rendered with no number
      cy.get('.overview-stat-rank').first().then($el => {
        const text = $el.text().trim()
        // Should be e.g. "3rd", "12th", "1st" — number + suffix, not just "th"
        expect(text).to.match(/^\d+(st|nd|rd|th)$/)
      })
    })

    it('shows playoff bracket when in playoffs', () => {
      cy.get('body').then($body => {
        if ($body.text().includes('Playoffs')) {
          cy.contains('Playoffs').should('exist')
        }
      })
    })
  })

  // ── Advanced ───────────────────────────────────────────────
  describe('Advanced tab', () => {
    beforeEach(() => cy.contains('Advanced').click())

    it('renders possession stats', () => {
      cy.contains(/Corsi|CF%|Shot/i, { timeout: 8000 }).should('exist')
    })

    it('renders PDO section', () => {
      cy.contains('PDO', { timeout: 8000 }).should('exist')
    })

    it('renders power play stats', () => {
      cy.contains('Power Play', { timeout: 8000 }).should('exist')
    })

    it('renders penalty kill stats', () => {
      cy.contains('Penalty Kill', { timeout: 8000 }).should('exist')
    })

    it('reg/playoff toggle works when in playoffs', () => {
      cy.get('body').then($body => {
        if ($body.text().includes('Regular Season') && $body.text().includes('Playoffs')) {
          cy.contains('Playoffs').click()
          cy.contains('Regular Season').click()
        }
      })
    })
  })

  // ── Splits ─────────────────────────────────────────────────
  describe('Splits tab', () => {
    beforeEach(() => cy.contains('Splits').click())

    it('renders home vs away split', () => {
      cy.contains(/Home|Away/i, { timeout: 8000 }).should('exist')
    })

    it('shows record for both home and away', () => {
      cy.contains(/\d+–\d+/, { timeout: 8000 }).should('exist')
    })
  })

  // ── Trends ─────────────────────────────────────────────────
  describe('Trends tab', () => {
    beforeEach(() => {
      cy.contains('Trends').click()
    })

    it('renders quick stats cards', () => {
      cy.contains(/Current streak|W\d|L\d/i, { timeout: 8000 }).should('exist')
      cy.contains('Last 10 games', { timeout: 8000 }).should('exist')
    })

    it('renders result dots for last 20 games', () => {
      cy.contains(/Last \d+ games/i, { timeout: 8000 }).should('exist')
      cy.get('[class*="result-dot"]').should('have.length.greaterThan', 0)
    })

    it('renders rolling win% chart', () => {
      cy.contains(/Win %|Rolling.*win/i, { timeout: 8000 }).should('exist')
      cy.get('[class*="rolling-bar"]').should('have.length.greaterThan', 0)
    })

    it('renders goal differential chart', () => {
      cy.contains(/Goal differential/i, { timeout: 8000 }).should('exist')
    })

    it('renders score-first rate chart when data available', () => {
      cy.contains(/Score.first rate/i, { timeout: 12000 }).should('exist')
    })
  })

  // ── Cap & Picks ────────────────────────────────────────────
  describe('Cap & Picks tab', () => {
    beforeEach(() => cy.contains('Cap & Picks').click())

    it('renders salary cap bar', () => {
      cy.contains(/cap/i, { timeout: 8000 }).should('exist')
      cy.contains(/\$\d+M|\d+M/).should('exist')
    })

    it('renders contract table with player names', () => {
      // Check table structure — salary format and UFA/RFA status
      // Using Aho as a known long-term CAR contract anchor
      cy.contains('Aho', { timeout: 8000 }).should('exist')
      cy.contains(/UFA|RFA/).should('exist')
      // Salary values should be present in $X.XM format
      cy.contains(/\$\d+\.\d+M/).should('exist')
    })

    it('renders draft picks section', () => {
      // Label may say "Future Draft Picks Owned" or "Draft Picks"
      cy.contains(/Draft Picks/i, { timeout: 8000 }).should('exist')
      cy.contains(/1st|2nd|3rd/).should('exist')
    })
  })
})
