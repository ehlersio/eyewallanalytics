// cypress/e2e/pwhl-league.cy.js

describe('PWHL League view', () => {
  beforeEach(() => {
    cy.setPWHLTeam('BOS')
    cy.visit('/pwhl/league')
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  describe('Season picker', () => {
    it('renders season tabs', () => {
      cy.contains('2025-26').should('exist')
      cy.contains('2024-25').should('exist')
      cy.contains('2023-24').should('exist')
    })

    it('switching seasons does not crash', () => {
      cy.contains('2024-25').click()
      cy.assertNoErrors()
      cy.contains('2025-26').click()
    })
  })

  describe('Tab bar', () => {
    it('renders all four tabs', () => {
      ['Standings', 'Playoff Bracket', 'Leaders', 'Power Rankings'].forEach(tab =>
        cy.contains(tab).should('exist')
      )
    })

    it('Draft tab exists', () => {
      cy.contains('Draft').should('exist')
    })
  })

  describe('Standings tab', () => {
    // Only the 8 established teams have a standings row today — DET/HAM/LV/SJS
    // (2026-27 expansion) haven't played a game yet, so the Worker's
    // /pwhl/standings response genuinely has no rows for them (confirmed
    // against the live endpoint, not a frontend bug). Assert both sides of
    // that boundary so this spec fails loudly the moment either changes.
    it('shows all established-season teams', () => {
      ['BOS', 'MIN', 'MTL', 'NY', 'OTT', 'TOR', 'SEA', 'VAN'].forEach(abbr =>
        cy.contains(abbr, { timeout: 8000 }).should('exist')
      )
    })

    it('does not yet show expansion teams (no games played)', () => {
      cy.contains('BOS', { timeout: 8000 }).should('exist') // wait for table to load first
      ;['DET', 'HAM', 'LV', 'SJS'].forEach(abbr => {
        cy.contains(abbr).should('not.exist')
      })
    })

    it('shows W–OTW–OTL–L column headers', () => {
      cy.contains('OTW', { timeout: 8000 }).should('exist')
      cy.contains('OTL').should('exist')
    })

    it('shows PTS column', () => {
      cy.contains('PTS', { timeout: 8000 }).should('exist')
    })

    it('shows L10 column', () => {
      cy.contains('L10', { timeout: 8000 }).should('exist')
    })

    it('shows STRK column', () => {
      cy.contains('STRK', { timeout: 8000 }).should('exist')
    })

    it('columns are sortable', () => {
      cy.contains('PTS').click()
      cy.assertNoErrors()
      cy.contains('GF').click()
      cy.assertNoErrors()
    })

    it('shows 3-2-1-0 points system note', () => {
      cy.contains(/3-2-1-0/i, { timeout: 8000 }).should('exist')
    })
  })

  describe('Playoff Bracket tab', () => {
    beforeEach(() => cy.contains('Playoff Bracket').click())

    it('renders without crashing', () => {
      cy.assertNoErrors()
    })

    it('shows Semifinals label', () => {
      cy.contains('Semifinals', { timeout: 8000 }).should('exist')
    })

    it('shows Walter Cup Final label', () => {
      cy.contains('Walter Cup Final', { timeout: 8000 }).should('exist')
    })

    it('series cards are clickable and show modal', () => {
      cy.get('.bkt-card--clickable', { timeout: 8000 }).first().then($card => {
        if ($card.length) {
          cy.wrap($card).click()
          cy.get('.series-modal', { timeout: 6000 }).should('exist')
          cy.get('.pp-close').click()
          cy.get('.series-modal').should('not.exist')
        }
      })
    })
  })

  describe('Leaders tab', () => {
    beforeEach(() => cy.contains('Leaders').click())

    it('renders without crashing', () => {
      cy.assertNoErrors()
    })

    it('shows Points leaders card', () => {
      cy.contains('Points', { timeout: 8000 }).should('exist')
    })

    it('shows Goals leaders card', () => {
      cy.contains('Goals', { timeout: 8000 }).should('exist')
    })

    it('shows GAA leaders card', () => {
      cy.contains(/Goals Against Avg|GAA/i, { timeout: 8000 }).should('exist')
    })

    it('shows SV% leaders card', () => {
      cy.contains(/Save Percentage|SV%/i, { timeout: 8000 }).should('exist')
    })

    it('clicking a leader opens player popup', () => {
      cy.get('.lv-leaders-row--clickable', { timeout: 10000 }).first().click()
      cy.get('.player-popup', { timeout: 6000 }).should('exist')
      cy.get('.pp-close').click()
      cy.get('.player-popup').should('not.exist')
    })
  })

  describe('Power Rankings tab', () => {
    beforeEach(() => cy.contains('Power Rankings').click())

    it('renders without crashing', () => {
      cy.assertNoErrors()
    })

    // Power rankings are derived from the same standings feed as the
    // Standings tab, so they share the same established-teams-only boundary
    // until DET/HAM/LV/SJS have played games (see Standings tab note above).
    it('shows all established-season teams ranked', () => {
      // cy.get(...).should(...) retries until it passes or times out, unlike
      // a raw expect() on a one-time $body snapshot -- the snapshot version
      // flaked in production CI when the page hadn't finished rendering the
      // instant .then() fired (Session: Dependabot audit investigation).
      ['BOS', 'MIN', 'MTL', 'NY', 'OTT', 'TOR', 'SEA', 'VAN'].forEach(abbr => {
        cy.get('body').should('contain', abbr)
      })
    })

    it('does not yet rank expansion teams (no games played)', () => {
      ['DET', 'HAM', 'LV', 'SJS'].forEach(abbr => {
        cy.get('body', { timeout: 8000 }).should('not.contain', abbr)
      })
    })

    it('shows How is this calculated? toggle', () => {
      cy.contains(/How is this calculated/i, { timeout: 8000 }).should('exist')
    })

    it('expanding How calculated shows formula', () => {
      cy.contains(/How is this calculated/i).click()
      cy.contains('Pts%', { timeout: 6000 }).should('exist')
      cy.contains('CF%').should('exist')
    })

    it('shows CF% column', () => {
      cy.contains('CF%', { timeout: 8000 }).should('exist')
    })
  })

  describe('Draft tab', () => {
    beforeEach(() => cy.contains('Draft').click())

    it('renders without crashing', () => {
      cy.assertNoErrors()
    })

    it('shows 2026 Draft by default', () => {
      cy.contains('2026 Draft', { timeout: 8000 }).should('exist')
    })

    it('shows 2025 Draft option', () => {
      cy.contains('2025 Draft').should('exist')
    })

    it('shows pick number column', () => {
      cy.contains(/^#$|^Pick$/, { timeout: 8000 }).should('exist')
    })

    it('shows 72 picks for 2026', () => {
      cy.contains(/72 picks/i, { timeout: 8000 }).should('exist')
    })

    it('position filter works', () => {
      cy.contains('Forwards').click()
      cy.assertNoErrors()
      cy.contains('All').click()
    })

    it('round filter works', () => {
      cy.contains('Rd 1').click()
      cy.assertNoErrors()
      cy.contains('All Rounds').click()
    })

    it('2025 Draft tab switches data', () => {
      cy.contains('2025 Draft').click()
      cy.contains('2025 Draft', { timeout: 6000 }).should('exist')
      cy.assertNoErrors()
    })
  })
})
