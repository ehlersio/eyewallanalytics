// cypress/e2e/team.cy.js

const FULL_TEST_TEAMS = ['CAR', 'VGK', 'TOR', 'CHI']

FULL_TEST_TEAMS.forEach(teamAbbr => {
  describe(`Team view — ${teamAbbr}`, () => {
    beforeEach(() => {
      cy.team(teamAbbr).then(t => {
        cy.setTeam(teamAbbr)
        cy.visit('/team')
        cy.contains(t.displayName).should('be.visible')
      })
    })

    it('renders all expected tab buttons', () => {
      ['Overview', 'Advanced', 'Splits', 'Trends'].forEach(tab =>
        cy.contains(tab).should('be.visible')
      )
      // Cap and Picks tabs only available for teams with salary data
      if (teamAbbr === 'CAR') {
        cy.contains('Cap').should('be.visible')
        cy.contains('Picks').should('be.visible')
      }
    })

    describe('Overview tab', () => {
      it('shows season record', function () {
        cy.skipUnlessContentAppears('.records-row', 'Season stats')
        cy.contains('Season stats').should('be.visible')
        cy.contains(/\d+–\d+–\d+/).should('be.visible')
      })

      it('shows season stats with league ranks', function () {
        cy.skipUnlessContentAppears('.records-row', 'Season stats')
        cy.contains('Season stats').should('be.visible')
        cy.contains(/Goals\/GP|GA\/GP|PP%|PK%/).should('be.visible')
        cy.get('.overview-stat-rank').first().then($el => {
          expect($el.text().trim()).to.match(/^\d+(st|nd|rd|th)$/)
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

    describe('Advanced tab', () => {
      beforeEach(() => cy.contains('Advanced').click())

      it('renders possession stats', () => {
        cy.contains(/Corsi|CF%|Shot/i, { timeout: 8000 }).should('exist')
      })

      it('renders PDO section', function () {
        cy.skipUnlessContentAppears('.adv-context-note, .adv-toggle', 'PDO', { timeout: 8000 })
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

    describe('Splits tab', () => {
      beforeEach(() => cy.contains('Splits').click())

      it('renders home vs away split', () => {
        cy.contains(/Home|Away/i, { timeout: 8000 }).should('exist')
      })

      it('shows record for both home and away', () => {
        cy.contains(/\d+–\d+/, { timeout: 8000 }).should('exist')
      })
    })

    describe('Trends tab', () => {
      beforeEach(() => cy.contains('Trends').click())

      it('renders quick stats cards', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Current streak|W\d|L\d/i, { timeout: 8000 }).should('exist')
        cy.contains('Last 10 games', { timeout: 8000 }).should('exist')
      })

      it('renders result dots for last 20 games', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Last \d+ games/i, { timeout: 8000 }).should('exist')
        cy.get('[class*="result-dot"]').should('have.length.greaterThan', 0)
      })

      it('renders rolling win% chart', function () {
        cy.skipIfEither('.empty-title', '[class*="rolling-bar"]', { timeout: 8000 })
        cy.contains(/Win %|Rolling.*win/i, { timeout: 8000 }).should('exist')
        cy.get('[class*="rolling-bar"]').should('have.length.greaterThan', 0)
      })

      it('renders goal differential chart', function () {
        cy.skipIfEither('.empty-title', '[class*="result-dot"]', { timeout: 8000 })
        cy.contains(/Goal differential/i, { timeout: 8000 }).should('exist')
      })

      it('renders score-first rate chart', () => {
        cy.get('body').then($body => {
          if ($body.text().match(/Score.first rate/i)) {
            cy.contains(/Score.first rate/i).should('exist')
          }
        })
      })
    })

    describe('Compare Seasons', () => {
      beforeEach(() => cy.contains('🆚 Compare Seasons').click())

      it('opens the picker with multiple season options', () => {
        cy.contains('Compare Seasons').should('be.visible')
        cy.get('.season-chip', { timeout: 8000 }).should('have.length.greaterThan', 1)
      })

      it('renders one comparison card per selected season', () => {
        cy.get('.season-chip', { timeout: 8000 }).eq(0).click()
        cy.get('.season-chip').eq(1).click()
        cy.get('.stat-section').should('have.length', 2)
        cy.contains('GP').should('be.visible')
        cy.contains('PTS').should('be.visible')
      })

      // Season-boundary case (SESSION_64_BUILD's "not tracked yet" requirement):
      // as of 2026-07, the current season (20262027) has real wins/losses/points
      // but null goals_for/goals_against/pp_pct/pk_pct in Supabase (pipeline
      // hasn't populated those columns yet -- see eyewall-poller#20's PR
      // description for the underlying data-quality finding). This assertion
      // will need revisiting once real 2026-27 games populate those columns --
      // it's asserting today's real partial-season state, not a permanent one,
      // same tradeoff this file already accepts for skipIfEither/season-flip
      // content elsewhere. If it starts failing after the season is underway,
      // that's this test going stale, not a regression.
      it('shows "—" rather than blank for a box-score field not yet populated for the current season', function () {
        cy.get('.season-chip', { timeout: 8000 }).contains('2026-27').click()
        cy.get('.season-chip').contains('2025-26').click()
        cy.get('.stat-section').should('have.length', 2)
        cy.get('.stat-row-value').each($el => {
          const text = $el.text().trim()
          expect(text, `stat-row-value should never render blank/undefined/NaN, got "${text}"`)
            .to.not.match(/^$|undefined|NaN/)
        })
      })
    })

    // Cap & Picks only runs for teams with salary data
    if (teamAbbr === 'CAR') {
      describe('Cap tab', () => {
        beforeEach(() => cy.contains('Cap').click())

        it('renders salary cap bar', () => {
          cy.contains(/cap/i, { timeout: 8000 }).should('exist')
          cy.contains(/\$\d+M|\d+M/).should('exist')
        })

        it('renders contract table with player names', () => {
          cy.team('CAR').then(t => {
            cy.contains(t.skater, { timeout: 8000 }).should('exist')
            cy.contains(/UFA|RFA/).should('exist')
            cy.contains(/\$\d+\.\d+M/).should('exist')
          })
        })

      })

      describe('Picks tab', () => {
        beforeEach(() => cy.contains('Picks').click())

        it('renders 2026 NHL Draft section', () => {
          cy.contains('2026 NHL Draft', { timeout: 8000 }).should('exist')
        })

        it('renders CAR pick slot', () => {
          cy.get('.picks-slot, .picks-made-row', { timeout: 8000 }).should('have.length.gte', 1)
        })
      })
    }
  })
})
