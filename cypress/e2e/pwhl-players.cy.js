// cypress/e2e/pwhl-players.cy.js

const PWHL_TEST_TEAMS = ['BOS', 'MIN', 'MTL', 'TOR']

PWHL_TEST_TEAMS.forEach(abbr => {
  const teamId = { BOS: 1, MIN: 2, MTL: 3, TOR: 6 }[abbr]

  describe(`PWHL Players view — ${abbr}`, () => {
    beforeEach(() => {
      cy.visit('/pwhl/players', {
        onBeforeLoad(win) {
          win.localStorage.setItem('eyewall:sport', 'pwhl')
          win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr, teamId }))
        },
      })
      cy.get('.topbar', { timeout: 10000 }).should('exist')
    })

    describe('Roster tab', () => {
      it('renders Forwards section', () => {
        cy.contains(/Forwards/i, { timeout: 8000 }).should('exist')
      })

      it('renders Defencemen section', () => {
        cy.contains(/Defencemen|Defence/i, { timeout: 8000 }).should('exist')
      })

      it('renders Goalies section', () => {
        cy.contains('Goalies', { timeout: 8000 }).should('exist')
      })

      it('renders player photos or fallback initials', () => {
        cy.get('[class*="player-card"], [class*="roster"]', { timeout: 8000 })
          .should('have.length.greaterThan', 0)
      })

      // Regression test for the Session 39 roster-click bug: the loading
      // skeleton used to share the exact ".player-card" class with the real,
      // clickable card, so a click landing during the loading→loaded
      // transition could silently hit a lifeless ghost card. Waiting for
      // real player text (.pc-last only renders on the real card) before
      // clicking guards against that class ever colliding again.
      it('opens the player popup when a real roster card is clicked', () => {
        cy.get('.pc-last', { timeout: 8000 }).first().invoke('text').then(lastName => {
          cy.contains('.player-card', lastName).click()
        })
        cy.get('.player-popup', { timeout: 6000 }).should('exist')
      })
    })

    describe('Stats tab', () => {
      beforeEach(() => {
        cy.contains('Stats', { timeout: 8000 }).click()
        cy.contains('GP', { timeout: 8000 }).should('exist')
      })

      it('renders skater stats table', () => {
        cy.contains('GP').should('exist')
        cy.contains(/^G$|Goals/i).should('exist')
        cy.contains(/PTS|Pts/i).should('exist')
      })

      it('can switch to Goalies sub-tab', () => {
        cy.contains('Goalies').click()
        cy.contains(/SV%|GAA/i, { timeout: 8000 }).should('exist')
        cy.assertNoErrors()
      })

      it('stats columns are sortable', () => {
        cy.contains(/^G$|Goals/i).first().click()
        cy.assertNoErrors()
      })
    })

    describe('Player popup (skater)', () => {
      beforeEach(() => {
        // Open from Stats tab table row
        cy.contains('Stats', { timeout: 8000 }).click()
        cy.get('tbody tr', { timeout: 10000 }).first().click()
        cy.get('.pp-tab', { timeout: 10000 }).should('exist')
      })

      it('shows player name', () => {
        cy.get('.pp-name, .pp-first, .pp-last', { timeout: 6000 }).should('exist')
      })

      it('shows position badge', () => {
        cy.get('.pp-pos-chip, .pp-chip', { timeout: 6000 }).should('exist')
      })

      it('Stats tab shows scoring section', () => {
        cy.contains('Goals').should('exist')
        cy.contains('Assists').should('exist')
        cy.contains('Points').should('exist')
      })

      it('Heat Map tab renders rink', () => {
        cy.get('.pp-tab').contains('Heat Map').click()
        cy.get('svg', { timeout: 8000 }).should('exist')
        cy.assertNoErrors()
      })

      it('Scout tab shows Generate Report button', () => {
        cy.get('.pp-tab').contains('Scout').click()
        cy.contains(/Generate Report/i, { timeout: 6000 }).should('exist')
      })

      it('closes when X is clicked', () => {
        cy.get('.pp-close').first().click({ force: true })
        cy.get('.player-popup').should('not.exist')
      })
    })

    describe('Season picker', () => {
      beforeEach(() => cy.contains('Stats', { timeout: 8000 }).click())

      it('shows season options', () => {
        cy.contains('2025-26', { timeout: 8000 }).should('exist')
        cy.contains('2024-25').should('exist')
      })

      it('switching seasons does not crash', () => {
        cy.contains('2024-25', { timeout: 8000 }).click()
        cy.assertNoErrors()
        cy.contains('2025-26').click()
      })
    })
  })
})

// ── Expansion team (DET) — real roster exists in HockeyTech but zero games
// played, so skater/goalie season stats are genuinely empty. Roster tab
// should still render real players; Stats tab should show its explicit
// empty message rather than a blank or crashed table. Verified against the
// live Worker before writing these assertions (see Session 38 investigation).
describe('PWHL Players view — DET (expansion, no games played yet)', () => {
  beforeEach(() => {
    cy.visit('/pwhl/players', {
      onBeforeLoad(win) {
        win.localStorage.setItem('eyewall:sport', 'pwhl')
        win.localStorage.setItem('eyewall:pwhl_team', JSON.stringify({ abbr: 'DET', teamId: 10 }))
      },
    })
    cy.get('.topbar', { timeout: 10000 }).should('exist')
  })

  describe('Roster tab (real roster data)', () => {
    it('renders Forwards, Defencemen, and Goalies sections', () => {
      cy.contains(/Forwards/i, { timeout: 8000 }).should('exist')
      cy.contains(/Defencemen|Defence/i, { timeout: 8000 }).should('exist')
      cy.contains('Goalies', { timeout: 8000 }).should('exist')
    })

    it('renders real player cards, not a no-roster message', () => {
      cy.get('[class*="player-card"], [class*="roster"]', { timeout: 8000 })
        .should('have.length.greaterThan', 0)
      cy.contains(/No roster data/i).should('not.exist')
    })

    // Session 39 fix: clicking a Roster-tab player card previously did not
    // open the player popup — root cause was the loading skeleton sharing
    // the ".player-card" class with the real card (see RosterSkeleton in
    // this file), not anything expansion-team-specific. Fixed by giving the
    // skeleton its own ".player-card-skeleton" class.
    it('opens the player popup when a real roster card is clicked', () => {
      cy.get('.pc-last', { timeout: 8000 }).first().invoke('text').then(lastName => {
        cy.contains('.player-card', lastName).click()
      })
      cy.get('.player-popup', { timeout: 6000 }).should('exist')
    })
  })

  describe('Stats tab (no games played yet)', () => {
    beforeEach(() => cy.contains('Stats', { timeout: 8000 }).click())

    it('shows the no-skater-stats empty message instead of a table', () => {
      cy.contains(/No skater stats/i, { timeout: 8000 }).should('exist')
      cy.get('table').should('not.exist')
    })

    it('shows the no-goalie-stats empty message on the Goalies sub-tab', () => {
      cy.contains('Goalies').click()
      cy.contains(/No goalie stats/i, { timeout: 8000 }).should('exist')
      cy.assertNoErrors()
    })
  })
})
